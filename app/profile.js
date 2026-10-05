// Volunteer profile (prototype). Data is kept in this browser only.
(function () {
  "use strict";

  var STORAGE_KEY = "sevak.profile.v1";
  var MIN_SELF_AGE = 13;
  var ADULT_AGE = 18;
  var MAX_AFFILIATIONS = 5;

  var form = document.getElementById("profile-form");
  var $ = function (id) { return document.getElementById(id); };

  var sections = {
    under13: $("under13"),
    rest: $("profile-rest"),
    guardian: $("guardian-section"),
    address: $("address-section"),
    teenCity: $("teen-city-section"),
    children: $("children-section")
  };

  var children = [];
  var mode = "unknown";

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

  // ---------- Age ----------

  function ageOn(dobString, today) {
    if (!dobString) return null;
    var parts = dobString.split("-").map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return null;
    var age = today.getFullYear() - parts[0];
    var beforeBirthday = today.getMonth() + 1 < parts[1] ||
      (today.getMonth() + 1 === parts[1] && today.getDate() < parts[2]);
    return beforeBirthday ? age - 1 : age;
  }

  function todayString() {
    var d = new Date();
    var pad = function (n) { return String(n).padStart(2, "0"); };
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function modeForAge(age) {
    if (age === null || age < 0 || age > 120) return "unknown";
    if (age < MIN_SELF_AGE) return "child";
    if (age < ADULT_AGE) return "teen";
    return "adult";
  }

  function applyMode() {
    var age = ageOn($("dob").value, new Date());
    mode = modeForAge(age);

    var isChild = mode === "child";
    var isTeen = mode === "teen";

    sections.under13.hidden = !isChild;
    sections.rest.hidden = isChild;
    $("save").disabled = isChild;

    // Disabled fieldsets are skipped by validation and by saving.
    sections.guardian.hidden = !isTeen;
    sections.guardian.disabled = !isTeen;
    sections.address.hidden = isTeen;
    sections.address.disabled = isTeen;
    sections.teenCity.hidden = !isTeen;
    sections.teenCity.disabled = !isTeen;
    sections.children.hidden = isTeen;

    // Phone is optional for teens because their guardian's phone is required.
    $("phone").required = !isTeen;
    $("phone-optional").hidden = !isTeen;
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

  function isActive(el) {
    return !el.disabled && !el.closest("[hidden]") && !el.closest("fieldset:disabled");
  }

  function messageFor(input) {
    var v = input.value.trim();

    if (input.type === "radio") {
      var group = form.querySelectorAll('input[name="' + input.name + '"]');
      var picked = Array.prototype.some.call(group, function (r) { return r.checked; });
      return picked ? "" : "Choose one option.";
    }
    if (input.type === "checkbox") {
      return input.required && !input.checked ? "Please confirm to continue." : "";
    }
    if (input.required && !v) {
      return input.tagName === "SELECT" ? "Choose an option." : "This field is required.";
    }
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
    if (input.id === "dob") {
      if (v > todayString()) return "Date of birth can't be in the future.";
      if (modeForAge(ageOn(v, new Date())) === "unknown") return "Enter a valid date of birth.";
    }
    if (input.id === "guardianEmail" && v.toLowerCase() === $("email").value.trim().toLowerCase()) {
      return "Use your parent or guardian's own email, not yours.";
    }
    return "";
  }

  function validateForm() {
    var firstInvalid = null;
    var seenRadio = {};
    var inputs = form.querySelectorAll("input[required], select[required], input[type=tel], input[type=email], #zip, #dob");

    Array.prototype.forEach.call(inputs, function (input) {
      if (!isActive(input)) { setError(input, ""); return; }
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

  // ---------- Children ----------

  var childList = $("child-list");
  var childForm = $("child-form");

  function renderChildren() {
    childList.innerHTML = "";
    children.forEach(function (child) {
      var age = ageOn(child.dob, new Date());
      var li = document.createElement("li");
      li.className = "child-card";

      var info = document.createElement("div");
      var name = document.createElement("strong");
      name.textContent = child.name;
      var meta = document.createElement("small");
      meta.textContent = "Age " + age + (child.affiliation ? " · " + child.affiliation : "");
      info.appendChild(name);
      info.appendChild(meta);

      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "btn btn-danger-link";
      remove.textContent = "Remove";
      remove.setAttribute("aria-label", "Remove " + child.name);
      remove.addEventListener("click", function () {
        children = children.filter(function (c) { return c.id !== child.id; });
        renderChildren();
        $("show-child-form").focus();
      });

      li.appendChild(info);
      li.appendChild(remove);
      childList.appendChild(li);
    });
  }

  function resetChildForm() {
    ["childName", "childDob", "childAffiliation"].forEach(function (id) { $(id).value = ""; setError($(id), ""); });
    $("childConsent").checked = false;
    setError($("childConsent"), "");
  }

  $("show-child-form").addEventListener("click", function () {
    childForm.hidden = false;
    $("show-child-form").hidden = true;
    $("childName").focus();
  });

  $("cancel-child").addEventListener("click", function () {
    resetChildForm();
    childForm.hidden = true;
    $("show-child-form").hidden = false;
    $("show-child-form").focus();
  });

  $("add-child").addEventListener("click", function () {
    var name = $("childName").value.trim();
    var dob = $("childDob").value;
    var age = ageOn(dob, new Date());
    var errors = {
      childName: name ? "" : "Enter your child's name.",
      childDob: !dob ? "Enter your child's date of birth." :
        dob > todayString() || age === null || age < 0 ? "Enter a valid date of birth." :
        age >= ADULT_AGE ? "This person is 18 or older and needs their own profile." : "",
      childConsent: $("childConsent").checked ? "" : "Please confirm you're the parent or legal guardian."
    };
    var first = null;
    Object.keys(errors).forEach(function (id) {
      setError($(id), errors[id]);
      if (errors[id] && !first) first = $(id);
    });
    if (first) { first.focus(); return; }

    children.push({
      id: String(Date.now()),
      name: name,
      dob: dob,
      affiliation: $("childAffiliation").value.trim(),
      consentAt: new Date().toISOString()
    });
    renderChildren();
    resetChildForm();
    childForm.hidden = true;
    $("show-child-form").hidden = false;
    $("show-child-form").focus();
    $("status").textContent = "Child added. Save your profile to keep the change.";
  });

  // ---------- Read / fill ----------

  function readForm() {
    var v = function (id) { return $(id).value.trim(); };
    var availability = form.querySelector('input[name="availability"]:checked');
    var data = {
      firstName: v("firstName"),
      lastName: v("lastName"),
      email: v("email"),
      phone: v("phone"),
      dob: v("dob"),
      affiliations: readAffiliations(),
      availability: availability ? availability.value : "",
      updatedAt: new Date().toISOString()
    };
    if (mode === "teen") {
      data.city = v("teenCity");
      data.guardian = {
        name: v("guardianName"),
        relationship: v("guardianRelationship"),
        email: v("guardianEmail"),
        phone: v("guardianPhone"),
        acknowledgedAt: new Date().toISOString(),
        confirmedAt: null // Set when the guardian confirms by email (backend).
      };
    } else {
      data.address = {
        line1: v("addressLine1"),
        line2: v("addressLine2"),
        city: v("city"),
        state: v("state"),
        zip: v("zip")
      };
      data.children = children;
    }
    return data;
  }

  function fill(data) {
    var set = function (id, value) { if (value != null) $(id).value = value; };
    set("firstName", data.firstName);
    set("lastName", data.lastName);
    set("email", data.email);
    set("phone", data.phone);
    set("dob", data.dob);
    if (data.address) {
      set("addressLine1", data.address.line1);
      set("addressLine2", data.address.line2);
      set("city", data.address.city);
      set("state", data.address.state);
      set("zip", data.address.zip);
    }
    if (data.guardian) {
      set("guardianName", data.guardian.name);
      set("guardianRelationship", data.guardian.relationship);
      set("guardianEmail", data.guardian.email);
      set("guardianPhone", data.guardian.phone);
      $("guardianAware").checked = true;
      set("teenCity", data.city);
    }
    (data.affiliations || []).forEach(addAffiliation);
    if (data.availability) {
      var radio = form.querySelector('input[name="availability"][value="' + data.availability + '"]');
      if (radio) radio.checked = true;
    }
    children = Array.isArray(data.children) ? data.children : [];
    renderChildren();
  }

  // ---------- Events ----------

  $("dob").max = todayString();
  $("childDob").max = todayString();

  $("dob").addEventListener("change", function () {
    applyMode();
    setError($("dob"), messageFor($("dob")));
  });

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
    applyMode();
    if (mode === "child") return;
    var firstInvalid = validateForm();
    if (firstInvalid) {
      $("status").textContent = "";
      firstInvalid.focus();
      return;
    }
    var saved = store(readForm());
    $("status").textContent = saved
      ? (mode === "teen"
          ? "Profile saved. When Sevak launches, we'll email your parent or guardian to confirm."
          : "Profile saved on this device.")
      : "Couldn't save in this browser. Check that site storage is allowed.";
  });

  $("delete-profile").addEventListener("click", function () {
    if (!window.confirm("Delete your profile from this device? This can't be undone.")) return;
    clearStore();
    form.reset();
    affiliationRows.innerHTML = "";
    children = [];
    renderChildren();
    updateAffiliationButton();
    applyMode();
    $("status").textContent = "Profile deleted.";
  });

  // ---------- Start ----------

  var existing = load();
  if (existing) fill(existing);
  if (!affiliationRows.children.length) updateAffiliationButton();
  applyMode();
})();
