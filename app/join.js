// Join Sevak (prototype): with an invitation, or by asking an organization.
//   join.html?code=CODE   → an invite link: join that organization
//   join.html?org=ID      → a request to join that organization, picked
//   &return=URL           → where to go back to afterwards (an event)
// New people carry on to the profile form; their choice is kept until they
// save it (see profile.js). People already signed in join straight away.
(function () {
  "use strict";

  var INTENT_KEY = "sevak.joinIntent.v1";
  var F = window.SevakForms;
  var O = window.SevakOrgs;
  var M = window.SevakMembers;
  var $ = function (id) { return document.getElementById(id); };
  var params = new URLSearchParams(location.search);
  var signedIn = F.session.signedIn();
  var returnTo = /^signup\.html\?event=[\w-]+$/.test(params.get("return") || "") ? params.get("return") : "";

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function way() {
    var r = document.querySelector('input[name="way"]:checked');
    return r ? r.value : "";
  }

  function applyWay() {
    $("invite-section").hidden = way() !== "invite";
    $("request-section").hidden = way() !== "request";
    $("way-error").textContent = "";
  }

  // ---------- Invitation ----------

  // Accepts a whole link or just the code.
  function codeFrom(text) {
    var t = String(text || "").trim();
    var m = t.match(/[?&]code=([^&#\s]+)/i);
    return (m ? decodeURIComponent(m[1]) : t).toUpperCase().replace(/[^A-Z0-9]/g, "");
  }

  function checkCode() {
    var org = M.orgByCode(codeFrom($("code").value));
    $("code-found").hidden = !org;
    if (org) {
      $("code-found").textContent = "";
      $("code-found").appendChild(document.createTextNode("Invitation from "));
      $("code-found").appendChild(el("strong", null, org.name));
      $("code-found").appendChild(document.createTextNode(". You'll be a volunteer with them as soon as you join."));
      F.setError($("code"), "");
    }
    return org;
  }

  // ---------- Request ----------

  function place(o) {
    var a = o.address || {};
    return [a.city, a.state].filter(Boolean).join(", ");
  }

  function renderOrgs() {
    var q = $("org-search").value.trim().toLowerCase();
    var picked = (document.querySelector('input[name="org"]:checked') || {}).value || params.get("org");
    var list = $("org-pick");
    list.innerHTML = "";
    var orgs = O.all().filter(function (o) { return o.name; })
      .filter(function (o) { return !q || (o.name + " " + place(o)).toLowerCase().indexOf(q) !== -1; })
      .sort(function (a, b) {
        var va = a.verificationStatus === "verified" ? 0 : 1, vb = b.verificationStatus === "verified" ? 0 : 1;
        return va - vb || a.name.localeCompare(b.name);
      });
    orgs.forEach(function (o) {
      var status = signedIn ? M.myStatus(o.id) : null;
      var li = el("li");
      var label = el("label", "org-pick-item");
      var r = el("input");
      r.type = "radio";
      r.name = "org";
      r.value = o.id;
      r.checked = o.id === picked;
      r.disabled = status === "team" || status === "active";
      var text = el("span", "org-pick-text");
      text.appendChild(el("strong", null, o.name));
      if (place(o)) text.appendChild(el("span", "hint", place(o)));
      label.appendChild(r);
      label.appendChild(text);
      var tag = status === "team" || status === "active" ? "You're a member"
        : status === "requested" ? "Request sent"
        : o.verificationStatus === "verified" ? "Verified" : "";
      if (tag) label.appendChild(el("span", "badge" + (tag === "Verified" ? " badge-published" : ""), tag));
      li.appendChild(label);
      list.appendChild(li);
    });
    $("org-pick-empty").hidden = orgs.length > 0;
    $("org-pick-empty").textContent = q ? "No organizations match." : "No organizations on Sevak yet. Ask the organization you volunteer with for its invite link.";
  }

  // ---------- Continue ----------

  function done(html) {
    $("join-form").hidden = true;
    $("join-alt").hidden = true;
    var box = $("join-done");
    box.innerHTML = "";
    html.forEach(function (part) { box.appendChild(part); });
    box.hidden = false;
    box.setAttribute("tabindex", "-1");
    box.focus();
  }

  function goLink(href, text) {
    var a = el("a", "btn btn-primary btn-small", text);
    a.href = href;
    var p = el("p");
    p.appendChild(a);
    return p;
  }

  function finish(org, rec) {
    var next = returnTo || "signup.html#my-orgs";
    if (rec && rec.status === "active") {
      done([el("p", null, "You're now a volunteer with " + org.name + "."),
        goLink(next, returnTo ? "Back to the event" : "See its opportunities")]);
    } else {
      done([el("p", null, "Request sent to " + org.name + ". You can sign up for its events as soon as they approve you; you'll see a note here on Sevak when they do."),
        goLink("signup.html#all-orgs", "Browse opportunities")]);
    }
  }

  $("join-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var w = way();
    if (!w) {
      $("way-error").textContent = "Choose how you're joining.";
      $("way-invite").focus();
      return;
    }
    var org = null, note = "";
    if (w === "invite") {
      org = checkCode();
      if (!org) {
        F.setError($("code"), $("code").value.trim() ? "We don't recognise that invitation. Check the link or code, or ask the organization for a new one." : "Enter your invitation link or code.");
        $("code").focus();
        return;
      }
    } else {
      var picked = document.querySelector('input[name="org"]:checked');
      $("org-error").textContent = picked ? "" : "Choose the organization you want to join.";
      if (!picked) { ($("org-pick").querySelector("input:not(:disabled)") || $("org-search")).focus(); return; }
      org = O.get(picked.value);
      note = $("note").value;
    }

    if (signedIn) {
      if (M.isMember(org.id)) {
        done([el("p", null, "You're already a volunteer with " + org.name + "."), goLink(returnTo || "signup.html#my-orgs", "See its opportunities")]);
        return;
      }
      var rec = M.request(org.id, note, w === "invite");
      window.SevakNav.render();
      finish(org, rec);
      return;
    }
    // New here: keep the choice and make a profile first.
    F.store(INTENT_KEY, { way: w, orgId: org.id, note: note, returnTo: returnTo });
    location.href = "profile.html?join=1";
  });

  $("create-org").addEventListener("click", function (e) {
    e.preventDefault();
    if (signedIn) { location.href = "organization.html?new=1"; return; }
    F.store(INTENT_KEY, { way: "create" });
    location.href = "profile.html?join=1";
  });

  // ---------- Start ----------

  if (signedIn) {
    $("join-title").textContent = "Join an organization";
    $("join-intro").textContent = "Volunteer with another organization: use its invitation, or ask to join.";
  }
  document.querySelectorAll('input[name="way"]').forEach(function (r) { r.addEventListener("change", applyWay); });
  $("code").addEventListener("input", function () { if (codeFrom($("code").value).length >= 6) checkCode(); else $("code-found").hidden = true; });
  $("org-search").addEventListener("input", renderOrgs);
  $("org-pick").addEventListener("change", function () { $("org-error").textContent = ""; });
  F.clearErrorsAsYouType($("join-form"), function () { return ""; });

  if (params.get("code")) {
    $("way-invite").checked = true;
    $("code").value = params.get("code");
    checkCode();
  } else if (params.get("org")) {
    $("way-request").checked = true;
  }
  renderOrgs();
  applyWay();
})();
