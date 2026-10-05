// Events for the prototype, kept in this browser. Shared by the event
// editor and the organization page.
(function () {
  "use strict";

  var KEY = "sevak.events.v1";
  var F = window.SevakForms;

  function all() {
    var list = F.load(KEY);
    return Array.isArray(list) ? list : [];
  }

  function get(id) {
    return all().filter(function (e) { return e.id === id; })[0] || null;
  }

  function save(event) {
    var list = all();
    var i = list.findIndex(function (e) { return e.id === event.id; });
    if (i === -1) list.push(event); else list[i] = event;
    return F.store(KEY, list);
  }

  function remove(id) {
    return F.store(KEY, all().filter(function (e) { return e.id !== id; }));
  }

  function newId(prefix) {
    return (prefix || "id") + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // ---------- Dates ----------
  // Dates are "YYYY-MM-DD" strings for the event's own calendar days, so
  // they are handled in UTC to avoid the visitor's time zone shifting them.

  function parse(date) {
    var p = (date || "").split("-").map(Number);
    return p.length === 3 && p.every(function (n) { return !isNaN(n); }) ? new Date(Date.UTC(p[0], p[1] - 1, p[2])) : null;
  }

  function toString(d) {
    return d.toISOString().slice(0, 10);
  }

  // Every calendar day from start to end, inclusive.
  function days(start, end) {
    var s = parse(start), e = parse(end);
    if (!s || !e || e < s) return [];
    var out = [];
    for (var d = s; d <= e && out.length < 400; d = new Date(d.getTime() + 86400000)) out.push(toString(d));
    return out;
  }

  function dayLabel(date, opts) {
    var d = parse(date);
    if (!d) return date;
    return new Intl.DateTimeFormat(undefined, Object.assign({ weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }, opts || {})).format(d);
  }

  function rangeLabel(start, end) {
    if (!start) return "Dates not set";
    var withYear = { year: "numeric" };
    if (!end || end === start) return dayLabel(start, withYear);
    return dayLabel(start) + " – " + dayLabel(end, withYear);
  }

  function timeLabel(time) {
    var p = (time || "").split(":").map(Number);
    if (p.length < 2 || p.some(isNaN)) return time;
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", timeZone: "UTC" })
      .format(new Date(Date.UTC(2000, 0, 1, p[0], p[1])));
  }

  function totals(event) {
    var roles = event.roles || [];
    var shifts = 0, volunteers = 0;
    roles.forEach(function (r) {
      (r.shifts || []).forEach(function (s) {
        shifts += 1;
        volunteers += Number(s.capacity) || 0;
      });
    });
    return { roles: roles.length, shifts: shifts, volunteers: volunteers };
  }

  function plural(n, word) {
    return n + " " + word + (n === 1 ? "" : "s");
  }

  window.SevakEvents = {
    all: all,
    get: get,
    save: save,
    remove: remove,
    newId: newId,
    days: days,
    dayLabel: dayLabel,
    rangeLabel: rangeLabel,
    timeLabel: timeLabel,
    totals: totals,
    plural: plural
  };
})();
