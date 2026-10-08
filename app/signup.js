// Volunteer sign-up (prototype). Four views on one page:
//   signup.html                    → volunteer opportunities (upcoming events)
//   signup.html?view=mine          → my sign-ups
//   signup.html?event=ID           → one event: pick shifts, then confirm (#confirm)
//   signup.html?registration=ID    → "manage my sign-up": see and cancel shifts
(function () {
  "use strict";

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
    ["discover-view", "mine-view", "event-view", "confirm-view"].forEach(function (v) { $(v).hidden = v !== id; });
  }

  function showNotice(html) {
    var n = $("notice");
    n.innerHTML = "";
    html.forEach(function (part) { n.appendChild(part); });
    n.hidden = false;
  }

  // ---------- Find events ----------

  // A short place: the venue and city, or "Online".
  function shortPlace(event) {
    var loc = event.location || {};
    if (loc.type === "online") return "Online";
    return [loc.venue, loc.city].filter(Boolean).join(", ") || placeText(event);
  }

  // "Sun, Oct 18" or "Sun, Oct 18 – Mon, Oct 19" (no year: it's soon).
  function rowDate(event) {
    if (!event.endDate || event.endDate === event.startDate) return E.dayLabel(event.startDate);
    return E.dayLabel(event.startDate) + " – " + E.dayLabel(event.endDate);
  }

  // One opportunity: the whole row is a link to the event.
  function oppRow(event, showOrg) {
    var li = el("li");
    var a = el("a", "opp-row");
    a.href = "signup.html?event=" + encodeURIComponent(event.id);
    var text = el("div", "opp-text");
    text.appendChild(el("h3", "opp-title", event.title || "Untitled event"));
    text.appendChild(el("p", "opp-meta", [rowDate(event), shortPlace(event)].filter(Boolean).join(" · ")));
    if (showOrg) {
      var org = O.get(event.organizationId);
      if (org) text.appendChild(el("p", "opp-org", org.name));
    }
    var left = spotsLeft(event);
    a.appendChild(text);
    a.appendChild(el("span", "opp-spots" + (left ? "" : " is-full"), left ? E.plural(left, "spot") : "Full"));
    li.appendChild(a);
    return li;
  }

  // "This week" runs Monday to Sunday.
  function weekBucket(event, today) {
    var d = new Date(today + "T00:00:00");
    var monday = new Date(d);
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    var iso = function (x) {
      var pad = function (n) { return String(n).padStart(2, "0"); };
      return x.getFullYear() + "-" + pad(x.getMonth() + 1) + "-" + pad(x.getDate());
    };
    var endThis = new Date(monday); endThis.setDate(monday.getDate() + 6);
    var endNext = new Date(monday); endNext.setDate(monday.getDate() + 13);
    var start = event.startDate < today ? today : event.startDate;
    if (start <= iso(endThis)) return "This week";
    if (start <= iso(endNext)) return "Next week";
    return "Later";
  }

  // Published, active, public events that haven't ended.
  function upcomingEvents() {
    var today = todayString();
    return E.all().filter(function (e) {
      return e.status === "published" && E.isActive(e) && e.visibility !== "private" && e.startDate && (e.endDate || e.startDate) >= today;
    }).sort(E.byDate);
  }

  // ---------- Filter: all, in person near me, all in person, remote ----------

  var FILTER_KEY = "sevak.opportunityFilter.v1";

  function norm(x) {
    return String(x || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  function isRemote(event) {
    return (event.location || {}).type === "online";
  }

  // "Near" has no map yet: an event is near when it's in the same city or
  // town, state or region, or postal area (first three characters) as what
  // was typed. "Austin, TX" matches on the city.
  function isNear(event, near) {
    var loc = event.location || {};
    var q = norm(near);
    if (!q || isRemote(event)) return false;
    if (q.indexOf(",") !== -1) return norm(loc.city) === norm(q.split(",")[0]);
    if (norm(loc.city) === q || norm(loc.state) === q) return true;
    var typed = q.replace(/[\s-]/g, "");
    var postal = norm(loc.postalCode).replace(/[\s-]/g, "");
    return /\d/.test(typed) && typed.length >= 3 && postal.slice(0, 3) === typed.slice(0, 3);
  }

  function matches(event, where, near) {
    if (where === "remote") return isRemote(event);
    if (where === "in-person") return !isRemote(event);
    if (where === "near") return isNear(event, near);
    return true;
  }

  function currentWhere() {
    var checked = document.querySelector('input[name="where"]:checked');
    return checked ? checked.value : "all";
  }

  function setupFilter() {
    var saved = F.load(FILTER_KEY) || {};
    var profile = F.session.profile() || {};
    var address = profile.address || {};
    var fromProfile = address.city || address.postalCode || "";
    $("near").value = saved.near != null ? saved.near : fromProfile;
    $("near-source").textContent = saved.near == null && fromProfile ? "Filled in from your profile." : "";
    var radio = document.querySelector('input[name="where"][value="' + (saved.where || "all") + '"]');
    if (radio) radio.checked = true;

    $("opp-filter").addEventListener("change", function () {
      F.store(FILTER_KEY, { where: currentWhere(), near: $("near").value });
      renderAvailable();
      if (currentWhere() === "near" && !$("near").value.trim()) $("near").focus();
    });
    $("near").addEventListener("input", function () {
      $("near-source").textContent = "";
      F.store(FILTER_KEY, { where: currentWhere(), near: $("near").value });
      renderAvailable();
    });
  }

  function renderAvailable() {
    var where = currentWhere();
    var near = $("near").value;
    var all = upcomingEvents();
    ["all", "near", "in-person", "remote"].forEach(function (w) {
      var count = all.filter(function (e) { return matches(e, w, near); }).length;
      var badge = document.querySelector('[data-count="' + w + '"]');
      badge.textContent = w === "near" && !norm(near) ? "" : "(" + count + ")";
    });
    $("near-row").hidden = where !== "near";

    var events = all.filter(function (e) { return matches(e, where, near); });
    var listed = events.filter(function (e) { return isVerified(O.get(e.organizationId)); });
    var preview = events.filter(function (e) { return !isVerified(O.get(e.organizationId)); });
    // Only name the organization when the list has events from more than one.
    var orgIds = {};
    events.forEach(function (e) { orgIds[e.organizationId] = true; });
    var showOrg = Object.keys(orgIds).length > 1;

    var box = $("discover-list");
    box.innerHTML = "";
    var today = todayString();
    var groups = [["This week", []], ["Next week", []], ["Later", []]];
    listed.forEach(function (e) {
      var bucket = weekBucket(e, today);
      groups.filter(function (g) { return g[0] === bucket; })[0][1].push(e);
    });
    groups.forEach(function (g) {
      if (!g[1].length) return;
      box.appendChild(el("h2", "opp-group", g[0]));
      var ul = el("ul", "opp-list");
      g[1].forEach(function (e) { ul.appendChild(oppRow(e, showOrg)); });
      box.appendChild(ul);
    });
    if (preview.length) {
      var head = el("h2", "opp-group", "Not listed publicly yet");
      box.appendChild(head);
      box.appendChild(el("p", "hint opp-group-hint", "These organizations aren't verified yet, so their events can only be reached by link."));
      var pul = el("ul", "opp-list");
      preview.forEach(function (e) { pul.appendChild(oppRow(e, true)); });
      box.appendChild(pul);
    }

    var empty = $("discover-empty");
    empty.hidden = events.length > 0;
    if (!all.length) {
      empty.textContent = "There are no upcoming opportunities right now. Check back soon.";
    } else if (where === "near" && !norm(near)) {
      empty.textContent = "Enter your city or town, region or postal code to see in-person events near you.";
    } else if (where === "near") {
      empty.textContent = "No in-person opportunities near " + near.trim() + " right now. Try All in person.";
    } else if (where === "remote") {
      empty.textContent = "No remote opportunities right now.";
    } else if (where === "in-person") {
      empty.textContent = "No in-person opportunities right now.";
    }
  }

  // ---------- My sign-ups ----------

  function signupCard(reg, kind) {
    var ev = reg.event;
    var org = ev ? O.get(ev.organizationId) : null;
    var li = el("li", "event-item my-signup" + (kind === "cancelled" ? " is-cancelled" : ""));
    var info = el("div");
    if (org) info.appendChild(el("p", "opp-org", org.name));
    var h3 = el("h3");
    if (ev) {
      var link = el("a", null, ev.title || "Untitled event");
      link.href = "signup.html?event=" + encodeURIComponent(ev.id);
      h3.appendChild(link);
    } else {
      h3.textContent = "An event that was removed";
    }
    info.appendChild(h3);
    if (ev) info.appendChild(el("p", "event-meta", [rowDate(ev), shortPlace(ev)].filter(Boolean).join(" · ")));

    var byId = {};
    if (ev) allShifts(ev).forEach(function (s) { byId[s.id] = s; });
    var shiftsList = el("ul", "signup-shifts");
    (kind === "cancelled" ? reg.signups : reg.confirmed).map(function (s) { return byId[s.shiftId]; })
      .filter(Boolean)
      .sort(function (a, b) { return (a.date + a.start).localeCompare(b.date + b.start); })
      .forEach(function (s) { shiftsList.appendChild(el("li", null, shiftLabel(s))); });
    if (shiftsList.children.length) info.appendChild(shiftsList);

    var manage = el("a", "signup-manage", kind === "upcoming" && ev ? "Manage or cancel" : "View sign-up");
    manage.href = "signup.html?registration=" + encodeURIComponent(reg.id);
    info.appendChild(manage);

    var side = el("div", "badges");
    if (kind === "cancelled") side.appendChild(E.badge("Cancelled"));
    else if (!ev) side.appendChild(E.badge("Removed"));
    else if (!E.isActive(ev)) side.appendChild(E.badge("No longer active", "inactive"));
    else if (kind === "past") side.appendChild(E.badge("Done"));
    else side.appendChild(E.badge(E.plural(reg.confirmed.length, "shift"), "published"));
    li.appendChild(info);
    li.appendChild(side);
    return li;
  }

  // Lists the signed-in volunteer's sign-ups (matched by email), grouped
  // into upcoming, past and cancelled.
  function renderMine() {
    var profile = F.session.profile();
    var email = norm(profile && profile.email);
    var regs = {};
    var order = [];
    S.all().forEach(function (s) {
      if (!email || norm(s.email) !== email) return;
      var key = s.registrationId || s.id;
      if (!regs[key]) { regs[key] = { id: key, event: E.get(s.eventId), signups: [] }; order.push(key); }
      regs[key].signups.push(s);
    });
    var today = todayString();
    var groups = { upcoming: [], past: [], cancelled: [] };
    order.forEach(function (key) {
      var r = regs[key];
      r.confirmed = r.signups.filter(function (s) { return s.status !== "cancelled"; });
      if (!r.confirmed.length) groups.cancelled.push(r);
      else if (r.event && (r.event.endDate || r.event.startDate || "") < today) groups.past.push(r);
      else groups.upcoming.push(r);
    });
    var start = function (r) { return r.event ? r.event.startDate || "" : "9999"; };
    groups.upcoming.sort(function (a, b) { return start(a).localeCompare(start(b)); });
    groups.past.sort(function (a, b) { return start(b).localeCompare(start(a)); });

    var box = $("mine-groups");
    box.innerHTML = "";
    [["upcoming", "Upcoming"], ["past", "Past"], ["cancelled", "Cancelled"]].forEach(function (g) {
      if (!groups[g[0]].length) return;
      box.appendChild(el("h2", "list-heading mine-heading", g[1]));
      var ul = el("ul", "event-list");
      groups[g[0]].forEach(function (r) { ul.appendChild(signupCard(r, g[0])); });
      box.appendChild(ul);
    });
    $("mine-empty").hidden = order.length > 0;
  }

  function renderOpportunities() {
    showOnly("discover-view");
    document.title = "Volunteer opportunities · Sevak";
    setupFilter();
    renderAvailable();
  }

  function renderMineView() {
    showOnly("mine-view");
    document.title = "My sign-ups · Sevak";
    var on = F.session.signedIn();
    $("mine-signed-out").hidden = on;
    if (on) renderMine();
  }

  // ---------- One event: step 1, pick shifts ----------

  var event = null;
  var shifts = [];
  var canSignUp = false;
  var currentDay = "";

  function renderEventHeader() {
    var org = O.get(event.organizationId);
    var host = $("host-line");
    host.innerHTML = "";
    host.appendChild(el("span", null, org ? org.name : "An organization"));
    host.appendChild(document.createTextNode(" "));
    host.appendChild(isVerified(org) ? E.badge("Verified", "published") : E.badge("Not verified yet"));

    var main = event.mainEventId ? E.getMain(event.mainEventId) : null;
    $("main-line").hidden = !main;
    if (main) $("main-line").textContent = main.title || "Main event";
    $("event-title").textContent = event.title || "Untitled event";
    document.title = (event.title || "Event") + " · Sevak";
    $("event-facts").textContent = [E.rangeLabel(event.startDate, event.endDate), shortPlace(event)].filter(Boolean).join(" · ");

    // Everything else is folded under "About this event".
    var about = $("about-body");
    about.innerHTML = "";
    if (event.description) about.appendChild(el("p", null, event.description));
    var loc = event.location || {};
    if (loc.type === "online") {
      about.appendChild(el("p", null, "Online. The meeting link is shared with volunteers who sign up."));
    } else if (placeText(event) && placeText(event) !== shortPlace(event)) {
      about.appendChild(el("p", null, "Address: " + placeText(event)));
    }
    var local = "";
    try { local = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { /* ignore */ }
    if (event.timezone && event.timezone !== local) {
      about.appendChild(el("p", null, "Times are in " + event.timezone.replace(/_/g, " ") + " time."));
    }
    $("about-event").hidden = !about.children.length;
  }

  function selectedIds() {
    return Array.prototype.map.call(document.querySelectorAll('input[name="shift"]:checked'), function (b) { return b.value; });
  }

  // One shift on one line: tick, role, time, spots, and Details if the role
  // has a description or something to bring.
  function shiftRow(s, left, past, selected) {
    var closed = left === 0 || past;
    var li = el("li", "shift-line" + (closed ? " is-full" : ""));
    var label = el("label", "shift-pick");
    var box = el("input");
    box.type = "checkbox";
    box.name = "shift";
    box.value = s.id;
    box.disabled = !canSignUp || closed;
    box.checked = !box.disabled && selected.indexOf(s.id) !== -1;
    var main = el("span", "shift-main");
    main.appendChild(el("strong", "shift-role", s.role.name || "Role"));
    main.appendChild(el("span", "shift-time", E.timeLabel(s.start) + "–" + E.timeLabel(s.end)));
    label.appendChild(box);
    label.appendChild(main);
    li.appendChild(label);
    li.appendChild(el("span", "shift-spots" + (closed ? " is-full" : ""), past ? "Ended" : left === 0 ? "Full" : left + " left"));
    if (s.role.description || s.role.bring) {
      var more = el("button", "shift-more", "Details");
      more.type = "button";
      var info = el("div", "shift-info");
      info.id = "info-" + s.id;
      info.hidden = true;
      if (s.role.description) info.appendChild(el("p", null, s.role.description));
      if (s.role.bring) info.appendChild(el("p", null, "Bring or know: " + s.role.bring));
      more.setAttribute("aria-expanded", "false");
      more.setAttribute("aria-controls", info.id);
      more.setAttribute("aria-label", "Details about " + (s.role.name || "this role"));
      more.addEventListener("click", function () {
        info.hidden = !info.hidden;
        more.setAttribute("aria-expanded", String(!info.hidden));
        more.textContent = info.hidden ? "Details" : "Hide";
      });
      li.appendChild(more);
      li.appendChild(info);
    }
    return li;
  }

  function renderShifts() {
    var counts = S.countsByShift(event.id);
    var today = todayString();
    var selected = selectedIds();
    var byDay = {};
    shifts.forEach(function (s) { (byDay[s.date] = byDay[s.date] || []).push(s); });
    var days = Object.keys(byDay).sort();
    var openOn = function (date) {
      return byDay[date].some(function (s) { return s.date >= today && (counts[s.id] || 0) < s.capacity; });
    };
    if (days.indexOf(currentDay) === -1) currentDay = days.filter(openOn)[0] || days[0] || "";

    // Several days: show one day at a time, with a day picker.
    var multi = days.length > 1;
    var picker = $("day-picker");
    picker.hidden = !multi;
    picker.innerHTML = "";
    days.forEach(function (date) {
      var chip = el("button", "day-chip");
      chip.type = "button";
      chip.dataset.date = date;
      chip.setAttribute("aria-pressed", String(date === currentDay));
      chip.appendChild(el("span", null, E.dayLabel(date)));
      chip.appendChild(el("span", "day-chip-count"));
      chip.addEventListener("click", function () {
        currentDay = date;
        showDay();
      });
      picker.appendChild(chip);
    });

    var groups = $("shift-groups");
    groups.innerHTML = "";
    days.forEach(function (date) {
      var group = el("div", "day-group");
      group.dataset.date = date;
      group.appendChild(el("h3", "day-title" + (multi ? " sr-only" : ""), E.dayLabel(date, { weekday: "long", year: "numeric" })));
      var open = el("ul", "shift-lines");
      var closed = [];
      byDay[date].forEach(function (s) {
        var left = Math.max(0, s.capacity - (counts[s.id] || 0));
        var past = s.date < today;
        if (left === 0 || past) closed.push(shiftRow(s, left, past, selected));
        else open.appendChild(shiftRow(s, left, past, selected));
      });
      if (open.children.length) group.appendChild(open);
      else group.appendChild(el("p", "empty", "No open shifts on this day."));
      // Full (or ended) shifts are tucked away.
      if (closed.length) {
        var more = el("details", "full-shifts");
        more.appendChild(el("summary", null, closed.length === 1 ? "1 full shift" : closed.length + " full shifts"));
        var ul = el("ul", "shift-lines");
        closed.forEach(function (li) { ul.appendChild(li); });
        more.appendChild(ul);
        group.appendChild(more);
      }
      groups.appendChild(group);
    });
    showDay();
    updateSelection();
  }

  function showDay() {
    var multi = !$("day-picker").hidden;
    document.querySelectorAll("#shift-groups .day-group").forEach(function (g) {
      g.hidden = multi && g.dataset.date !== currentDay;
    });
    document.querySelectorAll("#day-picker .day-chip").forEach(function (c) {
      c.setAttribute("aria-pressed", String(c.dataset.date === currentDay));
    });
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
    $("pick-count").textContent = n ? (n === 1 ? "1 shift picked" : n + " shifts picked") : "No shifts picked yet";
    if (n) $("shifts-error").textContent = "";
    // How many are picked on each day.
    document.querySelectorAll("#day-picker .day-chip").forEach(function (chip) {
      var onDay = shifts.filter(function (s) { return s.date === chip.dataset.date && ids.indexOf(s.id) !== -1; }).length;
      chip.querySelector(".day-chip-count").textContent = onDay ? String(onDay) : "";
      chip.classList.toggle("has-picks", onDay > 0);
    });
    var clash = overlaps(ids);
    var warning = $("overlap-warning");
    warning.hidden = !clash.length;
    if (clash.length) {
      warning.textContent = "Heads up: " + clash.map(function (p) {
        return (p[0].role.name || "Role") + " and " + (p[1].role.name || "Role") + " on " + E.dayLabel(p[0].date) + " overlap in time";
      }).join("; ") + ". You can still sign up if that's what you meant.";
    }
  }

  // ---------- One event: step 2, confirm ----------

  function showStep(step) {
    $("step-pick").hidden = step !== "pick";
    $("step-confirm").hidden = step !== "confirm";
    window.scrollTo(0, 0);
    if (step === "confirm") {
      renderPicked();
      $("confirm-step-title").focus();
    }
  }

  function renderPicked() {
    var ids = selectedIds();
    $("confirm-step-event").textContent = (event.title || "Event") + " · " + E.rangeLabel(event.startDate, event.endDate) + " · " + shortPlace(event);
    var list = $("picked-list");
    list.innerHTML = "";
    shifts.filter(function (s) { return ids.indexOf(s.id) !== -1; }).forEach(function (s) {
      var li = el("li");
      li.appendChild(el("strong", null, s.role.name || "Role"));
      li.appendChild(el("span", "event-meta", E.dayLabel(s.date) + " · " + E.timeLabel(s.start) + "–" + E.timeLabel(s.end)));
      list.appendChild(li);
    });
    $("submit").textContent = ids.length > 1 ? "Confirm " + ids.length + " shifts" : "Confirm sign-up";
    $("status").textContent = "";
  }

  // Signed in: just say who's signing up (with Change). Otherwise, the form.
  function setupWho() {
    var profile = F.session.signedIn() ? F.session.profile() : null;
    if (profile) {
      $("name").value = [profile.firstName, profile.lastName].filter(Boolean).join(" ");
      $("email").value = profile.email;
      F.setPhone($("phone"), profile.phone);
      $("who-name").textContent = $("name").value || profile.email;
      $("who-email").textContent = $("name").value ? "(" + profile.email + ")" : "";
      $("who-summary").hidden = false;
      $("details-section").hidden = true;
      $("profile-note").textContent = "From your profile. Changes here are just for this sign-up.";
      return;
    }
    $("who-summary").hidden = true;
    $("details-section").hidden = false;
    var note = $("profile-note");
    note.innerHTML = "";
    note.appendChild(document.createTextNode("No account needed. "));
    var link = el("a", null, "Sign in");
    link.href = "signin.html";
    note.appendChild(link);
    note.appendChild(document.createTextNode(" to skip this next time."));
  }

  function showDetails() {
    $("who-summary").hidden = true;
    $("details-section").hidden = false;
  }

  function messageFor(input) {
    return F.basicMessage(input);
  }

  function goToConfirm(e) {
    e.preventDefault();
    if (!selectedIds().length) {
      $("shifts-error").textContent = "Pick at least one shift.";
      var first = document.querySelector('#shift-groups .day-group:not([hidden]) input[name="shift"]:not(:disabled)');
      (first || $("continue")).focus();
      return;
    }
    history.pushState({ step: "confirm" }, "", location.search + "#confirm");
    showStep("confirm");
  }

  function submit(e) {
    e.preventDefault();
    var ids = selectedIds();
    if (!ids.length) {
      showStep("pick");
      return;
    }
    var firstInvalid = F.validate([$("name"), $("email"), $("phone")], messageFor);
    if (firstInvalid) {
      showDetails();
      $("status").textContent = "";
      firstInvalid.focus();
      return;
    }

    // Check capacity again now, in case shifts filled while the form was open.
    var counts = S.countsByShift(event.id);
    var nowFull = shifts.filter(function (s) { return ids.indexOf(s.id) !== -1 && (counts[s.id] || 0) >= s.capacity; });
    if (nowFull.length) {
      history.replaceState(null, "", location.search);
      renderShifts();
      showStep("pick");
      $("shifts-error").textContent = "Sorry, " + nowFull.map(shiftLabel).join("; ") + " just filled up. Please choose again.";
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
    window.SevakNav.render();
    window.scrollTo(0, 0);
  }

  function renderEvent(id) {
    event = E.get(id);
    // Inactive events are hidden from volunteers, as if removed.
    if (event && !E.isActive(event)) {
      var more = el("a", null, "See all volunteer opportunities");
      more.href = "signup.html";
      showNotice([el("p", null, "This event is no longer available. "), more]);
      return;
    }
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
    $("pick-bar").hidden = !canSignUp;
    F.enhancePhone($("phone"));
    setupWho();
    F.clearErrorsAsYouType($("signup-form"), messageFor);
    $("shift-groups").addEventListener("change", updateSelection);
    $("pick-form").addEventListener("submit", goToConfirm);
    $("signup-form").addEventListener("submit", submit);
    $("who-change").addEventListener("click", function () {
      showDetails();
      $("name").focus();
    });
    $("back-to-shifts").addEventListener("click", function () {
      if (history.state && history.state.step === "confirm") history.back();
      else showStep("pick");
    });
    // The browser's Back and Forward buttons move between the two steps.
    window.addEventListener("popstate", function () {
      // Back from the confirmation page: start this event afresh.
      if (!$("confirm-view").hidden || params.get("event") !== new URLSearchParams(location.search).get("event")) {
        location.reload();
        return;
      }
      showStep(location.hash === "#confirm" && selectedIds().length ? "confirm" : "pick");
    });
    if (location.hash === "#confirm") history.replaceState(null, "", location.search);
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
    if (!E.isActive(ev)) {
      showNotice([el("strong", null, "This event is no longer active. "),
        document.createTextNode("The host has taken it off Sevak for now. Your sign-up is kept; contact the organizers if you have questions.")]);
    }
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
    $("all-signups").hidden = !F.session.signedIn();
  }

  // ---------- Start ----------

  // Old links to the "My sign-ups" tab.
  if (location.hash === "#mine") {
    history.replaceState(null, "", "signup.html?view=mine");
    params = new URLSearchParams(location.search);
    window.SevakNav.render();
  }
  if (params.get("registration")) {
    renderConfirmation(params.get("registration"), false);
  } else if (params.get("event")) {
    renderEvent(params.get("event"));
  } else if (params.get("view") === "mine") {
    renderMineView();
  } else {
    renderOpportunities();
  }
})();
