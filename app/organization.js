// Host organization profile (prototype). Data is kept in this browser only.
(function () {
  "use strict";

  var STORAGE_KEY = "sevak.organization.v1";
  var MAX_MEMBERS = 20;
  // Statuses where we ask for a registration number (always optional).
  var REGISTRATION_STATUSES = { "charity": true, "nonprofit-other": true, "pending": true };
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
    var basic = F.basicMessage(input);
    if (basic) return basic;

    if (input.id === "website" && v && !isValidWebsite(v)) {
      return "Enter a website address like example.org.";
    }
    if (input.id === "whatsappLink" && v && !isValidWhatsappLink(v)) {
      return "Enter a WhatsApp invite link (chat.whatsapp.com/…), channel link (whatsapp.com/channel/…) or wa.me link.";
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
    $("registration-field").hidden = !REGISTRATION_STATUSES[selectedTaxStatus()];
  }
  form.querySelectorAll('input[name="taxStatus"]').forEach(function (r) {
    r.addEventListener("change", applyTaxStatus);
  });

  // ---------- Open links in a new tab ----------

  // Shows a link under a URL field once what's typed is valid, so the host
  // can check it opens the right page.
  function updateOpenLink(inputId, isValid) {
    var input = $(inputId);
    var link = $(inputId + "-open");
    var v = input.value.trim();
    var url = v && isValid(v) ? normalizeUrl(v) : "";
    link.hidden = !url;
    if (!url) return;
    var u = new URL(url);
    var shown = (u.hostname + u.pathname + u.search).replace(/^www\./, "").replace(/\/$/, "");
    link.href = url;
    link.textContent = shown;
    link.setAttribute("aria-label", "Open " + shown + " in a new tab");
  }

  function updateOpenLinks() {
    updateOpenLink("website", isValidWebsite);
    updateOpenLink("whatsappLink", isValidWhatsappLink);
  }

  ["website", "whatsappLink"].forEach(function (id) {
    $(id).addEventListener("input", updateOpenLinks);
    $(id).addEventListener("change", updateOpenLinks);
  });

  // ---------- Fill in from website ----------

  var COUNTRY_ALIASES = {
    "usa": "US", "u.s.": "US", "u.s.a.": "US", "united states of america": "US",
    "uk": "GB", "great britain": "GB", "england": "GB", "scotland": "GB", "wales": "GB", "northern ireland": "GB",
    "uae": "AE"
  };

  // Matches a country code or name (English or the visitor's language) to an ISO code.
  function countryCode(value) {
    var v = (value || "").trim();
    if (!v) return "";
    var lower = v.toLowerCase();
    if (COUNTRY_ALIASES[lower]) return COUNTRY_ALIASES[lower];
    var english = {};
    (window.SevakCountryData || []).forEach(function (row) {
      var parts = row.split("|");
      english[parts[1].toLowerCase()] = parts[0];
    });
    if (english[lower]) return english[lower];
    var match = F.countries.filter(function (c) {
      return c.code.toLowerCase() === lower || c.name.toLowerCase() === lower;
    })[0];
    return match ? match.code : "";
  }

  function markFilled(el) {
    el.classList.add("filled");
    el.addEventListener("input", function () { el.classList.remove("filled"); }, { once: true });
    el.addEventListener("change", function () { el.classList.remove("filled"); }, { once: true });
  }

  // Fills only empty fields, so nothing the host typed is overwritten.
  // Returns the names of the fields it filled.
  function applyWebsiteDetails(details) {
    var filled = [];
    var fillText = function (id, value, label) {
      if (value && !$(id).value.trim()) {
        $(id).value = value;
        markFilled($(id));
        if (label && filled.indexOf(label) === -1) filled.push(label);
      }
    };
    fillText("description", details.description, "description");
    updateCounter();

    var a = details.address;
    var addressEmpty = ["addressLine1", "city", "state", "postalCode"].every(function (id) { return !$(id).value.trim(); });
    if (a && addressEmpty) {
      var code = countryCode(a.country);
      if (code && code !== $("country").value) {
        $("country").value = code;
        markFilled($("country"));
      }
      fillText("addressLine1", a.line1, "address");
      fillText("city", a.city, "address");
      fillText("state", a.state, "address");
      fillText("postalCode", a.postalCode, "address");
    }
    return filled;
  }

  function websiteUrl() {
    var v = $("website").value.trim();
    return v && isValidWebsite(v) ? normalizeUrl(v) : "";
  }

  function needsWebsiteDetails() {
    var addressEmpty = ["addressLine1", "city", "postalCode"].every(function (id) { return !$(id).value.trim(); });
    return !$("description").value.trim() || addressEmpty;
  }

  var lastFetched = "";

  function fillFromWebsite() {
    var url = websiteUrl();
    var status = $("fill-status");
    if (!url) return;
    lastFetched = url;
    $("fill-from-website").disabled = true;
    status.textContent = "Looking up " + new URL(url).hostname + "…";
    window.SevakWebsite.fetchDetails(url).then(function (details) {
      var filled = applyWebsiteDetails(details);
      if (filled.length) {
        status.textContent = "Filled in your " + filled.join(" and ") + " from your website. Please check them.";
      } else if (details.description || details.address) {
        status.textContent = "Your website's details match what's already here, so nothing changed.";
      } else {
        status.textContent = "We couldn't find a description or address on that page. Please fill them in.";
      }
    }).catch(function (e) {
      status.textContent = e.reason === "timeout"
        ? "That website took too long to respond. Please fill in the details yourself."
        : "We couldn't read that website from your browser. Many sites block this, so please fill in the details yourself.";
    }).finally(function () {
      $("fill-from-website").disabled = !websiteUrl();
    });
  }

  $("website").addEventListener("input", function () {
    $("fill-from-website").disabled = !websiteUrl();
  });
  $("fill-from-website").addEventListener("click", fillFromWebsite);
  // Look the website up automatically once, when it's first entered and
  // there are still details to fill.
  $("website").addEventListener("change", function () {
    var url = websiteUrl();
    if (url && url !== lastFetched && needsWebsiteDetails()) fillFromWebsite();
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
    var asks = !!REGISTRATION_STATUSES[status];
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

  // ---------- Event list ----------

  function renderEvents() {
    var E = window.SevakEvents;
    var saved = !!F.load(STORAGE_KEY);
    $("create-buttons").hidden = !saved;
    $("events-hint").hidden = saved;

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
    renderEvents();
  });

  $("delete-org").addEventListener("click", function () {
    if (!window.confirm("Delete this organization profile and its events from this device? This can't be undone.")) return;
    F.clear(STORAGE_KEY);
    window.SevakEvents.clearAll();
    form.reset();
    $("country").value = F.defaultCountry();
    F.resetPhone($("contactPhone"));
    memberRows.innerHTML = "";
    renumberMembers();
    applyTaxStatus();
    updateCounter();
    updateOpenLinks();
    $("status").textContent = "Organization profile deleted.";
    renderEvents();
  });

  // ---------- Start ----------

  F.fillCountrySelect($("country"));
  F.enhancePhone($("contactPhone"));

  var existing = F.load(STORAGE_KEY);
  if (existing) fill(existing);
  renumberMembers();
  applyTaxStatus();
  updateCounter();
  $("fill-from-website").disabled = !websiteUrl();
  lastFetched = websiteUrl();
  updateOpenLinks();
  renderEvents();
})();
