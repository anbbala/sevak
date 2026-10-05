// User profile (prototype). Data is kept in this browser only.
// A person can be a volunteer, a host team member, or both. Host team members
// can belong to several organizations with a different role in each.
(function () {
  "use strict";

  var STORAGE_KEY = "sevak.profile.v1";
  var ORG_STORAGE_KEY = "sevak.organization.v1";
  var MAX_AFFILIATIONS = 5;
  var MAX_ORGS = 10;

  var form = document.getElementById("profile-form");
  var $ = function (id) { return document.getElementById(id); };
  var F = window.SevakForms;

  // ---------- User types ----------

  function isVolunteer() { return $("role-volunteer").checked; }
  function isHost() { return $("role-host").checked; }

  function applyRoles() {
    $("volunteer-fields").hidden = !isVolunteer();
    $("host-fields").hidden = !isHost();
    if (isHost() && !orgRows.children.length) addOrg();
  }

  form.querySelectorAll('input[name="roles"]').forEach(function (box) {
    box.addEventListener("change", function () {
      applyRoles();
      if (isVolunteer() || isHost()) F.setError($("role-volunteer"), "");
    });
  });

  // ---------- Validation ----------

  function messageFor(input) {
    if (input.name === "roles") {
      return isVolunteer() || isHost() ? "" : "Choose at least one.";
    }
    var basic = F.basicMessage(input);
    if (basic) return basic;
    if (input.dataset.key === "name" && input.closest("#org-rows")) {
      var name = input.value.trim().toLowerCase();
      var duplicate = Array.prototype.some.call(orgRows.querySelectorAll('[data-key="name"]'), function (el) {
        return el !== input && el.value.trim().toLowerCase() === name;
      });
      if (duplicate) return "You've already added this organization.";
    }
    return "";
  }

  function validateForm() {
    var fields = form.querySelectorAll("#role-volunteer, input[required], input[type=tel], input[type=email], [data-zip]");
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

  // ---------- Host organizations ----------

  var orgRows = $("org-rows");

  function addOrg(value) {
    if (orgRows.children.length >= MAX_ORGS) return null;
    var row = makeRow($("org-template"), "org", value);
    row.querySelector(".remove").addEventListener("click", function () {
      row.remove();
      updateOrgButton();
      $("add-org").focus();
    });
    orgRows.appendChild(row);
    updateOrgButton();
    return row.querySelector('[data-key="name"]');
  }

  function updateOrgButton() {
    $("add-org").hidden = orgRows.children.length >= MAX_ORGS;
    // Keep at least one row while "Host team member" is selected.
    var only = orgRows.children.length === 1;
    orgRows.querySelectorAll(".remove").forEach(function (btn) { btn.hidden = only; });
  }

  $("add-org").addEventListener("click", function () {
    var input = addOrg();
    if (input) input.focus();
  });

  // Suggest the organization saved on the organization profile page, if any.
  var savedOrg = F.load(ORG_STORAGE_KEY);
  if (savedOrg && savedOrg.name) {
    var option = document.createElement("option");
    option.value = savedOrg.name;
    $("known-orgs").appendChild(option);
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

  // ---------- Read / fill ----------

  function readForm() {
    var v = function (id) { return $(id).value.trim(); };
    var data = {
      firstName: v("firstName"),
      lastName: v("lastName"),
      email: v("email"),
      phone: v("phone"),
      roles: { volunteer: isVolunteer(), host: isHost() },
      updatedAt: new Date().toISOString()
    };
    if (isHost()) {
      data.organizations = readRows(orgRows);
    }
    if (isVolunteer()) {
      var availability = form.querySelector('input[name="availability"]:checked');
      data.address = {
        line1: v("addressLine1"),
        line2: v("addressLine2"),
        city: v("city"),
        state: v("state"),
        zip: v("zip")
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
    set("phone", data.phone);
    // Profiles saved before user types existed were volunteer profiles.
    var roles = data.roles || { volunteer: true, host: false };
    $("role-volunteer").checked = !!roles.volunteer;
    $("role-host").checked = !!roles.host;
    (data.organizations || []).forEach(addOrg);
    if (data.address) {
      set("addressLine1", data.address.line1);
      set("addressLine2", data.address.line2);
      set("city", data.address.city);
      set("state", data.address.state);
      set("zip", data.address.zip);
    }
    (data.affiliations || []).forEach(addAffiliation);
    if (data.availability) {
      var radio = form.querySelector('input[name="availability"][value="' + data.availability + '"]');
      if (radio) radio.checked = true;
    }
  }

  // ---------- Events ----------

  F.clearErrorsAsYouType(form, messageFor);

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var firstInvalid = validateForm();
    if (firstInvalid) {
      $("status").textContent = "";
      firstInvalid.focus();
      return;
    }
    $("status").textContent = F.store(STORAGE_KEY, readForm())
      ? "Profile saved on this device."
      : "Couldn't save in this browser. Check that site storage is allowed.";
  });

  $("delete-profile").addEventListener("click", function () {
    if (!window.confirm("Delete your profile from this device? This can't be undone.")) return;
    F.clear(STORAGE_KEY);
    form.reset();
    affiliationRows.innerHTML = "";
    orgRows.innerHTML = "";
    updateAffiliationButton();
    updateOrgButton();
    applyRoles();
    $("status").textContent = "Profile deleted.";
  });

  // ---------- Start ----------

  var existing = F.load(STORAGE_KEY);
  if (existing) fill(existing);
  updateAffiliationButton();
  updateOrgButton();
  applyRoles();
})();
