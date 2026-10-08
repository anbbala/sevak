// The menu at the top of the app pages, and who can open the "Manage" pages.
//
//   Signed out:                 Opportunities · Sign in
//   Volunteer (no team):        Opportunities · My profile
//   On an organization's team:  Opportunities · My profile | Manage: Events · Dashboard · Organization
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
  var MANAGE = { "events.html": "events", "event.html": "events", "main-event.html": "events", "dashboard.html": "dashboard", "organization.html": "organization" };

  function page() {
    return location.pathname.split("/").pop() || "index.html";
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

  // ---------- Menu ----------

  function render() {
    var nav = document.getElementById("app-nav");
    if (!nav) return;
    var here = page();
    var signedIn = F.session.signedIn();
    var showManage = signedIn ? O.myTeams().length > 0 : !!MANAGE[here];

    nav.innerHTML = "";
    var main = el("span", "nav-group");
    main.appendChild(link("signup.html", "Opportunities", here === "signup.html"));
    main.appendChild(signedIn
      ? link("profile.html", "My profile", here === "profile.html")
      : link("signin.html", "Sign in", false));
    nav.appendChild(main);

    if (showManage) {
      var manage = el("span", "nav-group nav-manage");
      manage.setAttribute("role", "group");
      manage.setAttribute("aria-label", "Manage");
      manage.appendChild(el("span", "nav-label", "Manage"));
      manage.appendChild(link("events.html", "Events", MANAGE[here] === "events"));
      manage.appendChild(link("dashboard.html", "Dashboard", MANAGE[here] === "dashboard"));
      manage.appendChild(link("organization.html", "Organization", MANAGE[here] === "organization"));
      nav.appendChild(manage);
    }
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
        banner.appendChild(el("span", "preview-note", " You're not signed in, so you're previewing this page. In the live app, only an organization's team can open it."));
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
  announceTeams();

  window.SevakNav = { render: render, guard: guard };
})();
