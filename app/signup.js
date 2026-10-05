// Volunteer sign-up (prototype). Three views on one page:
//   signup.html                    → upcoming events looking for volunteers
//   signup.html?event=ID           → one event: pick shifts and sign up
//   signup.html?registration=ID    → "manage my sign-up": see and cancel shifts
(function () {
  "use strict";

  var PROFILE_KEY = "sevak.profile.v1";
  var F = window.SevakForms;
  var O = window.SevakOrgs;
  var E = window.SevakEvents;
  var S = window.SevakSignups;
  var $ = function (id) { return document.getElementById(id); };
  var params = new URLSearchParams(location.search);

  // ---------- Helpers ----------

  function todayString() {
    var d = new Date();
    var pad = function (n) { return String(n).padStart(2, "0"); };
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function countryName(code) {
    var c = F.countries.filter(function (x) { return x.code === code; })[0];
    return c ? c.name : "";
  }

  function isVerified(org) {
    return !!org && org.verificationStatus === "verified";
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  // Every shift of an event, with its role, sorted by day and time.
  function allShifts(event) {
    var list = [];
    (event.roles || []).forEach(function (role) {
      (role.shifts || []).forEach(function (shift) {
        list.push({ id: shift.id, date: shift.date, start: shift.start, end: shift.end, capacity: Number(shift.capacity) || 0, role: role });
      });
    });
    return list.sort(function (a, b) { return (a.date + a.start + (a.role.name || "")).localeCompare(b.date + b.start + (b.role.name || "")); });
  }

  function spotsLeft(event) {
    var counts = S.countsByShift(event.id);
    return allShifts(event).reduce(function (n, s) { return n + Math.max(0, s.capacity - (counts[s.id] || 0)); }, 0);
  }

  function shiftLabel(s) {
    return E.dayLabel(s.date) + " · " + E.timeLabel(s.start) + "–" + E.timeLabel(s.end) + " · " + (s.role.name || "Role");
  }

  function placeText(event) {
    var loc = event.location || {};
    if (loc.type === "online") return "Online";
    return [loc.venue, loc.line1, loc.city, loc.state, countryName(loc.country)].filter(Boolean).join(", ");
  }

  function showOnly(id) {
    ["discover-view", "event-view", "confirm-view"].forEach(function (v) { $(v).hidden = v !== id; });
  }

  function showNotice(html) {
    var n = $("notice");
    n.innerHTML = "";
    html.forEach(function (part) { n.appendChild(part); });
    n.hidden = false;
  }

  // ---------- Find events ----------

  function discoverItem(event) {
    var org = O.get(event.organizationId);
    var li = el("li", "event-item");
    var info = el("div");
    var h3 = el("h3");
    var link = el("a", null, event.title || "Untitled event");
    link.href = "signup.html?event=" + encodeURIComponent(event.id);
    h3.appendChild(link);
    info.appendChild(el("p", "bar-parent", org ? org.name : ""));
    info.appendChild(h3);
    info.appendChild(el("p", "event-meta", [E.rangeLabel(event.startDate, event.endDate), placeText(event)].filter(Boolean).join(" · ")));
    var left = spotsLeft(event);
    var side = el("div", "badges");
    side.appendChild(left ? E.badge(E.plural(left, "spot") + " left", "published") : E.badge("Full"));
    li.appendChild(info);
    li.appendChild(side);
    return li;
  }

  function renderDiscover() {
    showOnly("discover-view");
    document.title = "Volunteer opportunities · Sevak";
    var today = todayString();
    var events = E.all().filter(function (e) {
      return e.status === "published" && e.visibility !== "private" && e.startDate && (e.endDate || e.startDate) >= today;
    }).sort(E.byDate);
    var listed = events.filter(function (e) { return isVerified(O.get(e.organizationId)); });
    var preview = events.filter(function (e) { return !isVerified(O.get(e.organizationId)); });

    var list = $("discover-list");
    list.innerHTML = "";
    listed.forEach(function (e) { list.appendChild(discoverItem(e)); });
    if (preview.length) {
      var head = el("li", "list-heading", "Preview: not listed publicly yet");
      head.appendChild(el("span", "hint", " These organizations aren't verified yet, so their events are only reachable by link until they are."));
      list.appendChild(head);
      preview.forEach(function (e) { list.appendChild(discoverItem(e)); });
    }
    $("discover-empty").hidden = events.length > 0;
  }

  // ---------- One event ----------

  var event = null;
  var shifts = [];
  var canSignUp = false;

  function renderEventHeader() {
    var org = O.get(event.organizationId);
    var host = $("host-line");
    host.innerHTML = "";
    host.appendChild(document.createTextNode("Hosted by "));
    host.appendChild(el("strong", null, org ? org.name : "an organization"));
    host.appendChild(document.createTextNode(" "));
    host.appendChild(isVerified(org) ? E.badge("Verified", "published") : E.badge("Not verified yet"));

    var main = event.mainEventId ? E.getMain(event.mainEventId) : null;
    $("main-line").hidden = !main;
    if (main) $("main-line").textContent = main.title || "Main event";
    $("event-title").textContent = event.title || "Untitled event";
    document.title = (event.title || "Event") + " · Sevak";

    var facts = $("event-facts");
    facts.innerHTML = "";
    facts.appendChild(el("li", null, E.rangeLabel(event.startDate, event.endDate)));
    var loc = event.location || {};
    if (loc.type === "online") {
      facts.appendChild(el("li", null, "Online. The meeting link is shared with volunteers who sign up."));
    } else if (placeText(event)) {
      facts.appendChild(el("li", null, placeText(event)));
    }
    var local = "";
    try { local = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { /* ignore */ }
    if (event.timezone && event.timezone !== local) {
      facts.appendChild(el("li", null, "Times are in " + event.timezone.replace(/_/g, " ") + " time"));
    }
    $("event-description").hidden = !event.description;
    $("event-description").textContent = event.description || "";
  }

  function renderShifts() {
    var counts = S.countsByShift(event.id);
    var today = todayString();
    var selected = selectedIds();
    var groups = $("shift-groups");
    groups.innerHTML = "";
    var byDay = {};
    shifts.forEach(function (s) { (byDay[s.date] = byDay[s.date] || []).push(s); });

    Object.keys(byDay).sort().forEach(function (date) {
      var group = el("div", "day-group");
      group.appendChild(el("h3", "day-title", E.dayLabel(date, { weekday: "long", year: "numeric" })));
      var list = el("ul", "shift-choices");
      byDay[date].forEach(function (s) {
        var left = Math.max(0, s.capacity - (counts[s.id] || 0));
        var past = s.date < today;
        var li = el("li");
        var label = el("label", "shift-choice" + (left === 0 || past ? " is-full" : ""));
        var box = el("input");
        box.type = "checkbox";
        box.name = "shift";
        box.value = s.id;
        box.disabled = !canSignUp || left === 0 || past;
        box.checked = !box.disabled && selected.indexOf(s.id) !== -1;
        var text = el("span", "shift-choice-text");
        text.appendChild(el("strong", null, s.role.name || "Role"));
        text.appendChild(el("span", "shift-time", E.timeLabel(s.start) + "–" + E.timeLabel(s.end)));
        if (s.role.description) text.appendChild(el("span", "shift-desc", s.role.description));
        if (s.role.bring) text.appendChild(el("span", "shift-desc", "Bring or know: " + s.role.bring));
        var spots = el("span", "spots" + (left === 0 ? " spots-full" : ""), past ? "Ended" : left === 0 ? "Full" : left + " of " + s.capacity + " left");
        label.appendChild(box);
        label.appendChild(text);
        label.appendChild(spots);
        li.appendChild(label);
        list.appendChild(li);
      });
      group.appendChild(list);
      groups.appendChild(group);
    });
    updateSelection();
  }

  function selectedIds() {
    return Array.prototype.map.call(document.querySelectorAll('input[name="shift"]:checked'), function (b) { return b.value; });
  }

  // Shifts on the same day whose times overlap.
  function overlaps(ids) {
    var chosen = shifts.filter(function (s) { return ids.indexOf(s.id) !== -1; });
    var pairs = [];
    for (var i = 0; i < chosen.length; i++) {
      for (var j = i + 1; j < chosen.length; j++) {
        var a = chosen[i], b = chosen[j];
        if (a.date === b.date && a.start < b.end && b.start < a.end) pairs.push([a, b]);
      }
    }
    return pairs;
  }

  function updateSelection() {
    var ids = selectedIds();
    var n = ids.length;
    $("submit").textContent = n > 1 ? "Sign up for " + n + " shifts" : "Sign up";
    if (n) $("shifts-error").textContent = "";
    var clash = overlaps(ids);
    var warning = $("overlap-warning");
    warning.hidden = !clash.length;
    if (clash.length) {
      warning.textContent = "Heads up: " + clash.map(function (p) {
        return (p[0].role.name || "Role") + " and " + (p[1].role.name || "Role") + " on " + E.dayLabel(p[0].date) + " overlap in time";
      }).join("; ") + ". You can still sign up if that's what you meant.";
    }
  }

  // Fill in the form from the saved profile, so returning volunteers sign
  // up in one click.
  function prefillFromProfile() {
    var profile = F.load(PROFILE_KEY);
    if (!profile || !profile.email) {
      $("profile-note").innerHTML = "";
      $("profile-note").appendChild(document.createTextNode("No account needed. "));
      var link = el("a", null, "Save a profile");
      link.href = "profile.html";
      $("profile-note").appendChild(link);
      $("profile-note").appendChild(document.createTextNode(" to fill this in automatically next time."));
      return;
    }
    $("name").value = [profile.firstName, profile.lastName].filter(Boolean).join(" ");
    $("email").value = profile.email;
    F.setPhone($("phone"), profile.phone);
    $("profile-note").textContent = "Filled in from your saved profile. Change anything you need to.";
  }

  function messageFor(input) {
    return F.basicMessage(input);
  }

  function submit(e) {
    e.preventDefault();
    var ids = selectedIds();
    $("shifts-error").textContent = ids.length ? "" : "Choose at least one shift.";
    var firstInvalid = F.validate([$("name"), $("email"), $("phone")], messageFor);
    if (!ids.length) {
      $("status").textContent = "";
      var first = document.querySelector('input[name="shift"]:not(:disabled)');
      (first || $("shifts-title")).focus();
      return;
    }
    if (firstInvalid) {
      $("status").textContent = "";
      firstInvalid.focus();
      return;
    }

    // Check capacity again now, in case shifts filled while the form was open.
    var counts = S.countsByShift(event.id);
    var nowFull = shifts.filter(function (s) { return ids.indexOf(s.id) !== -1 && (counts[s.id] || 0) >= s.capacity; });
    if (nowFull.length) {
      renderShifts();
      $("status").textContent = "Sorry, " + nowFull.map(shiftLabel).join("; ") + (nowFull.length > 1 ? " just filled up" : " just filled up") + ". Please choose again.";
      return;
    }

    var email = $("email").value.trim();
    var already = ids.filter(function (id) { return S.isSignedUp(email, id); });
    var fresh = ids.filter(function (id) { return already.indexOf(id) === -1; });
    if (!fresh.length) {
      $("status").textContent = "You're already signed up for " + (ids.length > 1 ? "these shifts" : "this shift") + " with " + email + ".";
      return;
    }

    var registrationId = E.newId("reg");
    var phone = F.phoneValue($("phone"));
    var now = new Date().toISOString();
    var ok = S.addMany(fresh.map(function (shiftId) {
      return {
        id: E.newId("signup"), registrationId: registrationId, eventId: event.id, shiftId: shiftId,
        name: $("name").value.trim(), email: email, phone: phone, status: "confirmed", createdAt: now
      };
    }));
    if (!ok) {
      $("status").textContent = "Couldn't save in this browser. Check that site storage is allowed.";
      return;
    }
    history.replaceState(null, "", "signup.html?registration=" + encodeURIComponent(registrationId));
    renderConfirmation(registrationId, true, already.length);
    window.scrollTo(0, 0);
  }

  function renderEvent(id) {
    event = E.get(id);
    if (!event) {
      var back = el("a", null, "See all volunteer opportunities");
      back.href = "signup.html";
      showNotice([el("p", null, "We couldn't find that event. It may have been removed. "), back]);
      return;
    }
    showOnly("event-view");
    shifts = allShifts(event);
    var ended = (event.endDate || event.startDate || "") < todayString();
    var draft = event.status !== "published";
    canSignUp = !draft && !ended && shifts.length > 0;

    if (draft) {
      var edit = el("a", null, "Edit the event");
      edit.href = "event.html?id=" + encodeURIComponent(event.id);
      showNotice([el("strong", null, "Preview. "), document.createTextNode("This event is a draft, so volunteers can't see it or sign up yet. Publish it to open sign-ups. "), edit]);
    } else if (ended) {
      showNotice([el("strong", null, "This event has ended. "), document.createTextNode("Sign-ups are closed.")]);
    } else if (!shifts.length) {
      showNotice([document.createTextNode("This event doesn't have any shifts yet. Check back soon.")]);
    }

    renderEventHeader();
    renderShifts();
    $("details-section").hidden = !canSignUp;
    $("submit").hidden = !canSignUp;
    $("shifts-help").hidden = !canSignUp;
    F.enhancePhone($("phone"));
    prefillFromProfile();
    F.clearErrorsAsYouType($("signup-form"), messageFor);
    $("shift-groups").addEventListener("change", updateSelection);
    $("signup-form").addEventListener("submit", submit);
  }

  // ---------- Confirmation and "manage my sign-up" ----------

  function icsDate(date, time) {
    return date.replace(/-/g, "") + "T" + (time || "00:00").replace(":", "") + "00";
  }

  function icsEscape(text) {
    return String(text || "").replace(/[\\;,]/g, function (c) { return "\\" + c; }).replace(/\n/g, "\\n");
  }

  function downloadCalendar(ev, list) {
    var stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
    var tz = ev.timezone ? ";TZID=" + ev.timezone : "";
    var lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//The ANB Group//Sevak//EN", "CALSCALE:GREGORIAN"];
    list.forEach(function (item) {
      lines.push("BEGIN:VEVENT",
        "UID:" + item.signup.id + "@sevak",
        "DTSTAMP:" + stamp,
        "DTSTART" + tz + ":" + icsDate(item.shift.date, item.shift.start),
        "DTEND" + tz + ":" + icsDate(item.shift.date, item.shift.end),
        "SUMMARY:" + icsEscape((ev.title || "Volunteer shift") + " – " + (item.shift.role.name || "Shift")),
        "LOCATION:" + icsEscape(placeText(ev)),
        "DESCRIPTION:" + icsEscape("Volunteer shift with " + ((O.get(ev.organizationId) || {}).name || "the host organization") + "."),
        "END:VEVENT");
    });
    lines.push("END:VCALENDAR");
    var blob = new Blob([lines.join("\r\n") + "\r\n"], { type: "text/calendar" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (ev.title || "volunteer-shifts").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() + ".ics";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  function renderConfirmation(registrationId, justSignedUp, skipped) {
    var signups = S.forRegistration(registrationId);
    if (!signups.length) {
      var back = el("a", null, "See all volunteer opportunities");
      back.href = "signup.html";
      showNotice([el("p", null, "We couldn't find that sign-up. "), back]);
      return;
    }
    $("notice").hidden = true;
    var ev = E.get(signups[0].eventId);
    if (!ev) {
      showNotice([el("p", null, "The event for this sign-up has been removed by its host.")]);
      return;
    }
    showOnly("confirm-view");
    var shiftById = {};
    allShifts(ev).forEach(function (s) { shiftById[s.id] = s; });
    var items = signups.map(function (s) { return { signup: s, shift: shiftById[s.shiftId] }; })
      .filter(function (i) { return i.shift; })
      .sort(function (a, b) { return (a.shift.date + a.shift.start).localeCompare(b.shift.date + b.shift.start); });
    var confirmed = items.filter(function (i) { return i.signup.status !== "cancelled"; });

    var org = O.get(ev.organizationId);
    $("confirm-title").textContent = justSignedUp ? "You're signed up!" : confirmed.length ? "Your sign-up" : "Sign-up cancelled";
    document.title = $("confirm-title").textContent + " · Sevak";
    var who = signups[0].name + " (" + signups[0].email + ")";
    $("confirm-intro").textContent = justSignedUp
      ? "Thanks, " + signups[0].name.split(" ")[0] + ". " + (org ? org.name : "The organizers") + " will see your name on their roster. In the live app, a confirmation email goes to " + signups[0].email + "." +
        (skipped ? " You were already signed up for " + (skipped === 1 ? "one of the shifts you picked" : skipped + " of the shifts you picked") + ", so we skipped " + (skipped > 1 ? "those" : "it") + "." : "")
      : "Signed up as " + who + ".";
    $("confirm-event").textContent = (ev.title || "Event") + " · " + E.rangeLabel(ev.startDate, ev.endDate) + (placeText(ev) ? " · " + placeText(ev) : "");

    var list = $("my-shifts");
    list.innerHTML = "";
    items.forEach(function (item) {
      var li = el("li", "my-shift" + (item.signup.status === "cancelled" ? " is-cancelled" : ""));
      var text = el("div");
      text.appendChild(el("strong", null, item.shift.role.name || "Shift"));
      text.appendChild(el("span", "event-meta", E.dayLabel(item.shift.date, { year: "numeric" }) + " · " + E.timeLabel(item.shift.start) + "–" + E.timeLabel(item.shift.end)));
      li.appendChild(text);
      if (item.signup.status === "cancelled") {
        li.appendChild(E.badge("Cancelled"));
      } else {
        var cancel = el("button", "btn btn-danger-link", "Cancel");
        cancel.type = "button";
        cancel.setAttribute("aria-label", "Cancel " + shiftLabel(item.shift));
        cancel.addEventListener("click", function () {
          if (!window.confirm("Cancel your " + shiftLabel(item.shift) + " shift?")) return;
          S.cancel(item.signup.id);
          renderConfirmation(registrationId, false);
          $("confirm-status").textContent = "Shift cancelled. The organizers will see the spot is open again.";
        });
        li.appendChild(cancel);
      }
      list.appendChild(li);
    });

    $("add-calendar").hidden = !confirmed.length;
    $("add-calendar").onclick = function () { downloadCalendar(ev, confirmed); };
    $("manage-link").href = "signup.html?registration=" + encodeURIComponent(registrationId);
    $("manage-link").hidden = !justSignedUp;
    $("manage-hint").hidden = !justSignedUp;
    $("more-shifts").href = "signup.html?event=" + encodeURIComponent(ev.id);
  }

  // ---------- Start ----------

  if (params.get("registration")) {
    renderConfirmation(params.get("registration"), false);
  } else if (params.get("event")) {
    renderEvent(params.get("event"));
  } else {
    renderDiscover();
  }
})();
