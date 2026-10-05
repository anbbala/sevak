// Volunteer sign-ups for the prototype, kept in this browser. Each sign-up
// is one volunteer on one shift. The volunteer sign-up page will write
// these; until it exists, the dashboard can add clearly marked samples.
(function () {
  "use strict";

  var KEY = "sevak.signups.v1";
  var F = window.SevakForms;

  function all() {
    var list = F.load(KEY);
    return Array.isArray(list) ? list : [];
  }

  // Confirmed sign-ups for an event, counted by shift id.
  function countsByShift(eventId) {
    var counts = {};
    all().forEach(function (s) {
      if (s.eventId !== eventId || s.status === "cancelled") return;
      counts[s.shiftId] = (counts[s.shiftId] || 0) + 1;
    });
    return counts;
  }

  // Sign-ups made in one form submission (a "registration").
  function forRegistration(registrationId) {
    return all().filter(function (s) { return s.registrationId === registrationId; });
  }

  // True if this email already has a confirmed place on the shift.
  function isSignedUp(email, shiftId) {
    var e = (email || "").trim().toLowerCase();
    return all().some(function (s) {
      return s.shiftId === shiftId && s.status !== "cancelled" && (s.email || "").toLowerCase() === e;
    });
  }

  function cancel(id) {
    return F.store(KEY, all().map(function (s) {
      return s.id === id ? Object.assign({}, s, { status: "cancelled", cancelledAt: new Date().toISOString() }) : s;
    }));
  }

  function addMany(list) {
    return F.store(KEY, all().concat(list));
  }

  function removeSamples() {
    return F.store(KEY, all().filter(function (s) { return !s.sample; }));
  }

  function hasSamples() {
    return all().some(function (s) { return s.sample; });
  }

  window.SevakSignups = {
    all: all,
    countsByShift: countsByShift,
    forRegistration: forRegistration,
    isSignedUp: isSignedUp,
    cancel: cancel,
    addMany: addMany,
    removeSamples: removeSamples,
    hasSamples: hasSamples
  };
})();
