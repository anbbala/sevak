// Main event editor (prototype). A main event, such as a festival, groups
// sub-events, such as the performance and its rehearsals.
(function () {
  "use strict";

  var ORG_KEY = "sevak.organization.v1";
  var F = window.SevakForms;
  var E = window.SevakEvents;
  var form = document.getElementById("main-form");
  var $ = function (id) { return document.getElementById(id); };

  var org = F.load(ORG_KEY);
  var mainId = new URLSearchParams(location.search).get("id");
  var existing = mainId ? E.getMain(mainId) : null;

  function messageFor(input) {
    return F.basicMessage(input);
  }

  function updateCounter() {
    $("description-counter").textContent = $("description").value.length + " / " + $("description").maxLength;
  }

  function renderSubEvents() {
    var list = $("sub-list");
    list.innerHTML = "";
    $("add-sub").hidden = !mainId;
    $("subs-hint").hidden = !!mainId;
    $("delete-main").hidden = !mainId;
    if (!mainId) {
      $("subs-summary").textContent = "";
      return;
    }
    $("add-sub").href = "event.html?main=" + encodeURIComponent(mainId);
    var subs = E.subEvents(mainId);
    subs.forEach(function (event) { list.appendChild(E.eventItem(event)); });
    if (!subs.length) {
      $("subs-summary").textContent = "No sub-events yet. Add the first one, for example a rehearsal or the main performance.";
      return;
    }
    var range = E.mainRange(mainId);
    var published = subs.filter(function (e) { return e.status === "published"; }).length;
    $("subs-summary").textContent = [
      E.plural(subs.length, "sub-event"),
      range.start ? E.rangeLabel(range.start, range.end) : "",
      published + " published"
    ].filter(Boolean).join(" · ");
  }

  function applyTitle() {
    var title = $("title").value.trim();
    $("page-title").textContent = mainId ? title || "Untitled main event" : "New main event";
    document.title = (mainId ? title || "Main event" : "New main event") + " · Sevak";
  }

  F.clearErrorsAsYouType(form, messageFor);
  $("description").addEventListener("input", updateCounter);
  $("title").addEventListener("input", applyTitle);

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var firstInvalid = F.validate([$("title")], messageFor);
    if (firstInvalid) {
      $("status").textContent = "";
      firstInvalid.focus();
      return;
    }
    var now = new Date().toISOString();
    var main = {
      id: mainId || E.newId("main"),
      organizationName: org ? org.name : "",
      title: $("title").value.trim(),
      description: $("description").value.trim(),
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now
    };
    if (!E.saveMain(main)) {
      $("status").textContent = "Couldn't save in this browser. Check that site storage is allowed.";
      return;
    }
    var isNew = !mainId;
    mainId = main.id;
    existing = main;
    if (isNew) history.replaceState(null, "", "?id=" + encodeURIComponent(mainId));
    applyTitle();
    renderSubEvents();
    $("status").textContent = isNew ? "Saved. Now add its sub-events." : "Saved.";
  });

  $("delete-main").addEventListener("click", function () {
    var count = E.subEvents(mainId).length;
    var message = count
      ? "Delete this main event? Its " + E.plural(count, "sub-event") + " will be kept as separate events."
      : "Delete this main event? This can't be undone.";
    if (!window.confirm(message)) return;
    E.removeMain(mainId);
    location.href = "events.html";
  });

  // ---------- Start ----------

  if (!org || !org.name) {
    $("no-org").hidden = false;
    form.hidden = true;
    $("back-link").hidden = true;
    return;
  }
  $("org-name-crumb").textContent = "Events";

  if (mainId && !existing) {
    $("status").textContent = "We couldn't find that main event, so this is a new one.";
    mainId = null;
    history.replaceState(null, "", location.pathname);
  }
  if (existing) {
    $("title").value = existing.title || "";
    $("description").value = existing.description || "";
  }
  updateCounter();
  applyTitle();
  renderSubEvents();
})();
