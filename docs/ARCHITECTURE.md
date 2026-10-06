# Sevak: Architecture and Hosting Plan

**Status:** Proposal for Phase 2 (back end and email) · **Updated:** 2026-10-06

This document explains how Sevak runs today, the back end we plan to build for the MVP, and where
to host it. The requirements it serves are in [`REQUIREMENTS.md`](REQUIREMENTS.md). IDs such as
SGN-5 and NFR-10 refer to that document.

---

## 1. Today: a static prototype

```
Browser ──> GitHub Pages (index.html, privacy.html, terms.html, app/*)
               │
               └── app/*-store.js read and write localStorage (no server, no shared data)
```

- There is no build step. The files are served as they are.
- Each page's data lives in the visitor's own browser, behind small modules called stores:
  `orgs-store.js`, `events-store.js` and `signups-store.js`. These stores are what the back end
  replaces (§6).
- Deployment uses [`.github/workflows/pages.yml`](../.github/workflows/pages.yml): on every push to
  `main` it checks that local links exist and the JavaScript parses, then publishes the site. It
  can also be run by hand from **Actions → Deploy to GitHub Pages → Run workflow**.

---

## 2. Design goals

Taken from the requirements, roughly in order of importance:

1. **Never overbook a shift**, even with 500 sign-ups in 10 minutes (SGN-5, NFR-2).
2. **Email is the product**: sign-in links, confirmations, updates, reminders and certificates must
   arrive, and failed sends are retried (COM-*, NFR-3, NFR-15).
3. **Public pages are fast and searchable**: they are rendered on the server, with Open Graph and
   schema.org data (EVT-7, EVT-8, NFR-1, NFR-10).
4. **Strict data separation**: an organization only ever sees its own data, and private events
   never leak (§5 of the requirements, NFR-5).
5. **Small and cheap to run.** About 200 organizations and 20,000 volunteers fit comfortably on one
   Postgres database and one or two small servers. No microservices, no Kubernetes.
6. **Typed, tested, one-command local setup** (NFR-13).

---

## 3. Target architecture

One codebase and one database, with two processes: a **web app** and a **worker**.

```
                       ┌──────────────── Cloudflare (DNS, TLS, CDN cache, Turnstile) ───────────────┐
                       │                                                                            │
Volunteers & hosts ──> │  sevak.<domain>                                                            │
                       └──────────────┬─────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────▼──────────────────┐
                    │  Web app (Next.js, TypeScript)      │
                    │  • Server-rendered public pages     │  /, /discover, /o/{slug}, /e/{slug}, /verify/{code}
                    │  • Host and volunteer screens       │  /app/...
                    │  • JSON API                         │  /api/v1/...
                    └───────┬─────────────────┬──────────┘
                            │                 │ enqueue jobs
                            │                 ▼
                            │      ┌────────────────────────────┐
                            │      │ Worker (Node, TypeScript)  │  emails, reminders, certificate PDFs,
                            │      │ jobs via pg-boss           │  website import (ORG-10), cleanups
                            │      └───────┬───────────┬────────┘
                            ▼              ▼           ▼
                  ┌──────────────────┐  ┌────────┐  ┌────────────────────────┐
                  │ PostgreSQL       │  │ Email  │  │ Object storage (R2/S3) │
                  │ data + job queue │  │Postmark│  │ logos, covers, PDFs    │
                  └──────────────────┘  └────────┘  └────────────────────────┘
```

### 3.1 Technology choices

