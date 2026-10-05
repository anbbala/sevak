# Sevak: MVP Requirements

**Version:** 2.7 (events under organizations) · **Updated:** 2026-10-05 · **Status:** Draft for review

This replaces the original SRS outline, which is about six months old. That outline covered a full
volunteer management system: background checks, GPS clock-in, CRM integrations and so on. This
version narrows the scope to an **MVP** built around the user journeys we just walked through, and
it favours the simplest interface that will work.

---

## 1. Introduction

### 1.1 Purpose

This document defines what the first version (MVP) of **Sevak** must do and how well it must do it.
It is written for the founding team, designers, engineers, QA and pilot organizations.

### 1.2 Product vision

> Sevak is the simplest way for an organization to fill volunteer shifts, and for a volunteer to
> find one, sign up in under a minute, and get recognized for showing up.

### 1.3 MVP scope

**In scope**

- Organization profiles that show the organization type and a verification badge
- Single-day and multi-day events with **roles** assigned to **time shifts**
- Sign-up for one or many shifts in a single form, with no account needed
- Email for everything: confirmations, event updates, reminders and certificates
- Attendance checked by the host team, then an official certificate of participation
- Discovery: a calendar and list of events filtered by city, plus a page for each organization
- Public or private events and organizations, with invitations by email, text or WhatsApp
- A **private** "My volunteering" log for each volunteer
- A responsive web app designed for phones first

