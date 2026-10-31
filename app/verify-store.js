// Organization verification (prototype), kept in this browser.
//
// An organization's Admin asks Sevak to verify it, with evidence taken from
// its saved profile: a charity or tax registration number, its website, and
// whether the contact email is on the website's domain. Sevak's staff then
// approve or reject the request (ORG-3, ADM-1). Only verified organizations
// list public events.
//
//   verificationStatus: "unverified" | "pending" | "verified" | "rejected"
//   verification: { requestedAt, requestedBy, requestedByName, note,
//                   evidence: { registrationNumber, website, contactEmail,
//                               emailMatchesWebsite, taxStatus },
//                   decidedAt, decidedBy, reason }
//
// The prototype has no staff accounts, so review.html stands in for Sevak's
// review queue, and emails go to the outbox (see members-store.js).
(function () {
  "use strict";

  var ORGS_KEY = "sevak.organizations.v1";
  var F = window.SevakForms;
  var O = window.SevakOrgs;

  function now() { return new Date().toISOString(); }

  function writeOrg(id, patch) {
    var list = F.load(ORGS_KEY) || [];
    var found = null;
    list = list.map(function (o) {
      if (o.id !== id) return o;
      found = Object.assign({}, o, patch);
      return found;
    });
    return found && F.store(ORGS_KEY, list) ? found : null;
  }

  function email(to, subject, body, link, linkText) {
    if (window.SevakMembers && to) window.SevakMembers.email(to, subject, body, link, linkText);
  }

  function status(org) {
    var s = org && org.verificationStatus;
    return s === "verified" || s === "pending" || s === "rejected" ? s : "unverified";
  }

  function domainOf(text) {
    var t = String(text || "").trim().toLowerCase();
    if (!t) return "";
    if (t.indexOf("@") !== -1) return t.split("@").pop();
    try { return new URL(/^https?:\/\//.test(t) ? t : "https://" + t).hostname; } catch (e) { return ""; }
  }

  // An email on the website's domain (or a subdomain of it): www. ignored.
  function sameDomain(emailAddress, website) {
    var a = domainOf(emailAddress).replace(/^www\./, "");
    var b = domainOf(website).replace(/^www\./, "");
    if (!a || !b) return false;
    return a === b || a.slice(-(b.length + 1)) === "." + b || b.slice(-(a.length + 1)) === "." + a;
  }

  // What a request would send, from the saved profile.
  function evidence(org) {
    var contact = (org && org.primaryContact) || {};
    return {
      registrationNumber: (org && org.registrationNumber) || "",
      website: (org && org.website) || "",
      contactEmail: contact.email || "",
      emailMatchesWebsite: sameDomain(contact.email, org && org.website),
      taxStatus: (org && org.taxStatus) || ""
    };
  }

  // A request needs something to check: a registration number or a website.
  function canRequest(org) {
    if (!org) return { ok: false, reason: "Save your organization first." };
    var ev = evidence(org);
    if (!ev.registrationNumber && !ev.website) {
      return { ok: false, reason: "Add a registration number (Status tab) or your website (About tab), and save, so we have something to check." };
    }
    return { ok: true };
  }

  function me() {
    var p = F.session.signedIn() ? F.session.profile() : null;
    return p ? { email: p.email, name: [p.firstName, p.lastName].filter(Boolean).join(" ") || p.email } : { email: "", name: "" };
  }

  // ---------- The organization ----------

  function request(orgId, note) {
    var org = O.get(orgId);
    var check = canRequest(org);
    if (!check.ok) return null;
    var who = me();
    var saved = writeOrg(orgId, {
      verificationStatus: "pending",
      verification: {
        requestedAt: now(),
        requestedBy: who.email,
        requestedByName: who.name,
        note: String(note || "").trim().slice(0, 500),
        evidence: evidence(org)
      }
    });
    if (saved) {
      email(who.email || (org.primaryContact || {}).email, "We received your verification request for " + org.name,
        "Thanks for asking Sevak to verify " + org.name + ". We'll check the details you sent and let you know, usually within two working days. Until then, its public events stay private; you can still share their links.",
        "organization.html", "Open your organization");
    }
    return saved;
  }

  function withdraw(orgId) {
    var org = O.get(orgId);
    if (!org || status(org) !== "pending") return null;
    return writeOrg(orgId, { verificationStatus: "unverified", verification: undefined });
  }

  // ---------- Sevak's staff (review.html in the prototype) ----------

  function decide(orgId, verified, reason) {
    var org = O.get(orgId);
    if (!org || status(org) !== "pending") return null;
    var v = Object.assign({}, org.verification, { decidedAt: now(), decidedBy: me().email || "Sevak", reason: verified ? "" : String(reason || "").trim().slice(0, 500) });
    var saved = writeOrg(orgId, { verificationStatus: verified ? "verified" : "rejected", verification: v });
    if (!saved) return null;
    var to = v.requestedBy || (org.primaryContact || {}).email;
    if (verified) {
      email(to, org.name + " is verified",
        "Good news: Sevak has verified " + org.name + ". It now shows a Verified badge, and its public events are listed for volunteers to find.",
        "events.html", "See your events");
    } else {
      email(to, "Your verification request for " + org.name,
        "We couldn't verify " + org.name + " yet. " + (v.reason ? "Reason: " + v.reason + " " : "") + "You can update your organization's profile and ask again.",
        "organization.html", "Open your organization");
    }
    return saved;
  }

  function approve(orgId) { return decide(orgId, true); }
  function reject(orgId, reason) { return decide(orgId, false, reason); }

  // Waiting requests, oldest first.
  function queue() {
    return O.all().filter(function (o) { return status(o) === "pending"; })
      .sort(function (a, b) { return ((a.verification || {}).requestedAt || "").localeCompare((b.verification || {}).requestedAt || ""); });
  }

  // Decided requests, newest first.
  function decided() {
    return O.all().filter(function (o) { return o.verification && o.verification.decidedAt; })
      .sort(function (a, b) { return b.verification.decidedAt.localeCompare(a.verification.decidedAt); });
  }

  window.SevakVerify = {
    status: status,
    evidence: evidence,
    canRequest: canRequest,
    sameDomain: sameDomain,
    request: request,
    withdraw: withdraw,
    approve: approve,
    reject: reject,
    queue: queue,
    decided: decided
  };
})();
