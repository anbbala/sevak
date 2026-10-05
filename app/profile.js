// Volunteer profile (prototype). Data is kept in this browser only.
(function () {
  "use strict";

  var STORAGE_KEY = "sevak.profile.v1";
  var MAX_AFFILIATIONS = 5;

  var form = document.getElementById("profile-form");
  var $ = function (id) { return document.getElementById(id); };

  // ---------- Storage ----------

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function store(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  }

  function clearStore() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
  }

  // ---------- Validation ----------

  function digitCount(value) {
    return (value.match(/\d/g) || []).length;
  }

  function setError(input, message) {
    var errorEl = $(input.id + "-error") || $(input.name + "-error");
    if (message) {
      input.setAttribute("aria-invalid", "true");
      if (errorEl) {
        errorEl.textContent = message;
        input.setAttribute("aria-describedby", errorEl.id);
      }
    } else {
      input.removeAttribute("aria-invalid");
      if (errorEl) errorEl.textContent = "";
    }
  }

  function messageFor(input) {
    var v = input.value.trim();

    if (input.type === "radio") {
      var group = form.querySelectorAll('input[name="' + input.name + '"]');
      var picked = Array.prototype.some.call(group, function (r) { return r.checked; });
      return picked ? "" : "Choose one option.";
    }
    if (input.required && !v) return "This field is required.";
    if (!v) return "";
    if (input.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      return "Enter an email address like name@example.com.";
    }
    if (input.type === "tel") {
      var digits = digitCount(v);
      if (!/^[0-9+().\-\s]+$/.test(v) || digits < 7 || digits > 15) {
        return "Enter a phone number with 7 to 15 digits.";
      }
    }
    if (input.id === "zip" && !/^\d{5}(-\d{4})?$/.test(v)) {
      return "Enter a 5-digit ZIP code.";
    }
    return "";
  }

  function validateForm() {
    var firstInvalid = null;
    var seenRadio = {};
    var inputs = form.querySelectorAll("input[required], input[type=tel], input[type=email], #zip");

    Array.prototype.forEach.call(inputs, function (input) {
      if (input.type === "radio") {
        if (seenRadio[input.name]) return;
        seenRadio[input.name] = true;
      }
      var msg = messageFor(input);
      setError(input, msg);
      if (msg && !firstInvalid) firstInvalid = input;
    });
    return firstInvalid;
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

  // Clear an error as soon as the field is fixed.
  form.addEventListener("input", function (e) {
    var t = e.target;
    if (t.getAttribute("aria-invalid") === "true" && !messageFor(t)) setError(t, "");
  });
  form.addEventListener("change", function (e) {
    var t = e.target;
    if (t.type === "radio") {
      var errorEl = $(t.name + "-error");
      if (errorEl) errorEl.textContent = "";
    }
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var firstInvalid = validateForm();
    if (firstInvalid) {
      $("status").textContent = "";
      firstInvalid.focus();
      return;
    }
    $("status").textContent = store(readForm())
      ? "Profile saved on this device."
      : "Couldn't save in this browser. Check that site storage is allowed.";
  });

  $("delete-profile").addEventListener("click", function () {
    if (!window.confirm("Delete your profile from this device? This can't be undone.")) return;
    clearStore();
    form.reset();
    affiliationRows.innerHTML = "";
    updateAffiliationButton();
    $("status").textContent = "Profile deleted.";
  });

  // ---------- Start ----------

  var existing = load();
  if (existing) fill(existing);
  updateAffiliationButton();
})();
