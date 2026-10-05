// Demo data for testing the prototype: one organization with main events,
// sub-events, roles, shifts and sign-ups, dated relative to today. It is
// kept apart from real data (its own organization, ids starting "demo-")
// so loading and removing it never touches anything else.
(function () {
  "use strict";

  var ORG_ID = "demo-org";
  var EVENTS_KEY = "sevak.events.v1";
  var MAIN_KEY = "sevak.mainEvents.v1";
  var SIGNUPS_KEY = "sevak.signups.v1";
  var F = window.SevakForms;
  var O = window.SevakOrgs;

  var NAMES = ["Asha Rao", "Ben Carter", "Chen Wei", "Diego Alvarez", "Emma Novak", "Farah Haddad", "Grace Kim", "Hiro Tanaka",
    "Isla Murphy", "Jamal Brooks", "Kofi Mensah", "Lena Fischer", "Maya Patel", "Noah Levi", "Omar Aziz", "Priya Shah",
    "Quinn Doyle", "Rosa Lima", "Sam Okafor", "Tara Singh", "Uma Iyer", "Victor Hugo", "Wen Li", "Yara Saleh", "Zoe Martin"];

  function day(n) {
    var d = new Date();
    d.setDate(d.getDate() + n);
    var pad = function (x) { return String(x).padStart(2, "0"); };
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function timezone() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch (e) { return "UTC"; }
  }

  // Each shift is [day offset, start, end, capacity, how many have signed up].
  var PLAN = {
    mains: [
      { id: "demo-main-arudra", title: "Arudra Dance Festival", description: "Our annual classical dance festival, with rehearsals in the weeks before." },
      { id: "demo-main-food", title: "Winter Food Drive", description: "Collecting, sorting and handing out groceries for families this winter." }
    ],
    events: [
      { id: "demo-ev-reh1", main: "demo-main-arudra", title: "Arudra Rehearsal 1", days: [6, 6], status: "published", venue: "Studio B, Natya Center",
        roles: [
          { name: "Stage crew", description: "Set up the stage and lights", bring: "Closed-toe shoes", shifts: [[6, "17:00", "21:00", 6, 5]] },
          { name: "Refreshments", description: "Water and snacks for dancers", shifts: [[6, "18:00", "20:00", 2, 2]] }] },
      { id: "demo-ev-reh2", main: "demo-main-arudra", title: "Arudra Rehearsal 2", days: [13, 13], status: "published", venue: "Studio B, Natya Center",
        roles: [
          { name: "Stage crew", description: "Set up the stage and lights", bring: "Closed-toe shoes", shifts: [[13, "17:00", "21:00", 6, 3]] },
          { name: "Refreshments", shifts: [[13, "18:00", "20:00", 2, 1]] }] },
      { id: "demo-ev-dress", main: "demo-main-arudra", title: "Arudra Dress Rehearsal", days: [20, 20], status: "draft", venue: "Riverside Theatre",
        roles: [
          { name: "Stage crew", shifts: [[20, "15:00", "22:00", 8, 0]] },
          { name: "Costume helpers", description: "Help dancers with costumes and make-up", shifts: [[20, "16:00", "20:00", 4, 0]] }] },
      { id: "demo-ev-fest", main: "demo-main-arudra", title: "Arudra Festival Weekend", days: [27, 28], status: "published", venue: "Riverside Theatre",
        description: "Two evenings of performances. We need help front-of-house and backstage.",
        roles: [
          { name: "Ushers", description: "Greet guests and show them to their seats", shifts: [[27, "17:00", "21:30", 10, 8], [28, "17:00", "21:30", 10, 4]] },
          { name: "Ticket desk", description: "Check tickets and handle the guest list", bring: "Smartphone", shifts: [[27, "16:30", "19:30", 3, 3], [28, "16:30", "19:30", 3, 1]] },
          { name: "Stage crew", shifts: [[27, "14:00", "22:30", 8, 6], [28, "14:00", "22:30", 8, 5]] },
          { name: "Hospitality", description: "Look after performers and guests in the green room", shifts: [[27, "18:00", "22:00", 4, 2], [28, "18:00", "22:00", 4, 0]] }] },
      { id: "demo-ev-collect", main: "demo-main-food", title: "Food Drive: Collection Day", days: [3, 3], status: "published", venue: "Eastside Community Center",
        roles: [
          { name: "Donation greeters", description: "Welcome donors and take their bags", shifts: [[3, "09:00", "12:00", 8, 2], [3, "12:00", "15:00", 8, 1]] },
          { name: "Drivers", description: "Pick up donations from local shops", bring: "A car and driving licence", shifts: [[3, "10:00", "14:00", 4, 1]] }] },
      { id: "demo-ev-sort", main: "demo-main-food", title: "Food Drive: Sorting", days: [10, 11], status: "published", venue: "Eastside Community Center",
        roles: [
          { name: "Sorters", description: "Check dates and sort food into boxes", shifts: [[10, "09:00", "13:00", 12, 9], [11, "09:00", "13:00", 12, 6]] },
          { name: "Packers", shifts: [[10, "13:00", "17:00", 8, 4], [11, "13:00", "17:00", 8, 2]] }] },
      { id: "demo-ev-dist", main: "demo-main-food", title: "Food Drive: Distribution", days: [17, 17], status: "published", venue: "Eastside Community Center",
        roles: [
          { name: "Distribution line", shifts: [[17, "10:00", "14:00", 15, 7]] },
          { name: "Check-in desk", bring: "Smartphone", shifts: [[17, "09:30", "14:00", 3, 3]] },
          { name: "Carry-out helpers", description: "Help families carry boxes to their cars", shifts: [[17, "10:00", "14:00", 6, 2]] }] },
      { id: "demo-ev-park", title: "Riverside Park Clean-up", days: [4, 4], status: "published", venue: "Riverside Park",
        description: "Help us clear litter along the river trail. Gloves and bags provided.",
        roles: [
          { name: "Litter pickers", bring: "Sturdy shoes", shifts: [[4, "08:30", "11:30", 20, 7]] },
          { name: "Check-in desk", shifts: [[4, "08:00", "10:00", 2, 2]] }] },
      { id: "demo-ev-reading", title: "Library Reading Hour", days: [40, 40], status: "draft", venue: "Central Library",
        roles: [{ name: "Readers", description: "Read picture books to children", shifts: [[40, "10:00", "11:00", 4, 0]] }] },
      { id: "demo-ev-dinner", title: "Volunteer Appreciation Dinner", days: [35, 35], status: "published", visibility: "private", venue: "Natya Center Hall",
        roles: [{ name: "Set-up helpers", shifts: [[35, "16:00", "18:00", 5, 3]] }] },
      { id: "demo-ev-fair", title: "Summer Fair", days: [-20, -20], status: "published", venue: "Riverside Park",
        roles: [{ name: "Stall helpers", shifts: [[-20, "10:00", "16:00", 10, 10]] }] }
    ]
  };

  function isLoaded() {
    return !!O.get(ORG_ID);
  }

  function remove() {
    var isDemo = function (x) { return String(x.id || "").indexOf("demo-") !== 0; };
    F.store(EVENTS_KEY, (F.load(EVENTS_KEY) || []).filter(isDemo));
    F.store(MAIN_KEY, (F.load(MAIN_KEY) || []).filter(isDemo));
    F.store(SIGNUPS_KEY, (F.load(SIGNUPS_KEY) || []).filter(function (s) { return String(s.eventId || "").indexOf("demo-") !== 0; }));
    if (O.get(ORG_ID)) O.remove(ORG_ID);
  }

  // Loads (or reloads) the demo and makes it the current organization.
  // Returns counts of what was created.
  function load() {
    remove();
    var now = new Date().toISOString();
    O.save({
      id: ORG_ID,
      name: "Riverside Community Arts (demo)",
      website: "https://example.org",
      description: "A demo organization for testing Sevak. Its events, roles and sign-ups are made up.",
      address: { country: "US", line1: "200 Elm Street", city: "Austin", state: "TX", postalCode: "78701" },
      taxStatus: "charity",
      primaryContact: { name: "Demo Coordinator", title: "Volunteer Coordinator", email: "coordinator@example.org" },
      team: [],
      verificationStatus: "verified",
      createdAt: now,
      updatedAt: now
    });
    O.setCurrent(ORG_ID);

    var mains = PLAN.mains.map(function (m) {
      return { id: m.id, organizationId: ORG_ID, organizationName: "Riverside Community Arts (demo)", title: m.title, description: m.description, createdAt: now, updatedAt: now };
    });
    var events = [];
    var signups = [];
    var nameIndex = 0;
    PLAN.events.forEach(function (p) {
      var roles = p.roles.map(function (r, ri) {
        return {
          id: p.id + "-role-" + ri,
          name: r.name,
          description: r.description || "",
          bring: r.bring || "",
          shifts: r.shifts.map(function (s, si) {
            var shiftId = p.id + "-shift-" + ri + "-" + si;
            for (var i = 0; i < s[4]; i++) {
              var name = NAMES[nameIndex++ % NAMES.length];
              signups.push({
                id: shiftId + "-su-" + i, demo: true, registrationId: "demo-reg-" + shiftId + "-" + i,
                eventId: p.id, shiftId: shiftId, name: name,
                email: name.toLowerCase().replace(/[^a-z]+/g, ".") + "@example.com",
                status: "confirmed", createdAt: now
              });
            }
            return { id: shiftId, date: day(s[0]), start: s[1], end: s[2], capacity: s[3] };
          })
        };
      });
      events.push({
        id: p.id, organizationId: ORG_ID, organizationName: "Riverside Community Arts (demo)", mainEventId: p.main,
        title: p.title, description: p.description || "",
        startDate: day(p.days[0]), endDate: day(p.days[1]), timezone: timezone(),
        location: { type: "in-person", venue: p.venue, country: "US", line1: "200 Elm Street", city: "Austin", state: "TX", postalCode: "78701" },
        roles: roles, visibility: p.visibility || "public", status: p.status, createdAt: now, updatedAt: now
      });
    });
    F.store(MAIN_KEY, (F.load(MAIN_KEY) || []).concat(mains));
    F.store(EVENTS_KEY, (F.load(EVENTS_KEY) || []).concat(events));
    F.store(SIGNUPS_KEY, (F.load(SIGNUPS_KEY) || []).concat(signups));
    return { mainEvents: mains.length, events: events.length, signups: signups.length };
  }

  window.SevakDemo = { load: load, remove: remove, isLoaded: isLoaded, orgId: ORG_ID };
})();
