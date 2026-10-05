// Organizations for the prototype, kept in this browser. A person can run
// several organizations; one of them is "current" and the Organization and
// Events tabs show that one. Events and main events record their
// organization in organizationId.
(function () {
  "use strict";

  var LIST_KEY = "sevak.organizations.v1";
  var CURRENT_KEY = "sevak.currentOrganization.v1";
  var LEGACY_KEY = "sevak.organization.v1";
  var EVENTS_KEY = "sevak.events.v1";
  var MAIN_KEY = "sevak.mainEvents.v1";

  var F = window.SevakForms;

  function newId() {
    return "org-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function all() {
    var list = F.load(LIST_KEY);
    return Array.isArray(list) ? list : [];
  }

  function get(id) {
    return all().filter(function (o) { return o.id === id; })[0] || null;
  }

  function currentId() {
    var id = F.load(CURRENT_KEY);
    if (id && get(id)) return id;
    var first = all()[0];
    return first ? first.id : null;
  }

  function current() {
    var id = currentId();
    return id ? get(id) : null;
  }

  function setCurrent(id) {
    return F.store(CURRENT_KEY, id);
  }

  // Saves an organization, giving it an id if it's new. Returns the saved
  // organization, or null if the browser wouldn't store it.
  function save(org) {
    var list = all();
    var saved = Object.assign({}, org, { id: org.id || newId() });
    var i = list.findIndex(function (o) { return o.id === saved.id; });
    if (i === -1) list.push(saved); else list[i] = saved;
    return F.store(LIST_KEY, list) ? saved : null;
  }

  // Deletes an organization with its events and main events.
  function remove(id) {
    var keep = function (x) { return x.organizationId !== id; };
    F.store(EVENTS_KEY, (F.load(EVENTS_KEY) || []).filter(keep));
    F.store(MAIN_KEY, (F.load(MAIN_KEY) || []).filter(keep));
    F.store(LIST_KEY, all().filter(function (o) { return o.id !== id; }));
    var next = all()[0];
    if (next) setCurrent(next.id); else F.clear(CURRENT_KEY);
  }

  // Moves data saved before multiple organizations were supported: the
  // single organization becomes the first in the list, and events and main
  // events without an organization are given the current one.
  function migrate() {
    var legacy = F.load(LEGACY_KEY);
    if (legacy && typeof legacy === "object" && !all().length) {
      var org = save(legacy);
      if (org) setCurrent(org.id);
    }
    if (legacy) F.clear(LEGACY_KEY);
    var id = currentId();
    if (!id) return;
    [EVENTS_KEY, MAIN_KEY].forEach(function (key) {
      var list = F.load(key);
      if (!Array.isArray(list) || list.every(function (x) { return x.organizationId; })) return;
      F.store(key, list.map(function (x) { return x.organizationId ? x : Object.assign({}, x, { organizationId: id }); }));
    });
  }

  // Draws the organization switcher: a picker of the person's
  // organizations and a "+ New organization" link. Switching reloads the
  // page; confirmLeave() can return false to cancel (e.g. unsaved changes).
  function renderSwitcher(container, opts) {
    opts = opts || {};
    container.innerHTML = "";
    var orgs = all().slice().sort(function (a, b) { return (a.name || "").localeCompare(b.name || ""); });
    var wrap = document.createElement("div");
    wrap.className = "org-switcher";

    if (orgs.length) {
      var label = document.createElement("label");
      label.htmlFor = "org-switch";
      label.textContent = "Organization";
      var select = document.createElement("select");
      select.id = "org-switch";
      orgs.forEach(function (o) {
        var option = document.createElement("option");
        option.value = o.id;
        option.textContent = o.name || "Untitled organization";
        select.appendChild(option);
      });
      if (opts.creating) {
        var draft = document.createElement("option");
        draft.value = "";
        draft.textContent = "New organization (unsaved)";
        select.appendChild(draft);
        select.value = "";
      } else {
        select.value = currentId() || "";
      }
      var previous = select.value;
      select.addEventListener("change", function () {
        if (opts.confirmLeave && !opts.confirmLeave()) { select.value = previous; return; }
        setCurrent(select.value);
        location.href = opts.switchTo || location.pathname;
      });
      wrap.appendChild(label);
      wrap.appendChild(select);
    }

    var add = document.createElement("a");
    add.className = "btn btn-secondary btn-small";
    add.href = (opts.newHref || "organization.html") + "?new=1";
    add.textContent = "+ New organization";
    add.hidden = !!opts.creating;
    add.addEventListener("click", function (e) {
      if (opts.confirmLeave && !opts.confirmLeave()) e.preventDefault();
    });
    wrap.appendChild(add);
    container.appendChild(wrap);
  }

  migrate();

  window.SevakOrgs = {
    all: all,
    get: get,
    current: current,
    currentId: currentId,
    setCurrent: setCurrent,
    save: save,
    remove: remove,
    renderSwitcher: renderSwitcher
  };
})();
