// Volunteer profile (prototype). Data is kept in this browser only.
(function () {
  "use strict";

  var STORAGE_KEY = "sevak.profile.v1";
  var MAX_AFFILIATIONS = 5;

  var form = document.getElementById("profile-form");
  var $ = function (id) { return document.getElementById(id); };

  var F = window.SevakForms;

  function messageFor(input) {
    return F.basicMessage(input);
  }

  function validateForm() {
    return F.validate(form.querySelectorAll("input[required], input[type=tel], input[type=email], [data-zip]"), messageFor);
  }

  // ---------- Affiliations ----------

  var affiliationRows = $("affiliation-rows");
  var affiliationTemplate = $("affiliation-template");
  var rowCounter = 0;

  function addAffiliation(value) {
    if (affiliationRows.children.length >= MAX_AFFILIATIONS) return;
    var row = affiliationTemplate.content.firstElementChild.cloneNode(true);
    rowCounter += 1;
    var labels = row.querySelectorAll("label");
    var select = row.querySelector('[data-key="type"]');
    var input = row.querySelector('[data-key="name"]');
    select.id = "affiliation-type-" + rowCounter;
    input.id = "affiliation-name-" + rowCounter;
    labels[0].htmlFor = select.id;
    labels[1].htmlFor = input.id;
    if (value) {
      select.value = value.type || "other";
      input.value = value.name || "";
    }
    row.querySelector(".remove").addEventListener("click", function () {
      row.remove();
      updateAffiliationButton();
      $("add-affiliation").focus();
    });
    affiliationRows.appendChild(row);
    updateAffiliationButton();
    return input;
  }

  function updateAffiliationButton() {
    $("add-affiliation").hidden = affiliationRows.children.length >= MAX_AFFILIATIONS;
  }

  function readAffiliations() {
    return Array.prototype.map.call(affiliationRows.children, function (row) {
      return {
        type: row.querySelector('[data-key="type"]').value,
        name: row.querySelector('[data-key="name"]').value.trim()
      };
    }).filter(function (a) { return a.name; });
  }

  $("add-affiliation").addEventListener("click", function () {
    var input = addAffiliation();
    if (input) input.focus();
  });

  // ---------- Read / fill ----------

  function readForm() {
    var v = function (id) { return $(id).value.trim(); };
    var availability = form.querySelector('input[name="availability"]:checked');
    return {
      firstName: v("firstName"),
      lastName: v("lastName"),
      email: v("email"),
      phone: v("phone"),
      address: {
        line1: v("addressLine1"),
        line2: v("addressLine2"),
        city: v("city"),
        state: v("state"),
        zip: v("zip")
      },
      affiliations: readAffiliations(),
      availability: availability ? availability.value : "",
      updatedAt: new Date().toISOString()
    };
  }

  function fill(data) {
    var set = function (id, value) { if (value != null) $(id).value = value; };
    set("firstName", data.firstName);
    set("lastName", data.lastName);
    set("email", data.email);
    set("phone", data.phone);
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
    updateAffiliationButton();
    $("status").textContent = "Profile deleted.";
  });

  // ---------- Start ----------

  var existing = F.load(STORAGE_KEY);
  if (existing) fill(existing);
  updateAffiliationButton();
})();
