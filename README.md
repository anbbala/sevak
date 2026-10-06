# Sevak

*A Service of The ANB Group.*

A simple web app for organizations to publish volunteer events and shifts, and for volunteers to
sign up in seconds.

**Status:** pre-MVP. The site currently shows a coming-soon landing page.

- MVP requirements: [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md)
- Architecture, back end and hosting plan: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Landing page: [`index.html`](index.html) (static, no build step)
- Front-end prototype: [`app/`](app/). It uses mock data stored in your browser, with no backend yet.
  - [`app/profile.html`](app/profile.html): user profile for volunteers and host team members
  - [`app/organization.html`](app/organization.html): host organization profile
  - [`app/events.html`](app/events.html): the organization's events, with main events and their sub-events
  - [`app/main-event.html`](app/main-event.html): a main event that groups sub-events, such as a festival and its rehearsals
  - [`app/event.html`](app/event.html): create and edit an event, with its roles and shifts
  - [`app/dashboard.html`](app/dashboard.html): upcoming events and volunteers required vs enrolled
  - [`app/signup.html`](app/signup.html): volunteer side: find events, sign up for shifts, manage or cancel a sign-up

**Demo data:** open [`app/dashboard.html?demo=1`](app/dashboard.html?demo=1) (or use **Load demo data** on the Dashboard) to add a demo organization with main events, sub-events, roles, shifts and sign-ups. It doesn't change other data, and **Remove demo data** clears it.

## Preview locally

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Publish with GitHub Pages

The site is deployed by the [`Deploy to GitHub Pages`](.github/workflows/pages.yml) workflow on
every push to `main`. It checks that local links and scripts exist, then publishes the files as
they are (no build step). One-time setup:

1. Go to **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.

To redeploy without a new commit, open **Actions → Deploy to GitHub Pages → Run workflow**.

The site is published at `https://anbbala.github.io/sevak/`. The repository was renamed from
`vms-app` to `sevak` on 2026-10-06; the old `anbbala.github.io/vms-app/` address no longer works.
