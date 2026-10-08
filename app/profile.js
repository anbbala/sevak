// User profile (prototype). Data is kept in this browser only.
// A person can volunteer, be on one or more organizations' teams, or both.
// Teams aren't chosen here: you're on a team when you set up an
// organization or one of its Admins adds you (see SevakOrgs.roleFor).
(function () {
  "use strict";

  var STORAGE_KEY = "sevak.profile.v1";
  var MAX_AFFILIATIONS = 5;
  var SEEN_TEAMS_KEY = "sevak.seenTeams.v1";

  var form = document.getElementById("profile-form");
  var $ = function (id) { return document.getElementById(id); };
  var F = window.SevakForms;

  // ---------- User types ----------

  function isVolunteer() { return $("role-volunteer").checked; }

  function applyRoles() {
    $("volunteer-fields").hidden = !isVolunteer();
    // Affiliations (on the Get to know me tab) are for volunteers.
    $("affiliations-section").hidden = !isVolunteer();
    $("affiliations-note").hidden = isVolunteer();
  }

  form.querySelectorAll('input[name="roles"]').forEach(function (box) {
    box.addEventListener("change", function () {
      applyRoles();
    });
  });

  // ---------- Validation ----------

  function messageFor(input) {
    if (input.name === "roles") return "";
    return F.basicMessage(input);
  }

  function validateForm() {
    var fields = form.querySelectorAll("#role-volunteer, input[required], input[type=tel], input[type=email], [data-postal]");
    return F.validate(fields, messageFor);
  }

  // ---------- Repeating rows ----------

  var rowCounter = 0;

  // Clones a row template, gives each control a unique id wired to its label
  // and error message, and fills in saved values.
  function makeRow(template, prefix, value) {
    var row = template.content.firstElementChild.cloneNode(true);
    rowCounter += 1;
    row.querySelectorAll(".field").forEach(function (field) {
      var control = field.querySelector("[data-key]");
      control.id = prefix + "-" + control.dataset.key + "-" + rowCounter;
      field.querySelector("label").htmlFor = control.id;
      var error = field.querySelector(".error");
      if (error) error.id = control.id + "-error";
      if (value && value[control.dataset.key] != null) control.value = value[control.dataset.key];
    });
    return row;
  }

  function readRows(container) {
    return Array.prototype.map.call(container.children, function (row) {
      var data = {};
      row.querySelectorAll("[data-key]").forEach(function (el) { data[el.dataset.key] = el.value.trim(); });
      return data;
    }).filter(function (d) { return d.name; });
  }

  // ---------- Organization teams ----------
  // A read-only list of the teams you're on, each with Manage and Leave.

  function renderTeams() {
    var O = window.SevakOrgs;
    var profile = F.session.profile();
    var teams = O.myTeams();
    var list = $("team-list");
    list.innerHTML = "";
    teams.forEach(function (t) {
      var li = document.createElement("li");
      li.className = "team-item";
      var name = document.createElement("strong");
      name.textContent = t.org.name || "Untitled organization";
      var badge = document.createElement("span");
      badge.className = "badge" + (t.role === "admin" ? " badge-published" : "");
      badge.textContent = t.role === "admin" ? "Admin" : "Coordinator";
      var manage = document.createElement("a");
      manage.href = "events.html";
      manage.textContent = "Manage";
      manage.setAttribute("aria-label", "Manage " + (t.org.name || "this organization"));
      manage.addEventListener("click", function () { O.setCurrent(t.org.id); });
      var leave = document.createElement("button");
      leave.type = "button";
      leave.className = "btn btn-danger-link";
      leave.textContent = "Leave";
      leave.setAttribute("aria-label", "Leave the team of " + (t.org.name || "this organization"));
      leave.addEventListener("click", function () { leaveTeam(t.org); });
      [name, badge, manage, leave].forEach(function (x) { li.appendChild(x); });
      list.appendChild(li);
    });
    list.hidden = !teams.length;
    $("team-empty").hidden = teams.length > 0;
    $("join-email").textContent = profile ? profile.email : "your email";
    // Setting up an organization needs a saved profile: you become its Admin.
    var row = $("setup-org-row");
    if (profile && F.session.signedIn()) {
      row.innerHTML = '<strong>Run volunteer events for a group?</strong> <a href="organization.html?new=1" id="setup-org">Set up your organization</a> and you\'ll be its Admin.';
    } else {
      row.innerHTML = "<strong>Run volunteer events for a group?</strong> Save your profile first, then you can set up your organization and be its Admin.";
    }
  }

  // Signed in as … · Sign out (Sign out lives here, on Profile).
  function renderAccount() {
    var on = F.session.signedIn();
    $("account-line").hidden = !on;
    if (on) $("account-email").textContent = F.session.profile().email;
  }

  $("sign-out").addEventListener("click", function () {
    F.session.signOut();
    window.location.href = "../";
  });

  function leaveTeam(org) {
    var name = org.name || "this organization";
    if (!window.confirm("Leave the team of " + name + "? You won't be able to manage its events until an Admin adds you again.")) return;
    var result = window.SevakOrgs.leave(org.id);
    var messages = {
      "primary-contact": "You're the primary contact of " + name + ". Change its primary contact on the Organization page first.",
      "only-admin": "You're the only Admin of " + name + ". Make someone else an Admin on its Team tab first, or delete the organization."
    };
    if (!result.ok) {
      $("team-status").textContent = messages[result.reason] || "Couldn't leave the team. Please try again.";
      return;
    }
    // If an Admin adds you again later, you'll be told about it.
    var seen = F.load(SEEN_TEAMS_KEY);
    if (Array.isArray(seen)) F.store(SEEN_TEAMS_KEY, seen.filter(function (id) { return id !== org.id; }));
    renderTeams();
    window.SevakNav.render();
    $("team-status").textContent = "You've left the team of " + name + ".";
  }

  // ---------- Affiliations ----------

  var affiliationRows = $("affiliation-rows");

  function addAffiliation(value) {
    if (affiliationRows.children.length >= MAX_AFFILIATIONS) return null;
    var row = makeRow($("affiliation-template"), "affiliation", value);
    row.querySelector(".remove").addEventListener("click", function () {
      row.remove();
      updateAffiliationButton();
      $("add-affiliation").focus();
    });
    affiliationRows.appendChild(row);
    updateAffiliationButton();
    return row.querySelector('[data-key="name"]');
  }

  function updateAffiliationButton() {
    $("add-affiliation").hidden = affiliationRows.children.length >= MAX_AFFILIATIONS;
  }

  $("add-affiliation").addEventListener("click", function () {
    var input = addAffiliation();
    if (input) input.focus();
  });

  // ---------- About me ----------

  var ABOUT_FIELDS = ["aboutMe", "passion", "certifications", "howICanHelp"];

  function updateCounters() {
    ABOUT_FIELDS.forEach(function (id) {
      form.querySelector('[data-counter-for="' + id + '"]').textContent = $(id).value.length + " / " + $(id).maxLength;
    });
  }
  ABOUT_FIELDS.forEach(function (id) { $(id).addEventListener("input", updateCounters); });

  // ---------- Services ----------
  // Picking a service from the drop-down adds it to the list below; each
  // service can be chosen once and removed again.

  var serviceSelect = $("serviceSelect");
  var serviceList = $("service-list");

  function serviceLabel(value) {
    var option = serviceSelect.querySelector('option[value="' + value + '"]');
    return option ? option.textContent : value;
  }

  function services() {
    return Array.prototype.map.call(serviceList.children, function (li) { return li.dataset.value; });
  }

  function refreshServices() {
    var chosen = services();
    Array.prototype.forEach.call(serviceSelect.options, function (o) {
      if (o.value) o.disabled = chosen.indexOf(o.value) !== -1;
    });
    $("service-empty").hidden = chosen.length > 0;
    serviceList.hidden = !chosen.length;
  }

  function addService(value) {
    if (!value || services().indexOf(value) !== -1 || !serviceSelect.querySelector('option[value="' + value + '"]')) return;
    var li = document.createElement("li");
    li.className = "service-chip";
    li.dataset.value = value;
    var name = document.createElement("span");
    name.textContent = serviceLabel(value);
    var remove = document.createElement("button");
    remove.type = "button";
    remove.className = "service-remove";
    remove.setAttribute("aria-label", "Remove " + serviceLabel(value));
    remove.textContent = "✕";
    remove.addEventListener("click", function () {
      li.remove();
      refreshServices();
      serviceSelect.focus();
    });
    li.appendChild(name);
    li.appendChild(remove);
    serviceList.appendChild(li);
    refreshServices();
  }

  serviceSelect.addEventListener("change", function () {
    addService(serviceSelect.value);
    serviceSelect.value = "";
  });

  // ---------- Read / fill ----------

  function readForm() {
    var v = function (id) { return $(id).value.trim(); };
    var data = {
      firstName: v("firstName"),
      lastName: v("lastName"),
      email: v("email"),
      phone: F.phoneValue($("phone")),
      roles: { volunteer: isVolunteer(), host: window.SevakOrgs.myTeams().length > 0 },
      photo: photo.get(),
      aboutMe: v("aboutMe"),
      passion: v("passion"),
      certifications: v("certifications"),
      howICanHelp: v("howICanHelp"),
      services: services(),
      updatedAt: new Date().toISOString()
    };
    if (isVolunteer()) {
      var availability = form.querySelector('input[name="availability"]:checked');
      data.address = {
        country: $("country").value,
        line1: v("addressLine1"),
        line2: v("addressLine2"),
        city: v("city"),
        state: v("state"),
        postalCode: v("postalCode")
      };
      data.affiliations = readRows(affiliationRows);
      data.availability = availability ? availability.value : "";
    }
    return data;
  }

  function fill(data) {
    var set = function (id, value) { if (value != null) $(id).value = value; };
    set("firstName", data.firstName);
    set("lastName", data.lastName);
    set("email", data.email);
    F.setPhone($("phone"), data.phone);
    photo.set(data.photo || "");
    ABOUT_FIELDS.forEach(function (id) { set(id, data[id]); });
    (data.services || []).forEach(addService);
    // Profiles saved before user types existed were volunteer profiles.
    var roles = data.roles || { volunteer: true, host: false };
    $("role-volunteer").checked = !!roles.volunteer;
    if (data.address) {
      set("addressLine1", data.address.line1);
      set("addressLine2", data.address.line2);
      set("city", data.address.city);
      set("state", data.address.state);
      set("postalCode", data.address.postalCode || data.address.zip);
      if (data.address.country) $("country").value = data.address.country;
    }
    (data.affiliations || []).forEach(addAffiliation);
    if (data.availability) {
      var radio = form.querySelector('input[name="availability"][value="' + data.availability + '"]');
      if (radio) radio.checked = true;
    }
  }

  // ---------- Events ----------

  F.clearErrorsAsYouType(form, messageFor);

  // Marks the tabs that contain errors with a dot.
  function markTabErrors() {
    ["details", "about"].forEach(function (key) {
      var bad = !!$("panel-" + key).querySelector('[aria-invalid="true"]');
      $("tab-" + key).classList.toggle("has-error", bad);
      $("tab-" + key).querySelector(".tab-alert").textContent = bad ? " (needs attention)" : "";
    });
  }
  form.addEventListener("input", function () { setTimeout(markTabErrors, 0); });
  form.addEventListener("change", function () { setTimeout(markTabErrors, 0); });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var firstInvalid = validateForm();
    markTabErrors();
    if (firstInvalid) {
      // Show the tab with the first problem.
      var panel = firstInvalid.closest('[role="tabpanel"]');
      if (panel && panel.classList.contains("is-hidden")) {
        var key = tabs.show(panel.id.replace(/^panel-/, ""));
        history.replaceState(null, "", location.search + "#" + key);
      }
      $("status").textContent = "Please check the highlighted fields.";
      firstInvalid.focus();
      return;
    }
    var stored = F.store(STORAGE_KEY, readForm());
    // Saving your profile signs you in (see SevakForms.session).
    if (stored) F.session.signIn();
    $("status").textContent = stored
      ? "Profile saved on this device."
      : "Couldn't save in this browser. Check that site storage is allowed.";
    renderTeams();
    renderAccount();
    window.SevakNav.render();
  });

  $("delete-profile").addEventListener("click", function () {
    var docCount = window.SevakDocs.forOwner("profile").length;
    if (!window.confirm("Delete your profile" + (docCount ? " and your " + (docCount === 1 ? "document" : docCount + " documents") : "") +
      " from this device? This can't be undone.")) return;
    F.clear(STORAGE_KEY);
    window.SevakDocs.removeFor(["profile"]).then(docs.render);
    form.reset();
    $("role-volunteer").checked = true;
    $("country").value = F.defaultCountry();
    F.resetPhone($("phone"));
    affiliationRows.innerHTML = "";
    serviceList.innerHTML = "";
    photo.set("");
    refreshServices();
    updateCounters();
    updateAffiliationButton();
    applyRoles();
    renderTeams();
    renderAccount();
    window.SevakNav.render();
    $("status").textContent = "Profile deleted.";
  });

  // ---------- Start ----------

  F.fillCountrySelect($("country"));
  F.enhancePhone($("phone"));
  var photo = window.SevakPhoto.mount($("photo-field"));

  var existing = F.load(STORAGE_KEY);
  if (existing) fill(existing);
  else $("role-volunteer").checked = true;
  refreshServices();
  updateCounters();
  updateAffiliationButton();
  applyRoles();
  renderTeams();
  renderAccount();

  var docs = window.SevakDocs.mount($("panel-documents"), {
    owner: "profile",
    help: "Certificates, background checks, training records and anything else you want to keep handy. Only you can see these."
  });
  // Documents save on their own, so the profile's Save bar isn't shown there.
  var tabs = window.SevakDocs.pageTabs($("profile-tabs"), function (key) {
    $("save-bar").hidden = key === "documents";
  });
})();
