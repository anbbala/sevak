# Sevak

A simple web app for organizations to publish volunteer events and shifts, and for volunteers to
sign up in seconds.

**Status:** pre-MVP. The site currently shows a coming-soon landing page.

- MVP requirements: [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md)
- Landing page: [`index.html`](index.html) (static, no build step)
- Front-end prototype: [`app/`](app/). It uses mock data stored in your browser, with no backend yet.
  - [`app/profile.html`](app/profile.html): user profile for volunteers and host team members
  - [`app/organization.html`](app/organization.html): host organization profile, with its events list
  - [`app/main-event.html`](app/main-event.html): a main event that groups sub-events, such as a festival and its rehearsals
  - [`app/event.html`](app/event.html): create and edit an event, with its roles and shifts

## Preview locally

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Publish with GitHub Pages

1. Go to **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Pick the branch that holds this code and the **`/ (root)`** folder, then click **Save**.

The site will be published at `https://anbbala.github.io/vms-app/`. The empty `.nojekyll` file tells
Pages to serve files as they are, without running Jekyll.