| Concern | Choice | Why |
|---|---|---|
| Language | **TypeScript** everywhere | One language for front end, back end and shared validation (NFR-13). |
| Web framework | **Next.js** (App Router) | Server rendering for public pages (NFR-10), React for the host screens, and route handlers for the API, all in one deployable. Runs on any Node host, not only Vercel. |
| API style | REST + JSON under `/api/v1`, request and response shapes defined with **Zod** | Keeps the front end and back end separated by an API (NFR-13), and a future mobile app can use the same API. |
| Database | **PostgreSQL 16** | Transactions and row locks give us capacity checks we can trust (SGN-5). `timestamptz` handles time zones (NFR-11). Managed Postgres is available everywhere. |
| ORM and migrations | **Drizzle ORM** + `drizzle-kit` migrations | Typed queries, plain SQL when needed, and migrations that live in the repo. |
| Background jobs | **pg-boss** (a queue stored in Postgres) | Retries, scheduling (reminders 24 hours before a shift) and cron jobs, without running Redis. |
| Email | **Postmark** (or Amazon SES to save money later) | Good deliverability for transactional email, plus bounce and complaint webhooks (NFR-15). |
| Email templates | **React Email** | The same components as the web app, each with a plain-text version (COM-8). |
| Certificate PDFs | HTML template rendered by **Playwright/Chromium** in the worker | Branded certificates (ATT-5) from the same HTML and CSS as the web pages. |
| File storage | **Cloudflare R2** (S3-compatible) | No fees for downloads. Logos and covers are public; certificate PDFs are served through short-lived signed URLs. |
| Bot protection | **Cloudflare Turnstile** + per-IP and per-email rate limits | SGN-8, NFR-6. |
| Sign-in | Passwordless email links that we build ourselves (or Auth.js email provider), **TOTP 2FA** for platform admins | NFR-4. It's a small amount of code, and we control the emails. |
| Errors and logs | **Sentry** + the host's log viewer | Enough for a pilot. |
| Tests | **Vitest** (unit and database tests against a real Postgres) + **Playwright** (end-to-end) | Covers the core flows NFR-13 names: sign-up, capacity, attendance and certificates. |

### 3.2 Repository layout (monorepo, pnpm workspaces)

```
sevak/
├── apps/
│   ├── web/              Next.js: public pages, host and volunteer screens, /api/v1 routes
│   └── worker/           pg-boss consumers: email, reminders, PDFs, website import
├── packages/
│   ├── core/             Domain logic in plain TypeScript: sign-up and capacity, permissions,
│   │                     attendance, certificates. Has no web or framework code, so it's easy to test.
│   ├── db/               Drizzle schema, migrations, seed and demo data
│   ├── email/            React Email templates
│   └── shared/           Zod schemas, types, phone (E.164) and address helpers, countries
├── prototype/            Today's static app (index.html, app/*), still published to GitHub Pages
├── docker-compose.yml    Postgres + Mailpit (catches outgoing email) for local development
└── .github/workflows/    CI (lint, typecheck, test, migrate) and deploys
```

The web app and the worker both call into `packages/core`. Route handlers only check input, check
the session and call core functions.

---

## 4. Key design details

### 4.1 Capacity checks that never overbook (SGN-5)

Each shift row keeps a `filled` counter. A sign-up takes a seat with one atomic statement, inside
the same transaction that inserts the sign-up rows:

```sql
UPDATE shifts
   SET filled = filled + 1
 WHERE id = $1 AND filled < capacity AND status = 'open'
RETURNING id;
```

If no row comes back, the shift is full. For a form that picks several shifts, all seats are taken
in one transaction, in shift-id order (to avoid deadlocks), and the whole form either succeeds or
reports which shift filled up. A cancellation lowers `filled` in the same transaction that marks
the sign-up cancelled. A database `CHECK (filled <= capacity)` constraint is a final safety net,
and a nightly job checks that each counter matches its confirmed sign-ups. A load test (500
sign-ups in 10 minutes against one event) is part of the Phase 2 exit criteria (NFR-2).

### 4.2 Sign-in, sessions and secure links (VOL-1, NFR-4, NFR-6)

- **Sign-in link:** 32 random bytes, emailed, and **only a SHA-256 hash is stored**. It expires
  after 15 minutes and works once. Requests are rate-limited by email address and by IP.
- **Session:** an opaque id in an `HttpOnly; Secure; SameSite=Lax` cookie, stored in a `sessions`
  table so it can be revoked. Lasts 30 days and is renewed while in use.
- **Manage-my-sign-up and private-event links:** long random tokens, stored hashed (PRV-4 rotates
  them). A manage link only gives access to its own registration.
- **Platform admins** must also pass a TOTP code. 2FA for hosts is optional (Should).

### 4.3 Who can see what (§5 of the requirements, NFR-5)

