// Host organization profile (prototype). Data is kept in this browser only.
(function () {
  "use strict";

  var STORAGE_KEY = "sevak.organization.v1";
  var MAX_MEMBERS = 20;
  var DESCRIPTION_MIN = 40;
  // Statuses where we ask for a registration number, and whether it's required.
  var REGISTRATION_FOR_STATUS = { "charity": true, "nonprofit-other": false, "pending": false };
  // Status values saved before the form became country-neutral.
  var LEGACY_STATUS = { "501c3": "charity", "501c-other": "nonprofit-other" };

  var F = window.SevakForms;
  var form = document.getElementById("org-form");
  var $ = function (id) { return document.getElementById(id); };

  // ---------- Field helpers ----------

  function normalizeUrl(value) {
    var v = value.trim();
    if (v && !/^https?:\/\//i.test(v)) v = "https://" + v;
    return v;
  }

  function parseUrl(value) {
    try {
      var url = new URL(normalizeUrl(value));
      return url.protocol === "http:" || url.protocol === "https:" ? url : null;
    } catch (e) {
      return null;
    }
  }

  function isValidWebsite(value) {
    var url = parseUrl(value);
    return !!url && url.hostname.indexOf(".") > 0;
  }

  // Accepts WhatsApp group or community invites (chat.whatsapp.com/…),
  // channels (whatsapp.com/channel/…) and click-to-chat links (wa.me/…).
  function isValidWhatsappLink(value) {
    var url = parseUrl(value);
    if (!url) return false;
    var host = url.hostname.toLowerCase().replace(/^www\./, "");
    var path = url.pathname.replace(/\/+$/, "");
    if (host === "chat.whatsapp.com") return /^\/[A-Za-z0-9]{10,}$/.test(path);
    if (host === "whatsapp.com") return /^\/channel\/[A-Za-z0-9]{10,}$/.test(path);
    if (host === "wa.me") return /^\/\d{8,15}$/.test(path);
    return false;
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
    if (input.id === "registrationNumber" && input.required && !v) {
      return "Enter your registration number.";
    }
    var basic = F.basicMessage(input);
    if (basic) return basic;

    if (input.id === "website" && v && !isValidWebsite(v)) {
      return "Enter a website address like example.org.";
    }
    if (input.id === "whatsappLink" && v && !isValidWhatsappLink(v)) {
      return "Enter a WhatsApp invite link (chat.whatsapp.com/…), channel link (whatsapp.com/channel/…) or wa.me link.";
    }
    if (input.id === "description" && v.length < DESCRIPTION_MIN) {
      return "Write at least " + DESCRIPTION_MIN + " characters so volunteers know who you are.";
    }
    if (input.id === "registrationNumber" && v && !/^[A-Za-z0-9][A-Za-z0-9 \-\/.]{2,29}$/.test(v)) {
      return "Use letters, numbers, spaces, hyphens or slashes.";
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

  // ---------- Charity or nonprofit status ----------

  function applyTaxStatus() {
    var status = selectedTaxStatus();
    var asks = Object.prototype.hasOwnProperty.call(REGISTRATION_FOR_STATUS, status);
    $("registration-field").hidden = !asks;
    $("registrationNumber").required = asks && REGISTRATION_FOR_STATUS[status];
    var label = form.querySelector('label[for="registrationNumber"]');
    label.innerHTML = "Registration number" +
      ($("registrationNumber").required ? "" : ' <span class="optional">(optional)</span>');
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

    card.querySelector(".remove").addEventListener("click", function () {
      card.remove();
      renumberMembers();
      $("add-member").focus();
    });

    memberRows.appendChild(card);
    var phone = card.querySelector('[data-key="phone"]');
    F.enhancePhone(phone);

    if (value) {
      ["name", "role", "email"].forEach(function (key) {
        if (value[key] != null) card.querySelector('[data-key="' + key + '"]').value = value[key];
      });
      F.setPhone(phone, value.phone);
    }

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
      return {
        name: get("name"),
        role: get("role"),
        email: get("email"),
        phone: F.phoneValue(card.querySelector('[data-key="phone"]'))
      };
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
    var asks = Object.prototype.hasOwnProperty.call(REGISTRATION_FOR_STATUS, status);
    return {
      name: v("orgName"),
      website: v("website") ? normalizeUrl(v("website")) : "",
      whatsappLink: v("whatsappLink") ? normalizeUrl(v("whatsappLink")) : "",
      description: v("description"),
      address: {
        country: $("country").value,
        line1: v("addressLine1"),
        line2: v("addressLine2"),
        city: v("city"),
        state: v("state"),
        postalCode: v("postalCode")
      },
      taxStatus: status,
      registrationNumber: asks ? v("registrationNumber") : "",
      primaryContact: {
        name: v("contactName"),
        title: v("contactTitle"),
        email: v("contactEmail"),
        phone: F.phoneValue($("contactPhone"))
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
    set("whatsappLink", data.whatsappLink);
    set("description", data.description);
    if (data.address) {
      if (data.address.country) $("country").value = data.address.country;
      set("addressLine1", data.address.line1);
      set("addressLine2", data.address.line2);
      set("city", data.address.city);
      set("state", data.address.state);
      set("postalCode", data.address.postalCode || data.address.zip);
    }
    var status = LEGACY_STATUS[data.taxStatus] || data.taxStatus;
    if (status) {
      var radio = form.querySelector('input[name="taxStatus"][value="' + status + '"]');
      if (radio) radio.checked = true;
    }
    set("registrationNumber", data.registrationNumber || data.ein);
    if (data.primaryContact) {
      set("contactName", data.primaryContact.name);
      set("contactTitle", data.primaryContact.title);
      set("contactEmail", data.primaryContact.email);
      F.setPhone($("contactPhone"), data.primaryContact.phone);
    }
    (data.team || []).forEach(addMember);
  }

  // ---------- Events ----------

  F.clearErrorsAsYouType(form, messageFor);

  ["website", "whatsappLink"].forEach(function (id) {
    $(id).addEventListener("blur", function () {
      var v = $(id).value.trim();
      if (v) $(id).value = normalizeUrl(v);
    });
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    applyTaxStatus();
    var fields = form.querySelectorAll("input:not([type=radio]):not([type=checkbox]), select#country, textarea, input[name=taxStatus]");
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
    $("country").value = F.defaultCountry();
    F.resetPhone($("contactPhone"));
    memberRows.innerHTML = "";
    renumberMembers();
    applyTaxStatus();
    updateCounter();
    $("status").textContent = "Organization profile deleted.";
  });

  // ---------- Start ----------

  F.fillCountrySelect($("country"));
  F.enhancePhone($("contactPhone"));

  var existing = F.load(STORAGE_KEY);
  if (existing) fill(existing);
  renumberMembers();
  applyTaxStatus();
  updateCounter();
})();
