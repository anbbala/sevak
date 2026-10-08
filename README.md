# Sevak

*A Service of The ANB Group.*

A simple web app for organizations to publish volunteer events and shifts, and for volunteers to
sign up in seconds.

**Status:** pre-MVP. The landing page welcomes volunteers with Sign in and Sign up.

- MVP requirements: [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md)
- Architecture, back end and hosting plan: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Landing page: [`index.html`](index.html) (static, no build step)
- Front-end prototype: [`app/`](app/). It uses mock data stored in your browser, with no backend yet.
  - [`app/signin.html`](app/signin.html): prototype sign-in (matches the email on the profile saved in this browser)
  - [`app/profile.html`](app/profile.html): user profile for volunteers and host team members
  - [`app/organization.html`](app/organization.html): host organization profile, with a Documents tab (events and profiles have one too)
  - [`app/events.html`](app/events.html): the organization's events, with main events and their sub-events
  - [`app/main-event.html`](app/main-event.html): a main event that groups sub-events, such as a festival and its rehearsals
  - [`app/event.html`](app/event.html): create and edit an event, with its roles and shifts
  - [`app/dashboard.html`](app/dashboard.html): upcoming events and volunteers required vs enrolled
  - [`app/signup.html`](app/signup.html): volunteer side: available volunteer opportunities (where registered volunteers land from the home page), sign up for shifts, manage or cancel a sign-up

**Demo data:** open [`app/dashboard.html?demo=1`](app/dashboard.html?demo=1) (or use **Load demo data** on the Dashboard) to add a demo organization with main events, sub-events, roles, shifts and sign-ups. It doesn't change other data, and **Remove demo data** clears it. If you're signed in when you load it, you're added to the demo organization's team as an Admin, so the **Manage** menu (Events, Dashboard, Organization) appears; leave its team from My profile to see the volunteer-only view.

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

The site is published at `https://anbbala.github.io/vms-app/`. If the repository is renamed, this
address changes to match the new name, and the old address does not redirect.