- Every host API call goes through one helper, `requireOrgRole(session, orgId, minRole)`, which
  reads `org_members`. Every query on organization data filters by `org_id`.
- Public queries only read published events from public, verified organizations
  (ORG-3, ORG-6, PRV-1). Private pages send `noindex` and never appear in the sitemap (DSC-6).
- Public pages show counts ("4 of 6 spots left"), never names.
- Later, Postgres row-level security can enforce the `org_id` rule a second time.

### 4.4 Time zones (NFR-11)

Each event stores an IANA time zone (for example `Asia/Kolkata`). Shift start and end times are
stored as `timestamptz` (UTC) and converted from the event's local time when the host saves. Pages
show times in the event's time zone. The prototype's `day + HH:MM` fields map straight onto this.

### 4.5 Email pipeline (COM-*, NFR-3, NFR-15)

1. The app writes a `messages` row (and one `message_deliveries` row per recipient) and enqueues a
   job, in the same transaction as the change that caused it. An email is never sent for a
   sign-up that rolled back.
2. The worker renders the template and sends it through Postmark. Failures are retried with
   back-off.
3. Postmark webhooks (`/api/v1/webhooks/postmark`) record deliveries, bounces and complaints.
   Bounced addresses are suppressed.
4. Emails are sent as *"{Organization} via Sevak" &lt;notify@mail.&lt;domain&gt;&gt;*, with
   `Reply-To` set to the organization's contact (COM-7). SPF, DKIM and DMARC are set up on
   `mail.<domain>`.
5. Reminders (COM-6) are scheduled jobs created when someone signs up, and moved or cancelled if
   the shift changes.

### 4.6 Server-side fetching (ORG-10)

"Fill in from website" moves to the worker. It allows only `http`/`https`, resolves DNS and
**blocks private, loopback and link-local addresses** (to prevent server-side request forgery),
times out after 5 seconds, reads at most 1 MB, and follows at most 3 redirects, checking each one.

### 4.7 SEO for public pages (EVT-7, EVT-8, NFR-10)

`/e/{slug}` and `/o/{slug}` are server-rendered with `<title>`, a canonical URL, Open Graph tags
and schema.org `Event` / `Organization` JSON-LD. They are cached at Cloudflare for a short time
(about 60 seconds, so spots-left counts stay fresh) and generated again on publish. The app serves
`sitemap.xml` and `robots.txt`.

---

## 5. Hosting

### 5.1 Recommendation: Render + Cloudflare

| Piece | Service | Notes |
|---|---|---|
| Web app | Render **Web Service** (Node) | Deploys automatically from `main`. Each pull request gets a preview environment. |
| Worker | Render **Background Worker** | Same repo, different start command. |
| Database | Render **Managed PostgreSQL** with daily backups and point-in-time recovery | Or **Neon** if you want database branches for each preview. |
| DNS, TLS, CDN, Turnstile | **Cloudflare** (free plan) | Put the domain on Cloudflare and point it at Render. |
| Files | **Cloudflare R2** | |
| Email | **Postmark** | Authenticate the sending domain before the pilot. |
| Errors | **Sentry** (free tier) | |
| Prototype | **GitHub Pages** (what we use now) | Keep it for design reviews. |

**Why Render:** it's one dashboard for the web app, the worker, cron jobs and Postgres. You deploy
with `git push`, nobody has to manage servers, it's cheap at pilot scale, and the app is an
ordinary Node service with no lock-in. Moving to Fly.io, Railway, AWS or Google Cloud Run later is
a change of configuration, not a rewrite.

**Rough monthly cost for the pilot:** about US$25–60, made up of two small instances, a small
Postgres database and the entry Postmark plan. Cloudflare, R2 (at this volume) and the Sentry
free tier cost nothing. Check current prices before you commit.

### 5.2 Alternatives considered

