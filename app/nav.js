// The menu of the app pages, and who can open the "Manage" pages.
//
//   Signed out:                 Opportunities · Sign in
//   Signed in:                  Opportunities · My sign-ups · Profile
//   On an organization's team:  … | Manage: Events · Dashboard · Organization
//
// On wide screens the menu is at the top. On phones the main items move to
// a bar at the bottom of the screen (like most apps), and the Manage links
// stay at the top on the Manage pages.
//
// The Manage pages call SevakNav.guard() first. Someone signed in who isn't
// on the right team sees how to get there instead: set up an organization
// (and be its Admin), or ask an Admin to add them on the Team tab. Signed
// out, the pages open as a preview, so reviewers can look around.
(function () {
  "use strict";

  var F = window.SevakForms;
  var O = window.SevakOrgs;
  var SEEN_KEY = "sevak.seenTeams.v1";
  var BANNER_KEY = "sevak.bannerDismissed.v1";
  var MANAGE = { "events.html": "events", "event.html": "events", "main-event.html": "events", "dashboard.html": "dashboard", "organization.html": "organization" };

  var ICONS = {
    opportunities: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.5"/>',
    mine: '<rect x="3.5" y="4.5" width="17" height="16" rx="2.5"/><path d="M3.5 9.5h17M8 2.5v4M16 2.5v4M8.5 14.5l2.5 2.5 4.5-4.5"/>',
    profile: '<circle cx="12" cy="8.5" r="4"/><path d="M4.5 20.5c1.2-3.8 4.2-5.8 7.5-5.8s6.3 2 7.5 5.8"/>',
    signin: '<path d="M14 4.5h3.5a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H14M10 16.5 14.5 12 10 7.5M14.5 12H4"/>',
    manage: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>'
  };

  function page() {
    return location.pathname.split("/").pop() || "index.html";
  }

  // Which main item is "here": the volunteer page has two views.
  function currentItem() {
    var here = page();
    if (here === "signup.html") return new URLSearchParams(location.search).get("view") === "mine" ? "mine" : "opportunities";
    if (here === "profile.html") return "profile";
    if (here === "signin.html") return "signin";
    return MANAGE[here] ? "manage" : "";
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function link(href, text, current) {
    var a = el("a", null, text);
    a.href = href;
    if (current) a.setAttribute("aria-current", "page");
    return a;
  }

  function myEmail() {
    var p = F.session.profile();
    return p ? String(p.email).trim().toLowerCase() : "";
  }

  // How many upcoming events you've signed up for (still going ahead).
  function upcomingCount() {
    var email = myEmail();
    if (!email || !F.session.signedIn()) return 0;
    var d = new Date();
    var pad = function (n) { return String(n).padStart(2, "0"); };
    var today = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
    var events = {};
    (F.load("sevak.events.v1") || []).forEach(function (e) { events[e.id] = e; });
    var seen = {};
    (F.load("sevak.signups.v1") || []).forEach(function (s) {
      var e = events[s.eventId];
      if (s.status === "cancelled" || String(s.email || "").trim().toLowerCase() !== email || !e) return;
      if (e.active === false || (e.endDate || e.startDate || "") < today) return;
      seen[e.id] = true;
    });
    return Object.keys(seen).length;
  }

  // The main items, as [key, href, label].
  function mainItems(signedIn) {
    return signedIn
      ? [["opportunities", "signup.html", "Opportunities"], ["mine", "signup.html?view=mine", "My sign-ups"], ["profile", "profile.html", "Profile"]]
      : [["opportunities", "signup.html", "Opportunities"], ["signin", "signin.html", "Sign in"]];
  }

  // ---------- Menu ----------

  function render() {
    var nav = document.getElementById("app-nav");
    if (!nav) return;
    var here = page();
    var item = currentItem();
    var signedIn = F.session.signedIn();
    var onTeam = signedIn && O.myTeams().length > 0;
    var showManage = signedIn ? onTeam : !!MANAGE[here];
    var count = upcomingCount();

    nav.innerHTML = "";
    var main = el("span", "nav-group nav-main");
    mainItems(signedIn).forEach(function (m) {
      var a = link(m[1], m[2], item === m[0]);
      if (m[0] === "mine" && count) {
        var badge = el("span", "nav-count", String(count));
        badge.setAttribute("aria-label", count + " upcoming");
        a.appendChild(badge);
      }
      main.appendChild(a);
    });
    nav.appendChild(main);

    if (showManage) {
      var manage = el("span", "nav-group nav-manage" + (MANAGE[here] ? "" : " nav-manage-elsewhere"));
      manage.setAttribute("role", "group");
      manage.setAttribute("aria-label", "Manage");
      manage.appendChild(el("span", "nav-label", "Manage"));
      manage.appendChild(link("events.html", "Events", MANAGE[here] === "events"));
      manage.appendChild(link("dashboard.html", "Dashboard", MANAGE[here] === "dashboard"));
      manage.appendChild(link("organization.html", "Organization", MANAGE[here] === "organization"));
      nav.appendChild(manage);
    }

    // Phones: the same main items in a bar at the bottom, plus Manage.
    var bar = document.getElementById("tab-bar");
    if (!bar) {
      bar = el("nav", "tab-bar");
      bar.id = "tab-bar";
      bar.setAttribute("aria-label", "Main");
      document.body.appendChild(bar);
    }
    bar.innerHTML = "";
    var items = mainItems(signedIn);
    if (showManage) items.push(["manage", "events.html", "Manage"]);
    items.forEach(function (m) {
      var a = link(m[1], "", item === m[0]);
      a.className = "tab-bar-item";
      a.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[m[0]] + "</svg>";
      a.appendChild(el("span", "tab-bar-label", m[2]));
      if (m[0] === "mine" && count) {
        var b = el("span", "nav-count", String(count));
        b.setAttribute("aria-label", count + " upcoming");
        a.appendChild(b);
      }
      bar.appendChild(a);
    });
    document.body.classList.add("has-tab-bar");
  }

  // ---------- The prototype banner: one line, and can be dismissed ----------

  function setupBanner() {
    var banner = document.querySelector("main .banner");
    if (!banner) return;
    var dismissed = false;
    try { dismissed = localStorage.getItem(BANNER_KEY) === "true"; } catch (e) { /* ignore */ }
    banner.hidden = dismissed;
    var close = el("button", "banner-close");
    close.type = "button";
    close.setAttribute("aria-label", "Dismiss this note");
    close.textContent = "✕";
    close.addEventListener("click", function () {
      banner.hidden = true;
      try { localStorage.setItem(BANNER_KEY, "true"); } catch (e) { /* ignore */ }
    });
    banner.appendChild(close);
  }

  // ---------- "You've been added to a team" ----------
  // Shown once for each team someone else added you to. (In the live app
  // this is an invitation email you accept.)

  function announceTeams() {
    if (!F.session.signedIn()) return;
    var teams = O.myTeams();
    var ids = teams.map(function (t) { return t.org.id; });
    var seen = F.load(SEEN_KEY);
    if (!Array.isArray(seen)) {
      F.store(SEEN_KEY, ids);
      return;
    }
    var email = myEmail();
    var fresh = teams.filter(function (t) {
      return seen.indexOf(t.org.id) === -1 && String(t.org.createdBy || "").toLowerCase() !== email;
    });
    F.store(SEEN_KEY, seen.concat(ids.filter(function (id) { return seen.indexOf(id) === -1; })));
    if (!fresh.length) return;

    var box = el("div", "section notice team-notice");
    box.setAttribute("role", "status");
    fresh.forEach(function (t) {
      var p = el("p");
      p.appendChild(document.createTextNode("You've been added to the team of "));
      p.appendChild(el("strong", null, t.org.name || "an organization"));
      p.appendChild(document.createTextNode(" as " + (t.role === "admin" ? "an Admin" : "a Coordinator") + ". "));
      var go = link("events.html", "Go to its events", false);
      go.addEventListener("click", function () { O.setCurrent(t.org.id); });
      p.appendChild(go);
      box.appendChild(p);
    });
    var close = el("button", "btn btn-link", "Dismiss");
    close.type = "button";
    close.addEventListener("click", function () { box.remove(); });
    box.appendChild(close);
    var banner = document.querySelector("main .banner");
    if (banner) banner.insertAdjacentElement("afterend", box);
  }

  // ---------- Access to the Manage pages ----------

  // opts.org: the organization the page is about (for one event), if any.
  // opts.creating: setting up a new organization, which anyone signed in can do.
  // Returns true when the page may show; otherwise shows the way in instead.
  function guard(opts) {
    opts = opts || {};
    if (!F.session.signedIn()) {
      var banner = document.querySelector("main .banner");
      if (banner && !banner.querySelector(".preview-note")) {
        banner.insertBefore(el("span", "preview-note", " You're not signed in, so you're previewing this page. In the live app, only an organization's team can open it."), banner.querySelector(".banner-close"));
        banner.hidden = false;
      }
      return true;
    }
    if (opts.creating) return true;
    if (opts.org ? O.roleFor(opts.org) : O.myTeams().length) return true;
    showWayIn(opts.org);
    return false;
  }

  function showWayIn(org) {
    var main = document.querySelector("main");
    Array.prototype.forEach.call(main.children, function (child) {
      if (!child.classList.contains("banner") && !child.classList.contains("team-notice")) child.hidden = true;
    });
    var hasTeams = O.myTeams().length > 0;
    var box = el("section", "way-in");
    box.setAttribute("aria-labelledby", "way-in-title");
    var h1 = el("h1", "page-title", org ? "You're not on this team" : "Manage an organization");
    h1.id = "way-in-title";
    box.appendChild(h1);
    box.appendChild(el("p", "page-intro", org
      ? "You're not on the team of " + (org.name || "this organization") + ", so you can't manage its events."
      : "You're not on an organization's team yet. There are two ways to start."));

    var doors = el("div", "way-in-doors");
    var create = el("div", "section way-in-door");
    create.appendChild(el("h2", "section-title", "Start a new organization"));
    create.appendChild(el("p", "section-help", "Run volunteer events for a group? Set it up and you'll be its Admin."));
    var go = link("organization.html?new=1", "Set up your organization", false);
    go.className = "btn btn-primary";
    create.appendChild(go);
    doors.appendChild(create);

    var join = el("div", "section way-in-door");
    join.appendChild(el("h2", "section-title", "Join an existing organization"));
    var p = el("p", "section-help");
    p.appendChild(document.createTextNode("Ask one of its Admins to add "));
    p.appendChild(el("strong", null, (F.session.profile() || {}).email || "your email"));
    p.appendChild(document.createTextNode(" on their Team tab. Manage then appears at the top of the page."));
    join.appendChild(p);
    doors.appendChild(join);
    box.appendChild(doors);

    var back = el("p", "way-in-back");
    if (hasTeams) {
      back.appendChild(link("events.html", "Go to your organizations' events", false));
      back.appendChild(document.createTextNode(" · "));
    }
    back.appendChild(link("signup.html", "Back to volunteer opportunities", false));
    box.appendChild(back);
    main.appendChild(box);
    document.title = (org ? "Not on this team" : "Manage an organization") + " · Sevak";
  }

  render();
  setupBanner();
  announceTeams();

  window.SevakNav = { render: render, guard: guard };
})();