**Out of scope for the MVP** (see [§10 Roadmap](#10-roadmap) for what comes later)

- Native iOS or Android apps
- Background checks and certification document uploads
- GPS, QR or kiosk clock-in and clock-out
- Skills, interests and availability matching
- CRM, SSO and other third-party integrations
- Sending SMS or WhatsApp messages from the platform (hosts share links instead)
- Payments, donations and payroll
- Gamification, points and rewards
- Importing events from ticketing platforms or social media
- Languages other than English

### 1.4 What changed from the original spec

| Original spec | MVP decision | Why |
|---|---|---|
| Rich volunteer profile (skills, availability, certifications) | Optional profile that only stores contact details for one-click sign-up | Friction at sign-up is the biggest problem. A profile is nice to have, not a must. |
| Opportunities and shifts | Kept, restructured as **Event → Role → Shift**, with multi-day support | This is how hosts actually think about staffing an event. |
| Clock in/out (manual, QR, GPS) and hour approval | The host marks each person *Attended* or *No-show* on the roster. Hours default to shift length and can be adjusted. | This is the simplest reliable proof of participation. QR check-in comes later. |
| Engagement and impact reports | Roster CSV export plus a short per-event summary | This is enough for pilots. |
| Background checks, disclosures, policy acknowledgements | Deferred, except an optional waiver checkbox (Should) | Background check vendors are expensive and differ by organization. |
| Targeted messages, communication history, feedback, recognition | Event updates by email (to everyone or by role or shift) with a message history. Recognition is the certificate. | This covers the core loop without a separate engagement suite. |
| *(not in original)* | Organization verification and type, private events and organizations, invite links, calendar discovery by city, private volunteer log, branded certificates, SEO-ready public pages | These came out of the updated user journeys. |
| CRM, background check and SSO integrations | Later | None are needed to prove the core loop. |
| iOS and Android apps | Later. The web app is designed for phones first. | Web plus email reaches everyone and ships faster. |
| 2FA for all administrators | Required for platform admins, recommended (Should) for hosts. Everyone signs in with a passwordless email link by default. | Keeps security high without adding friction for volunteers. |

---

## 2. Users and roles

| Role | Who they are | What they need | Account |
|---|---|---|---|
| **Host (Owner)** | The person who creates and runs the organization's presence | Full control of the organization profile, events, team and certificates | Email sign-in link |
| **Host (Admin)** | Senior team members | Everything an Owner can do: edit the organization profile and manage the team | Email sign-in link |
| **Host (Coordinator)** | Event team members | Manage rosters, mark attendance and send updates, but no organization settings | Email sign-in link |
| **Volunteer (guest)** | Anyone signing up, often a first-time visitor arriving from a shared link | Find a shift and sign up in under a minute | **None.** They manage sign-ups through a secure link in their email. |
| **Volunteer (signed in)** | A returning volunteer | Pre-filled sign-up and a private log of their history, hours and certificates | Email sign-in link, no password |
| **Platform admin** | Us | Verify organizations and remove abusive content | Email sign-in link plus 2FA |

**One person, several roles:** a person can be a volunteer and a host team member at the same time, and can be a host team member for several organizations with a different role in each (VOL-13).

**Assumptions about users:** Hosts are busy and often not technical. Many are volunteers
themselves. Volunteers are mostly on phones and may arrive cold from a WhatsApp or text message.

---

## 3. Core concepts

```
Organization ──< Event ──< Role ──< Shift ──< Sign-up ──> Attendance ──> Certificate
                   │                              │
                   └── Updates (messages)         └── Volunteer (identified by email)
```

- **Organization:** the host. It has a type, a verification status and a visibility setting.
- **Event:** something happening on one or more days at a place, or online. It has a visibility
  setting.
- **Role:** a job at the event, such as *Setup crew* or *Registration desk*, with a description and
  what to bring.
- **Shift:** one role in one time window on one day, with a **capacity** (how many volunteers are
  needed).
- **Sign-up:** one volunteer on one shift. A single form submission can create several sign-ups.
- **Attendance:** the host team's record that the volunteer showed up, plus the hours credited.
- **Certificate:** branded proof of participation, emailed after attendance is checked, with a
  verification link.

**Example:** *Community Food Drive (Sat–Sun)*

| Day | Role | Time | Capacity |
|---|---|---|---|
| Sat | Setup crew | 8:00–10:00 AM | 6 |
| Sat | Sorting & packing | 10:00 AM–1:00 PM | 12 |
| Sun | Distribution | 9:00 AM–12:00 PM | 10 |

---

## 4. Functional requirements

Priority key: **Must** means required for MVP launch. **Should** means build it in the MVP if time
allows, or right after launch. **Later** means post-MVP.

### 4.0 Updated user journeys: where each one is covered

| # | User journey (from the updated brief) | Covered by |
|---|---|---|
| 1 | As an event host, I want to publish single- or multi-day event opportunities with specific volunteer roles defined against time shifts. | EVT-1 to EVT-8 |
| 2 | As a prospective volunteer, I want to very easily sign up for one or more time shifts. | SGN-1 to SGN-8 |
| 3 | As an event host, I want to send confirmation emails to those who signed up, and after my team has checked that they volunteered, send an official certificate or branded email confirming their participation. | COM-1, COM-2, ATT-1 to ATT-6 |
| 4 | As an event host, I want to send regular communications and event updates to volunteers. | COM-3 to COM-6 |
| 5 | As a volunteer, I'd like a profile so future sign-ups are one click (not a must). | VOL-2 (Should) |
| 6 | As an event host, I want a trusted, vetted profile for my organization that shows what type of organization it is, plus clean event pages. | ORG-1 to ORG-5, EVT-7, EVT-8 |
| 7 | As a volunteer, I want to see all available events on a calendar, filtered by city and/or by organization. | DSC-1 to DSC-4 |
| 8 | As an event host, I want to restrict visibility for private events or organizations while still inviting volunteers by email, text or WhatsApp. | ORG-6, PRV-1 to PRV-5 |
| 9 | As a volunteer, I want to join private events and keep my own log of them that isn't public, like private Venmo transactions. | VOL-1, VOL-3, VOL-4, §5 |
| 10 | *(Deferred, 2026-10-05)* Rules for under-age volunteers, such as a minimum age and parents signing up children. | §4.10 (Later) |

### 4.1 Organization profile and trust

| ID | Requirement | Priority |
|---|---|---|
| ORG-1 | A host can create an **organization profile**, grouped as: **About** (name, an optional website, an optional WhatsApp group, community or channel link (ORG-9), and an optional description of up to 1,000 characters), **Primary address** (country, street, optional suite, city or town, and a state or region and postal code where the country uses them), **Charity or nonprofit status** (ORG-8), **Primary contact** (name, optional title, email, phone; this person is the organization's Owner and receives volunteers' replies), and **Team members** (ORG-5). The type (ORG-2) and a logo are also part of the profile but aren't in the prototype yet. *(Prototype: `app/organization.html`.)* | Must |
| ORG-2 | The organization type is picked from a list: *Nonprofit / charity, School or university, Community group, Faith-based, Government / public agency, Business (CSR), Other*. | Must |
| ORG-3 | A host can request verification by providing evidence (for example a charity or tax registration number such as a US EIN or a UK charity number, an official website, or an email on the organization's own domain). A platform admin approves or rejects the request. Verified organizations show a **Verified** badge everywhere they appear. **Only verified organizations can list events publicly.** Unverified organizations can still create and run private events. | Must |
| ORG-4 | Each public organization has a clean page at `/o/{slug}` showing its description, type, badge and upcoming public events (as a calendar or list). | Must |
| ORG-5 | The profile lists up to 20 **team members**, each with a name, email, optional phone and a role. **Coordinators** manage rosters, mark attendance and send updates. **Admins** can also edit the organization profile and manage the team. Each person needs their own email address, because it becomes their login. Team members are invited by email. | Must |
| ORG-8 | **Charity or nonprofit status** works in any country. It is one of: registered charity or nonprofit (for example a US 501(c)(3), a UK registered charity or a Canadian registered charity), another nonprofit or tax-exempt organization, registration pending, or not registered. An optional **registration number** from the charity regulator or tax authority can be added for any status except "not registered". Adding one speeds up verification. It's used only for verification (ORG-3) and is never shown publicly. Organizations that aren't registered can still use Sevak. | Must |
| ORG-9 | An organization can add a **WhatsApp link** to its profile: a group or community invite (`chat.whatsapp.com/…`), a channel (`whatsapp.com/channel/…`) or a click-to-chat number (`wa.me/…`). Other links are rejected. Volunteers can tap it from the organization page to join. | Should |
| ORG-6 | Organization visibility is either **Public** (listed and indexed by search engines) or **Private** (no public page, and every event is private). An organization can only become public once it is verified (ORG-3). Until then it works as private. | Must |
| ORG-10 | **Fill in from website.** When a host enters their website, Sevak reads the page and fills in the **description** and **primary address** if those are still empty. The host can also run this with a "Fill in from website" button. It never overwrites what the host typed, and it only fills an address that is completely empty. Filled fields are highlighted until the host edits them, and the host is asked to check them. Sources, in order: schema.org `Organization` or `NGO` data (JSON-LD), then the Open Graph or meta description; for the address, schema.org `PostalAddress` (JSON-LD or microdata), with the country matched by code or name. **Prototype limitation:** browsers only allow reading sites that permit it (CORS), and most don't, so the prototype often shows "couldn't read that website". In Phase 2 the page is fetched by Sevak's server, with a timeout, size limit and protection against requests to internal addresses. *(Prototype: `app/website-import.js`.)* | Should |
| ORG-7 | Automated verification checks, such as a charity registry lookup or an email-domain match. | Later |

### 4.2 Events, roles and shifts

| ID | Requirement | Priority |
|---|---|---|
| EVT-1 | A host can create an event with a title, description, cover image, location (address and city, or online), time zone, and a start and end date. The event can be single-day or multi-day. | Must |
| EVT-2 | A host can define roles with a name, a description, and what to bring or requirements. | Must |
| EVT-3 | A host can define shifts for each role on each day, with a start time, end time and capacity. The shift builder has a **"copy to other days"** shortcut so multi-day events are fast to set up. | Must |
| EVT-4 | An event moves through *Draft → Published → Completed*, or *Cancelled*. Only published events accept sign-ups. | Must |
| EVT-5 | A host can edit a published event. If a time or location changes, the host is prompted to notify the affected volunteers and sees a preview of the email. | Must |
| EVT-6 | Cancelling an event or a shift emails the affected volunteers. | Must |
| EVT-7 | Each event has a clean, shareable page at `/e/{slug}` showing what, when, where, the organization and its badge, the roles, open shifts, and a sign-up button. | Must |
| EVT-8 | Public event pages include structured data (schema.org `Event`), Open Graph and link-preview tags, and a canonical URL, so they look good when shared and rank well in search. | Must |
| EVT-14 | **Events belong to an organization.** The organization profile has an **Events** section that lists the organization's events by date, showing the dates, location, number of shifts and volunteer spots, and whether each is a Draft or Published and Public or Private. A **Create event** button opens the event editor, and only appears once the organization profile is saved. Deleting an organization deletes its events. *(Prototype: `app/organization.html#events`, `app/event.html`.)* | Must |
| EVT-15 | **Event editor rules.** Events last 1–31 days. The end date follows the start date for one-day events. The time zone defaults to the host's browser. In-person events need a country, street and city, and the host can copy the organization's address in one click. Online events take an optional meeting link, shown only to volunteers who sign up. Each shift has a day within the event dates, a start time, an end time after the start, and 1–999 volunteers. A new shift copies the role's previous shift. "Copy first day's shifts to every day" skips days that already have the same shift. If the dates change, any shift left outside them is flagged. **Save draft** needs only a name and dates. **Publish** needs everything complete, including at least one role with at least one shift. A published event can be **unpublished** back to a draft. Overnight shifts that end after midnight are a later addition. | Must |
| EVT-16 | If an organization isn't verified yet, a **public** event stays private until it is (ORG-3, PRV-1), and the editor says so. | Must |
| EVT-9 | A host can duplicate an event, for example to repeat it next month. | Should |
| EVT-10 | A host can add custom sign-up questions to an event, such as T-shirt size or emergency contact. | Should |
| EVT-11 | A host can add a waiver or policy checkbox that links to the host's own document. | Should |
| EVT-12 | Recurring event series, host approval of sign-ups, and waitlists. | Later |

### 4.3 Volunteer sign-up

| ID | Requirement | Priority |
|---|---|---|
| SGN-1 | The event page lists shifts grouped by day and then by role, with times and **spots left**. Full shifts are marked *Full*. | Must |
| SGN-2 | A volunteer can tick **one or more shifts** and submit once with their name, email and an optional mobile number. No account or password is needed. | Must |
| SGN-3 | Target: a first-time volunteer can finish signing up on a phone in **under 60 seconds and no more than two screens**. | Must |
| SGN-4 | The form warns the volunteer if the shifts they picked overlap in time. | Must |
| SGN-5 | Capacity is checked when the form is submitted, so a shift is never overbooked even when many people sign up at the same moment. | Must |
| SGN-6 | The volunteer sees an instant confirmation screen and gets a confirmation email (COM-1) with a secure **"Manage my sign-up"** link for viewing, adding or cancelling shifts. | Must |
| SGN-7 | A volunteer can cancel a shift through that link, and the cancellation shows up on the host's roster. | Must |
| SGN-8 | The sign-up form has bot and spam protection (an invisible challenge plus rate limits). | Must |
| SGN-9 | The confirmation screen and email include **Add to calendar** (an .ics file and a Google Calendar link). | Should |
| SGN-10 | The form has an opt-in checkbox: *"Keep me posted about future opportunities from {Organization}."* | Should |
| SGN-11 | Waitlists for full shifts, and a host-approval sign-up mode. In the MVP every sign-up is **confirmed automatically** (decision Q3). | Later |

### 4.4 Volunteer profile and private log

| ID | Requirement | Priority |
|---|---|---|
| VOL-1 | Any volunteer who has signed up can **sign in with their email** using a one-time link, with no password. The email address is their identity. | Must |
| VOL-2 | A signed-in volunteer can keep a **profile** so future sign-ups are pre-filled and take one click. The profile holds: first and last name, email, mobile phone (NFR-16), an optional address (country, street, city or town, and a state or region and postal code where used), optional **affiliations** (up to 5, each with a type such as school, Scouting, faith community, workplace or club, plus a name), and **usual availability** (weekends only, weekdays, evenings only, or anytime). Organizations never see the street address. *(Prototype: `app/profile.html`.)* | Should |
| VOL-3 | A signed-in volunteer has a **"My volunteering"** page showing upcoming and past shifts across all organizations, **including private events**, with hours credited and certificates. | Must |
| VOL-4 | The log is **private to the volunteer.** Hosts only ever see records for their own organization's events. Nothing about a private event appears on any public page, in search, or to other volunteers. | Must |
| VOL-5 | A volunteer can download a summary of their hours as a PDF or CSV, for example for school or employer service-hour requirements. | Should |
| VOL-6 | A volunteer can export or delete their account and data (see open question Q9 on what the organization keeps). | Must |
| VOL-7 | An optional public volunteer profile or shareable badge. Entries from private events would never be shown on it. | Later |
| VOL-13 | In their profile, a person chooses **how they use Sevak**: **Volunteer**, **Host team member**, or both, with at least one required. Host team members list the **organizations** they help run (up to 10) and their **role in each**, Admin or Coordinator, so the same person can be an Admin for one organization and a Coordinator for another. Volunteer-only fields (address, affiliations, availability) appear only for volunteers. In the live app, organization memberships come from invitations (ORG-5) rather than being typed in. *(Prototype: `app/profile.html`.)* | Must |
| VOL-8 | Skills and interests, and **matching** shifts to a volunteer's availability (VOL-2 collects availability now). | Later |

### 4.5 Discovery

| ID | Requirement | Priority |
|---|---|---|
| DSC-1 | A **Discover** page lists published public events that still have open shifts. | Must |
| DSC-2 | Filters for **city** and **date range**, which can be combined with an **organization** filter. | Must |
| DSC-3 | The page has a **month calendar** view and a **list (agenda)** view. The list view is the default on phones. | Must |
| DSC-4 | An organization's page reuses the same calendar and list component for its own events. | Must |
| DSC-5 | Filters for organization type and cause or category, plus keyword search and a "Near me" option. | Should |
| DSC-6 | Private events and private organizations never appear in Discover, the organization directory, the sitemap or search engines (they are marked `noindex`). | Must |
| DSC-7 | A map view and personalized recommendations. | Later |

### 4.6 Private events and invitations

| ID | Requirement | Priority |
|---|---|---|
| PRV-1 | Event visibility is either **Public** (listed and indexed) or **Private** (unlisted, not indexed, and reachable only through its private link). Every event in a private or unverified organization is private. | Must |
| PRV-2 | A host can copy the private link, or share it directly to **WhatsApp, text message or email** through the phone's own share options, with a pre-written message. The platform does not pay for messaging. | Must |
| PRV-3 | A host can paste a list of email addresses to send **email invitations** from the app, and can see who was invited and who signed up. | Must |
| PRV-4 | A host can regenerate the private link, which stops the old link working. | Should |
| PRV-5 | An **invite-only** option: only invited email addresses can sign up. Anyone else sees a "request access" message. | Should |
| PRV-6 | Sending SMS or WhatsApp messages directly from the platform (for example through Twilio or the WhatsApp Business API). | Later |

### 4.7 Communications

| ID | Requirement | Priority |
|---|---|---|
| COM-1 | Every sign-up triggers an automatic **confirmation email** listing the volunteer's shifts, role details, location, the organization's contact details, and the manage link. | Must |
| COM-2 | A host can send a **confirmation or final-details email** to all or selected volunteers, for example *"You're confirmed. Here's parking info."* | Must |
| COM-3 | A host can send an **event update** to everyone on an event, or only to certain days, roles or shifts. The update goes out by email and also appears in an *Updates* feed that signed-up volunteers can see. | Must |
| COM-4 | The app keeps a **message history** for each event and each volunteer: what was sent, to whom, and when. | Must |
| COM-5 | A host can send **organization-wide messages** to past volunteers who opted in (SGN-10). Each message has an unsubscribe link. | Should |
| COM-6 | An automatic **reminder email** goes out before each shift (24 hours before by default). This is strongly recommended because it cuts no-shows. | Should |
| COM-7 | Every email carries the organization's branding (name, logo, colour). It is sent as *"{Organization} via Sevak"*, and replies go to the organization's contact email. | Must |
| COM-8 | Emails meet deliverability and legal basics: SPF, DKIM and DMARC; a plain-text version; the organization's contact details; and an unsubscribe link on anything that isn't transactional. | Must |
| COM-9 | Scheduled sends, SMS or WhatsApp delivery, and a custom sending domain for each organization. | Later |

### 4.8 Attendance and certificates

| ID | Requirement | Priority |
|---|---|---|
| ATT-1 | A **roster** for each event and each shift shows every volunteer's name, contact details, shift and status. It is easy to use on a phone on the day. | Must |
| ATT-2 | The host team can mark each sign-up **Attended** or **No-show**, with a bulk "mark all attended" option for each shift. | Must |
| ATT-3 | Hours credited default to the length of the shift, and a host can adjust them for each volunteer. | Must |
| ATT-4 | A host can add a walk-in volunteer to a shift on the day. | Should |
| ATT-5 | Once attendance is checked, a host can **issue certificates** to everyone marked attended. Each volunteer gets a branded email with a **PDF certificate** showing their name, the organization's name and logo, the event, dates, roles, hours, the signer's name and title, the issue date and a unique verification link. | Must |
| ATT-6 | A **certificate verification page** at `/verify/{code}` confirms a certificate is genuine and shows only the volunteer's name, the event, the organization and the hours. | Must |
| ATT-7 | A host can customize the certificate wording and add a signature image. | Should |
| ATT-8 | A host can **export the roster as CSV**, including sign-ups and attendance. | Must |
| ATT-9 | Each event has a summary showing shifts filled against capacity, the attendance rate and total hours. | Should |
| ATT-10 | QR code self check-in and GPS check-in. | Later |

### 4.9 Platform administration

| ID | Requirement | Priority |
|---|---|---|
| ADM-1 | A queue for reviewing and approving or rejecting organization verification requests. | Must |
| ADM-2 | Admins can unpublish events or organizations and suspend accounts that are abusive. | Must |
| ADM-3 | A "Report this event" link on public pages. | Should |
| ADM-4 | Basic platform metrics: organizations, events, sign-ups, and emails sent or bounced. | Should |

---

### 4.10 Future: under-age volunteers

*Deferred on 2026-10-05.* The MVP does not collect date of birth and does not have age-based rules.
The requirements below are kept here for a future release.

| ID | Requirement | Priority |
|---|---|---|
| EVT-13 | A host can set a **minimum age** (for example 16+ or 18+) for the whole event or for a single role. | Later |
| SGN-12 | A person signing up for themselves confirms they are **at least 13**, or older if the event or role requires it (EVT-13). If they are too young, the form explains why and offers the parent option where it is allowed. | Later |
| SGN-13 | A **parent or guardian can sign up a child** by choosing "I'm signing up my child" and entering the child's name and age. They confirm they are the child's parent or guardian and give consent. **This is the only way a child under 13 can take part.** The parent's email and phone are used for every message. The child's name appears on the roster and the certificate. The child's age is checked against the event's minimum age. | Later |
| VOL-11 | **Profiles for volunteers aged 13–17** also need a parent or guardian's name, relationship, email and phone. The guardian's email must be different from the teen's. The teen confirms their guardian knows they're volunteering. The guardian is then emailed to confirm before the teen can sign up for shifts, and gets copies of the teen's confirmations. Teens give only a city, never a home address, and their own phone is optional. | Later |
| VOL-12 | **Anyone under 13 cannot create a profile.** The form explains that a parent or guardian must create a profile and add the child under *My children* (VOL-10). | Later |
| VOL-9 | A parent's "My volunteering" log also shows the shifts, hours and certificates of children they signed up, grouped by child. Children under 13 never have their own login. | Later |
| VOL-10 | A signed-in adult can add children under 18 to their profile (name, date of birth, and an optional school or group) after confirming they are the parent or legal guardian and consenting to storage. They can then sign a child up in one click. | Later |
| FUT-1 | Collect **date of birth** (or an age confirmation) to support EVT-13 and the rules above. Under-age data handling must follow COPPA. | Later |
| FUT-2 | A **parent / guardian** user role: an adult who signs up and manages shifts on behalf of a child. All emails go to the parent, and the child never has a login. | Later |

## 5. Visibility and privacy model

| Data | Who can see it |
|---|---|
| Public organization page and public events | Everyone. Indexed by search engines. |
| Private organization and private events | Only people with the private link (or on the invite list, if invite-only) and the organization's team. Never listed or indexed. |
| Who has signed up for a shift | The organization's team only. Public pages show counts (*"4 of 6 spots left"*), never names. |
| A volunteer's contact details | The volunteer, and the team of any organization whose event they signed up for, for that organization's events only. |
| "My volunteering" log | The volunteer only. |
| Certificate | The volunteer and the issuing organization. Anyone with the verification link sees only the name, event, organization and hours. |

---

## 6. Screens for the front-end build

This is the list of screens to build in Phase 1 with mock data.

**Public and volunteer**

| # | Screen | Notes |
|---|---|---|
| P1 | Home or landing | The coming-soon page now. A marketing home page later. |
| P2 | Discover | Calendar and list views, with city, date and organization filters |
| P3 | Organization page | Profile, badge and upcoming events |
| P4 | **Event page and shift picker** | **The most important screen.** Shifts grouped by day, tick several |
| P5 | Sign-up form and confirmation | Name, email and phone, then done |
| P6 | Manage my sign-up | Opened from the email link: view, add or cancel shifts |
| P7 | Sign in | Email address, then a one-time sign-in link |
| P8 | My volunteering | Private log, hours and certificates |
| P9 | Certificate verification | Public, shows minimal data |

**Host**

| # | Screen | Notes |
|---|---|---|
| H1 | Organization setup and settings | Includes the verification request |
| H2 | Host dashboard | Events split into Drafts, Upcoming and Past. *(Prototype: a simple events list on the organization page.)* |
| H3 | **Event editor** *(prototype: `app/event.html`)* | Details → Roles → Shifts (grid with "copy to other days") → Visibility → Publish |
| H4 | Share and invite | Copy link, WhatsApp, text and email invitations |
| H5 | Roster and attendance | Designed for phones, used on the day |
| H6 | Compose an update, and message history | Choose the audience by day, role or shift |
| H7 | Issue certificates | Preview, then send |
| H8 | Team | Invite and remove team members |

**Admin:** A1, the verification queue and moderation tools.

**UX principles**

1. **Phone first.** The path from event page to sign-up to confirmation must work one-handed on a
   phone.
2. **No account walls** for volunteers. Ask only for a name and email, plus an optional phone
   number.
3. **One main action per screen**, in plain language (*shift*, *spots left*, *sign up*).
4. **Clean, trustworthy pages.** The organization's brand leads, and the verification badge is
   always visible.
5. **Accessible.** Meets WCAG 2.1 AA.

---

## 7. Non-functional requirements

| ID | Area | Requirement |
|---|---|---|
| NFR-1 | Performance | Public event and Discover pages reach Largest Contentful Paint in **under 2 seconds** on a mid-range phone over 4G (75th percentile). |
| NFR-2 | Capacity | Sized for about **200 organizations and 20,000 volunteers** in the MVP. A single event must handle **500 sign-ups within 10 minutes** without errors or overbooking. |
| NFR-3 | Availability | A 99.5% monthly uptime target. Failed email sends are retried. |
| NFR-4 | Authentication | Everyone signs in with a passwordless one-time email link. **Platform admins must use 2FA.** 2FA for hosts is a Should. |
| NFR-5 | Data protection | TLS everywhere, encryption at rest, and no secrets in the repository. An organization's data is only visible to that organization's team. |
| NFR-6 | Abuse prevention | Rate limits and bot protection on public forms. Private and manage links use long tokens that can't be guessed. |
| NFR-7 | Privacy | Collect as little data as possible. Meet GDPR and CCPA basics: a privacy policy, consent for non-transactional email, and data export and deletion. Volunteer data is never sold or shared. |
| NFR-8 | Minors | Deferred (see §4.10). The MVP collects no date of birth or age information. Under-age support must comply with COPPA when it is built. |
| NFR-9 | Accessibility | WCAG 2.1 AA: fully usable by keyboard, with labelled controls and enough colour contrast. |
| NFR-10 | SEO | Public pages are rendered on the server or pre-rendered, with meta tags, Open Graph tags, schema.org `Event` data and a sitemap. Private content is marked `noindex`. |
| NFR-11 | Time zones | Each event has its own time zone, and times are shown in the event's local time. Multi-day events handle daylight saving changes correctly. |
| NFR-12 | Browsers | The latest two versions of Chrome, Safari (including iOS), Firefox and Edge. |
| NFR-13 | Maintainability | The front end and back end are separated by an API. The code is typed. Automated tests cover the core flows (sign-up, capacity, attendance, certificates), and local setup is one command. |
| NFR-14 | Global use | Sevak is built for use **in any country**, and nothing assumes the US. Addresses have a country and use country-neutral fields ("State, province or region", "Postal code"), with postal-code formats checked for some countries and a lenient check elsewhere. Country names show in the visitor's language, and the country defaults from their browser settings. The interface is English-only for the MVP, with dates and times formatted for the user's locale. |
| NFR-16 | Phone numbers and WhatsApp | Every phone number is entered with a **country code** (a country picker plus the number, or a number typed with a leading +). It is stored in international **E.164** form (for example +14155550100 or +447911123456), dropping a national leading 0 or a US/Canada leading 1. Each number can be marked **"on WhatsApp"**, which gives it a `wa.me` link so hosts and volunteers can message it directly. |
| NFR-15 | Email deliverability | Sending from an authenticated domain, with bounce and complaint handling and suppression of bounced addresses. |

---

## 8. Data model (MVP)

| Entity | Key fields | Relationships |
|---|---|---|
| **User** | id, email (unique), first_name, last_name, phone (E.164), phone_country, phone_whatsapp, is_volunteer, is_host, address (country, line1, line2, city, state, postal_code; optional, volunteers only), availability (`weekends`/`weekdays`/`evenings`/`anytime`), is_platform_admin, created_at | One user can be a volunteer, a host team member, or both. A host team member can belong to several Organizations with a different role in each (through OrgMember). |
| **Affiliation** | id, user_id, type (`school`/`scouting`/`faith`/`workplace`/`club`/`other`), name | Up to 5 per User |
| **Organization** | id, name, slug, type, description, logo_url, website, whatsapp_link, address (country, line1, line2, city, state, postal_code), charity_status (`charity`/`nonprofit-other`/`pending`/`none`), registration_number (private), primary_contact_user_id, contact_title, visibility (`public`/`private`), verification_status (`unverified`/`pending`/`verified`/`rejected`) | Has many OrgMembers and Events |
| **OrgMember** | org_id, user_id, role (`owner`/`admin`/`coordinator`), invited_at, accepted_at. Unique per (org_id, user_id). | Links a User to an Organization |
| **VerificationRequest** | id, org_id, evidence, status, reviewed_by, reviewed_at | Belongs to an Organization |
| **Event** | id, org_id, title, slug, description, cover_url, venue, address, city, is_online, timezone, start_date, end_date, visibility (`public`/`private`), invite_only, private_token, status (`draft`/`published`/`completed`/`cancelled`) | Belongs to an Organization. Has many Roles, Shifts, Messages and Invites |
| **Role** | id, event_id, name, description, requirements | Belongs to an Event. Has many Shifts |
| **Shift** | id, event_id, role_id, starts_at, ends_at (stored in UTC), capacity | Belongs to a Role. Has many Signups |
| **Registration** | id, event_id, user_id, manage_token, opted_in_updates, answers (JSON), created_at | One form submission. Has many Signups |
| **Signup** | id, registration_id, shift_id, status (`confirmed`/`cancelled`), attendance (`unmarked`/`attended`/`no_show`), hours_credited | One volunteer on one Shift |
| **Invite** | id, event_id, email, sent_at, registration_id (set once they sign up) | Belongs to an Event |
| **Message** | id, org_id, event_id (optional), audience_filter, subject, body, sent_by, sent_at | Has many MessageDeliveries (recipient, status) |
| **Certificate** | id, registration_id, verification_code, hours, pdf_url, issued_by, issued_at | One per volunteer per event |

---

## 9. External services (MVP)

| Need | Example options | Priority |
|---|---|---|
| Transactional email | Postmark, Resend, Amazon SES, SendGrid | Must |
| Bot protection | Cloudflare Turnstile, hCaptcha | Must |
| File storage (logos, covers, PDFs) | Any S3-compatible storage | Must |
| PDF generation (certificates) | Server-side HTML-to-PDF rendering | Must |
| Address and city autocomplete | A places or geocoding API | Should (the MVP can use typed address and city fields) |

---

## 10. Roadmap

| Phase | Goal | Output |
|---|---|---|
| **0: Now** | Vet requirements and claim a public URL | This document and a coming-soon landing page on GitHub Pages |
| **1: Front end** | Get feedback on the experience before building the back end | Every MVP screen (§6) built as a clickable prototype with mock data, deployed to GitHub Pages and reviewed with 2–3 pilot organizations |
| **2: Back end and email** | Make it real | Data model, email sign-in, sign-up with capacity checks, emails and certificates, deployed on a very simple architecture (to be designed) |
| **3: Pilot** | Prove the core loop | A handful of organizations in one or two cities, measured against §11 |

**Long term (post-MVP)**

- **One source of truth for event information.** Automatically import or sync events from
  ticketing platforms (Eventbrite, Luma, Meetup) and social media (Facebook and Instagram events),
  so public events show the same details everywhere. This fixes a common problem where different
  sites list different information, and the canonical event page builds consistent SEO.
- Native mobile apps (iOS and Android)
- SMS and WhatsApp messages sent from the platform, scheduled sends, and custom sending domains
- QR code self check-in, waitlists, host-approved sign-ups and recurring event series
- Skills and availability matching, recommendations, and a map view
- Public volunteer profiles and badges
- Integrations with CRM (such as Salesforce), SSO and background check vendors
- More languages

---

## 11. Pilot success metrics

- Median time for a volunteer to sign up: **under 60 seconds**
- Time for a host to create a two-day event with three roles: **under 10 minutes**
- Share of shift capacity filled on pilot events: **80% or more**
- No-show rate: measure a baseline, then bring it down with reminders (COM-6)
- Share of completed events where the host issued certificates

---

## 12. Decisions and open questions

### 12.1 Decisions (2026-09-30)

| # | Question | Decision |
|---|---|---|
| Q1 | What is the product name? | **Sevak.** The domain is still to be chosen. |
| Q2 | Does an organization have to be verified before it can list **public** events? | **Yes.** Unverified organizations can still run **private** events (ORG-3, ORG-6, PRV-1). The MVP uses manual review of a charity or tax registration number (such as a US EIN or a UK charity number), a website, or an email on the organization's domain. |
| Q3 | Should sign-ups be confirmed automatically, or should hosts approve each one? | **Automatic.** COM-2 lets hosts send a "you're confirmed" email. Host approval stays in Later (SGN-11). |
| Q4 | What is the policy for minors? | **Deferred (2026-10-05).** The MVP doesn't collect date of birth and has no age rules. The earlier proposal (a minimum age of 13, parents signing up younger children, and event minimum ages) is kept as future requirements in §4.10. |
| Q10 | Hosting | **Front end only for now, hosted on GitHub Pages.** Server rendering for SEO (NFR-10) gets revisited when we design the Phase 2 back end and deployment. |

### 12.2 Still open

| # | Question | Recommendation |
|---|---|---|
| Q5 | Should public pages show the first names of people who signed up? | No. Show counts only. |
| Q6 | What goes on the certificate (hours, signer, logo)? Does "official" require sending from the organization's own email domain? | Include hours, the signer's name and title, and a verification link. Send as *"{Organization} via Sevak"* in the MVP, with custom domains later. |
| Q7 | Where do we launch first? | Sevak is built for any country (NFR-14). Choose one or two pilot cities, which don't have to be in the US. |
| Q8 | What does it cost? | Free during the pilot. Decide on pricing afterwards. |
| Q9 | How long do organizations keep a volunteer's records after the volunteer deletes their account? | Keep the attendance records and certificates the organization issued. Remove the volunteer's profile and login. |

---

## 13. Glossary

| Term | Meaning |
|---|---|
| **Sevak** | The product name |
| **MVP** | Minimum viable product: the smallest version that proves the core loop |
| **Host** | An organization, and its team, that publishes events |
| **Volunteer** | A person who signs up for shifts |
| **Event** | A single-day or multi-day activity that needs volunteers |
| **Role** | A job at an event, such as *Setup crew* |
| **Shift** | One role in one time window, with a capacity |
| **Capacity** | The number of volunteers a shift needs |
| **Registration** | One sign-up form submission, which can cover several shifts |
| **Roster** | The list of volunteers signed up for an event or shift |
| **Attendance** | The host's record of *Attended* or *No-show* for a sign-up |
| **Certificate** | Branded proof of participation that can be verified |
| **Public / Private** | Visibility levels. Private content is reachable only by link or invitation and is never indexed. |
| **Invite-only** | A private event where only invited email addresses can sign up |
| **One-time sign-in link** | Passwordless sign-in: a single-use link sent by email |
| **Verified** | An organization whose identity a platform admin has reviewed. Required before it can list public events. |
| **Parent / guardian** | *(Future, §4.10)* An adult who signs up and manages shifts on behalf of a child |
| **SEO** | Search engine optimization |
| **2FA** | Two-factor authentication |
| **BGC** | Background check (post-MVP) |
| **SPF / DKIM / DMARC** | Email authentication standards that help email reach the inbox |
| **WCAG** | Web Content Accessibility Guidelines |
