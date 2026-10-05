// Host organization profile (prototype). Data is kept in this browser only.
(function () {
  "use strict";

  var STORAGE_KEY = "sevak.organization.v1";
  var MAX_MEMBERS = 20;
  var DESCRIPTION_MIN = 40;
  // Statuses where we ask for an EIN, and whether it's required.
  var EIN_FOR_STATUS = { "501c3": true, "501c-other": true, "pending": false };

  var F = window.SevakForms;
  var form = document.getElementById("org-form");
  var $ = function (id) { return document.getElementById(id); };

  // ---------- Field helpers ----------

  function normalizeWebsite(value) {
    var v = value.trim();
    if (v && !/^https?:\/\//i.test(v)) v = "https://" + v;
    return v;
  }

  function isValidWebsite(value) {
    try {
      var url = new URL(value);
      return (url.protocol === "http:" || url.protocol === "https:") && url.hostname.indexOf(".") > 0;
    } catch (e) {
      return false;
    }
  }

  function formatEin(value) {
    var digits = value.replace(/\D/g, "");
    return digits.length === 9 ? digits.slice(0, 2) + "-" + digits.slice(2) : value.trim();
  }

  function selectedTaxStatus() {
    var checked = form.querySelector('input[name="taxStatus"]:checked');
    return checked ? checked.value : "";
  }

  // Every email on the profile must be unique, so each person gets their own login.
  function allEmailInputs() {
    return [$("contactEmail")].concat(Array.prototype.slice.call(form.querySelectorAll('[data-key="email"]')));
  }

  function messageFor(input) {
    var v = input.value.trim();
    if (input.id === "ein" && input.required && !v) return "Enter your 9-digit EIN.";
    var basic = F.basicMessage(input);
    if (basic) return basic;

    if (input.id === "website" && v && !isValidWebsite(normalizeWebsite(v))) {
      return "Enter a website address like example.org.";
    }
    if (input.id === "description" && v.length < DESCRIPTION_MIN) {
      return "Write at least " + DESCRIPTION_MIN + " characters so volunteers know who you are.";
    }
    if (input.id === "ein" && v && !/^\d{2}-?\d{7}$/.test(v)) {
      return "Enter 9 digits, like 12-3456789.";
    }
    if (input.type === "email" && v) {
      var lower = v.toLowerCase();
      var others = allEmailInputs().filter(function (el) { return el !== input; });
      var duplicate = others.some(function (el) { return el.value.trim().toLowerCase() === lower; });
      if (duplicate) return "Each person needs a different email address.";
    }
    return "";
  }

  // ---------- Description counter ----------

  function updateCounter() {
    var max = $("description").maxLength;
    $("description-counter").textContent = $("description").value.length + " / " + max;
  }
  $("description").addEventListener("input", updateCounter);

  // ---------- Tax status ----------

  function applyTaxStatus() {
    var status = selectedTaxStatus();
    var asksForEin = Object.prototype.hasOwnProperty.call(EIN_FOR_STATUS, status);
    $("ein-field").hidden = !asksForEin;
    $("ein").required = asksForEin && EIN_FOR_STATUS[status];
    var label = form.querySelector('label[for="ein"]');
    label.innerHTML = "Employer Identification Number (EIN)" +
      ($("ein").required ? "" : ' <span class="optional">(optional)</span>');
  }
  form.querySelectorAll('input[name="taxStatus"]').forEach(function (r) {
    r.addEventListener("change", applyTaxStatus);
  });

  // ---------- Team members ----------

  var memberRows = $("member-rows");
  var memberTemplate = $("member-template");
  var memberCounter = 0;

  function addMember(value) {
    if (memberRows.children.length >= MAX_MEMBERS) return null;
    memberCounter += 1;
    var card = memberTemplate.content.firstElementChild.cloneNode(true);

    // Give each field a unique id so labels and error messages connect.
    card.querySelectorAll(".field").forEach(function (field) {
      var control = field.querySelector("[data-key]");
      var id = "member-" + memberCounter + "-" + control.dataset.key;
      control.id = id;
      field.querySelector("label").htmlFor = id;
      var error = field.querySelector(".error");
      if (error) error.id = id + "-error";
    });

    if (value) {
      ["name", "role", "email", "phone"].forEach(function (key) {
        if (value[key] != null) card.querySelector('[data-key="' + key + '"]').value = value[key];
      });
    }

    card.querySelector(".remove").addEventListener("click", function () {
      card.remove();
      renumberMembers();
      $("add-member").focus();
    });

    memberRows.appendChild(card);
    renumberMembers();
    return card.querySelector('[data-key="name"]');
  }

  function renumberMembers() {
    Array.prototype.forEach.call(memberRows.children, function (card, i) {
      var title = "Team member " + (i + 1);
      card.querySelector("h3").textContent = title;
      card.querySelector(".remove").setAttribute("aria-label", "Remove " + title.toLowerCase());
    });
    $("add-member").hidden = memberRows.children.length >= MAX_MEMBERS;
  }

  function readMembers() {
    return Array.prototype.map.call(memberRows.children, function (card) {
      var get = function (key) { return card.querySelector('[data-key="' + key + '"]').value.trim(); };
      return { name: get("name"), role: get("role"), email: get("email"), phone: get("phone") };
    });
  }

  $("add-member").addEventListener("click", function () {
    var input = addMember();
    if (input) input.focus();
  });

  // ---------- Read / fill ----------

  function readForm() {
    var v = function (id) { return $(id).value.trim(); };
    var status = selectedTaxStatus();
    return {
      name: v("orgName"),
      website: v("website") ? normalizeWebsite(v("website")) : "",
      description: v("description"),
      address: {
        line1: v("addressLine1"),
        line2: v("addressLine2"),
        city: v("city"),
        state: v("state"),
        zip: v("zip")
      },
      taxStatus: status,
      ein: EIN_FOR_STATUS.hasOwnProperty(status) && v("ein") ? formatEin(v("ein")) : "",
      primaryContact: {
        name: v("contactName"),
        title: v("contactTitle"),
        email: v("contactEmail"),
        phone: v("contactPhone")
      },
      team: readMembers(),
      verificationStatus: "unverified",
      updatedAt: new Date().toISOString()
    };
  }

  function fill(data) {
    var set = function (id, value) { if (value != null) $(id).value = value; };
    set("orgName", data.name);
    set("website", data.website);
    set("description", data.description);
    if (data.address) {
      set("addressLine1", data.address.line1);
      set("addressLine2", data.address.line2);
      set("city", data.address.city);
      set("state", data.address.state);
      set("zip", data.address.zip);
    }
    if (data.taxStatus) {
      var radio = form.querySelector('input[name="taxStatus"][value="' + data.taxStatus + '"]');
      if (radio) radio.checked = true;
    }
    set("ein", data.ein);
    if (data.primaryContact) {
      set("contactName", data.primaryContact.name);
      set("contactTitle", data.primaryContact.title);
      set("contactEmail", data.primaryContact.email);
      set("contactPhone", data.primaryContact.phone);
    }
    (data.team || []).forEach(addMember);
  }

  // ---------- Events ----------

  F.clearErrorsAsYouType(form, messageFor);

  $("website").addEventListener("blur", function () {
    var v = $("website").value.trim();
    if (v) $("website").value = normalizeWebsite(v);
  });
  $("ein").addEventListener("blur", function () {
    $("ein").value = formatEin($("ein").value);
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    applyTaxStatus();
    var fields = form.querySelectorAll("input:not([type=radio]), textarea, input[name=taxStatus]");
    var firstInvalid = F.validate(fields, messageFor);
    if (firstInvalid) {
      $("status").textContent = "";
      firstInvalid.focus();
      return;
    }
    $("status").textContent = F.store(STORAGE_KEY, readForm())
      ? "Organization profile saved on this device."
      : "Couldn't save in this browser. Check that site storage is allowed.";
  });

  $("delete-org").addEventListener("click", function () {
    if (!window.confirm("Delete this organization profile from this device? This can't be undone.")) return;
    F.clear(STORAGE_KEY);
    form.reset();
    memberRows.innerHTML = "";
    renumberMembers();
    applyTaxStatus();
    updateCounter();
    $("status").textContent = "Organization profile deleted.";
  });

  // ---------- Start ----------

  var existing = F.load(STORAGE_KEY);
  if (existing) fill(existing);
  renumberMembers();
  applyTaxStatus();
  updateCounter();
})();
