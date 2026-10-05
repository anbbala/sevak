// Events list (prototype): the organization's main events with their
// sub-events, then any other events.
(function () {
  "use strict";

  var ORG_KEY = "sevak.organization.v1";
  var F = window.SevakForms;
  var $ = function (id) { return document.getElementById(id); };

  var CHARITY_LABELS = {
    "charity": "Registered charity or nonprofit",
    "nonprofit-other": "Nonprofit or tax-exempt",
    "pending": "Registration pending",
    "none": "Not registered"
  };

  function initials(name) {
    var words = name.replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter(Boolean);
    return ((words[0] || "")[0] || "").concat((words[1] || "")[0] || "").toUpperCase() || "?";
  }

  function countryName(code) {
    var c = F.countries.filter(function (x) { return x.code === code; })[0];
    return c ? c.name : "";
  }

  // The organization these events belong to, shown at the top of the page.
  function renderOrgContext(org) {
    var box = $("org-context");
    box.hidden = !org;
    if (!org) return;
    var name = org.name || "Your organization";
    $("org-avatar").textContent = initials(name);
    $("org-context-name").textContent = name;
    var a = org.address || {};
    var place = [a.city, countryName(a.country)].filter(Boolean).join(", ");
    $("org-context-details").textContent = [place, CHARITY_LABELS[org.taxStatus] || ""].filter(Boolean).join(" · ");
    $("org-context-details").hidden = !$("org-context-details").textContent;

    var badges = $("org-context-badges");
    badges.innerHTML = "";
    var verified = org.verificationStatus === "verified";
    badges.appendChild(window.SevakEvents.badge(verified ? "Verified" : "Not verified yet", verified ? "published" : "draft"));
    if (!verified) badges.lastChild.title = "Public events stay private until your organization is verified.";

    var site = $("org-context-website");
    site.hidden = !org.website;
    if (org.website) site.href = org.website;
  }

  function renderEvents() {
    var E = window.SevakEvents;
    var saved = !!F.load(ORG_KEY);
    $("create-buttons").hidden = !saved;
    $("no-org").hidden = saved;
    $("events").hidden = !saved;

    var events = E.all().slice().sort(E.byDate);
    var mains = E.allMain().slice().sort(function (a, b) {
      var ra = E.mainRange(a.id).start || "9999", rb = E.mainRange(b.id).start || "9999";
      return ra.localeCompare(rb) || (a.title || "").localeCompare(b.title || "");
    });
    var mainIds = {};
    mains.forEach(function (m) { mainIds[m.id] = true; });
    var standalone = events.filter(function (e) { return !e.mainEventId || !mainIds[e.mainEventId]; });

    $("events-empty").hidden = !saved || events.length > 0 || mains.length > 0;
    $("events-help").hidden = !saved || mains.length > 0;

    // Main events, each with its sub-events nested underneath.
    var groups = $("main-groups");
    groups.innerHTML = "";
    mains.forEach(function (main) {
      var subs = E.subEvents(main.id);
      var range = E.mainRange(main.id);
      var group = document.createElement("div");
      group.className = "main-group";

      var head = document.createElement("div");
      head.className = "main-head";
      var titleWrap = document.createElement("div");
      var h3 = document.createElement("h3");
      var link = document.createElement("a");
      link.href = "main-event.html?id=" + encodeURIComponent(main.id);
      link.textContent = main.title || "Untitled main event";
      h3.appendChild(link);
      var meta = document.createElement("p");
      meta.className = "event-meta";
      meta.textContent = ["Main event", E.plural(subs.length, "sub-event"),
        range.start ? E.rangeLabel(range.start, range.end) : ""].filter(Boolean).join(" · ");
      titleWrap.appendChild(h3);
      titleWrap.appendChild(meta);
      var add = document.createElement("a");
      add.className = "btn btn-secondary btn-small";
      add.href = "event.html?main=" + encodeURIComponent(main.id);
      add.textContent = "+ Sub-event";
      add.setAttribute("aria-label", "Add a sub-event to " + (main.title || "this main event"));
      head.appendChild(titleWrap);
      head.appendChild(add);
      group.appendChild(head);

      var list = document.createElement("ul");
      list.className = "event-list sub-list";
      subs.forEach(function (event) { list.appendChild(E.eventItem(event)); });
      group.appendChild(list);
      if (!subs.length) {
        var empty = document.createElement("p");
        empty.className = "empty";
        empty.textContent = "No sub-events yet.";
        group.appendChild(empty);
      }
      groups.appendChild(group);
    });

    // Events that aren't part of a main event.
    var list = $("event-list");
    list.innerHTML = "";
    standalone.forEach(function (event) { list.appendChild(E.eventItem(event)); });
    $("standalone-heading").hidden = !(mains.length && standalone.length);
  }

  renderOrgContext(F.load(ORG_KEY));
  renderEvents();
})();