| Option | Good | Watch out for |
|---|---|---|
| **Vercel + Neon + a job service** (Inngest or Upstash QStash) | The best Next.js experience, serverless, generous free tiers | Background jobs, PDF rendering (Chromium) and long tasks need extra services; three or more vendors to manage. |
| **Fly.io** | Close to users worldwide, cheap small machines | More do-it-yourself: you look after Postgres operations and more networking yourself. |
| **Supabase** (Postgres + auth + storage) | Many building blocks included | Pulls the design toward its own auth and row-level-security model. Fine, but a different architecture from this one. |
| **AWS / GCP directly** (ECS or Cloud Run + RDS or Cloud SQL) | Scales anywhere, enterprise-friendly | Much more setup and running work than a pilot needs. |

### 5.3 Environments and delivery

| Environment | Where | Data |
|---|---|---|
| Local | `docker compose up` (Postgres + Mailpit) + `pnpm dev` | Seed and demo data (port `app/demo-data.js`) |
| Preview | Render preview for each pull request | Seeded data, emails caught and never delivered |
| Staging | `staging.<domain>` | Copy of production structure, made-up data |
| Production | `<domain>` | Real data |

CI (GitHub Actions) on every pull request: lint, typecheck, unit and database tests against a
Postgres service container, Playwright tests on the core flows, and a check that migrations apply
cleanly. Merging to `main` deploys to staging, and promoting deploys to production. Migrations run
as a pre-deploy step and must be backward-compatible for one release (add first, remove later).

### 5.4 Secrets and configuration

All secrets (`DATABASE_URL`, `POSTMARK_TOKEN`, `R2_*`, `TURNSTILE_SECRET`, `SESSION_SECRET`,
`SENTRY_DSN`) live in the host's environment settings, never in the repository (NFR-5). There is
a `.env.example` file listing names only.

---

## 6. Moving from the prototype to the real app

The prototype's stores map directly onto API resources, so screens can be ported one at a time:

| Prototype module | API resources |
|---|---|
| `orgs-store.js` | `GET/POST /orgs`, `GET/PATCH/DELETE /orgs/{id}`, `/orgs/{id}/members`, `/orgs/{id}/verification` |
| `events-store.js` (events, roles, shifts) | `/orgs/{id}/events`, `/events/{id}` (roles and shifts saved with the event), `/events/{id}/publish` |
| `events-store.js` (main events) | `/orgs/{id}/main-events`, `/main-events/{id}` |
| `signups-store.js` | `POST /events/{id}/registrations` (public, Turnstile), `GET/PATCH /registrations/{manageToken}`, `/events/{id}/roster` |
| `profile.js` | `GET/PATCH /me`, `/me/affiliations`, `/me/volunteering` |
| `website-import.js` | `POST /orgs/{id}/import-website` (runs in the worker) |
| `demo-data.js` | `packages/db` seed script |

The data model in §8 of the requirements becomes the Drizzle schema almost table for table, with
these additions: `sessions`, `login_tokens`, a `shifts.filled` counter, `message_deliveries` and
the pg-boss tables.

---

## 7. Phase 2 build plan

| Step | Scope | Done when |
|---|---|---|
| **2a. Foundation** (about 1–2 weeks) | Monorepo, Docker Compose, Drizzle schema and migrations, CI, Render staging, Cloudflare domain, Postmark domain authentication, email sign-in and sessions | A person can sign in on staging and the CI pipeline passes |
| **2b. Host core** | Organizations, members and invitations, events, roles, shifts, main events, publish and unpublish; host screens ported from the prototype | The prototype's host flows work against the API |
| **2c. Volunteer core** | Server-rendered `/e/{slug}` and `/o/{slug}`, sign-up with capacity checks, Turnstile, confirmation email, manage link, Add to calendar | 500-sign-up load test passes with no overbooking |
| **2d. Run the event** | Roster, attendance and hours, CSV export, event updates and message history, reminders, certificates (PDF) and `/verify/{code}` | One whole event runs end to end on staging |
| **2e. Trust and launch** | Verification queue, moderation, Discover with city and date filters, sitemap, data export and deletion, backups restore-tested, Sentry, privacy review | Ready for the Phase 3 pilot |

### Decisions needed

1. **Domain** (Q1 in the requirements). Email authentication and the hosting setup depend on it.
2. Accept the stack above (Next.js + Postgres + Render), or pick an alternative from §5.2.
3. Choose the email provider (Postmark recommended) and who owns the vendor accounts (The ANB Group).
