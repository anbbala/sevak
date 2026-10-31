// Manage → Volunteers (prototype): requests to join, invitations and the
// organization's volunteers. Admins and Coordinators can approve, decline,
// invite and remove; only Admins change "approve automatically".
(function () {
  "use strict";

  var F = window.SevakForms;
  var O = window.SevakOrgs;
  var M = window.SevakMembers;
  var $ = function (id) { return document.getElementById(id); };

  if (!window.SevakNav.guard()) return;
  var org = O.current();
  O.renderSwitcher($("org-switcher"), { switchTo: "volunteers.html" });
  O.renderHeader($("org-context"), org);
  if (!org) {
    $("vol-status").textContent = "Set up your organization first.";
    return;
  }
  var isAdmin = !F.session.signedIn() || O.isAdmin(org);

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function when(iso) {
    if (!iso) return "";
    try { return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" }); } catch (e) { return ""; }
  }

  var SERVICE_NAMES = { general: "General help", av: "AV system help", food: "Food service", website: "Website maintenance", telemarketing: "Telemarketing", fundraising: "Fundraising", accounting: "Accounting", office: "Office help" };

  function initials(name) {
    return String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0].toUpperCase(); }).join("");
  }

  // One person: photo (or initials), name, email and details, then actions.
  function person(m, details, actions) {
    var li = el("li", "person");
    li.id = "person-" + m.id;
    li.tabIndex = -1;
    var pic = el("span", "person-pic");
    if (m.photo) {
      var img = el("img");
      img.src = m.photo;
      img.alt = "";
      pic.appendChild(img);
    } else {
      pic.textContent = initials(m.name || m.email);
    }
    pic.setAttribute("aria-hidden", "true");
    li.appendChild(pic);
    var text = el("div", "person-text");
    text.appendChild(el("strong", null, m.name || m.email));
    if (m.name) text.appendChild(el("span", "hint", m.email));
    details.filter(Boolean).forEach(function (d) { text.appendChild(el("p", "person-detail", d)); });
    li.appendChild(text);
    var act = el("div", "person-actions");
    actions.forEach(function (a) {
      var b = el("button", "btn " + a.cls, a.text);
      b.type = "button";
      b.setAttribute("aria-label", a.text + " " + (m.name || m.email));
      b.addEventListener("click", a.onClick);
      act.appendChild(b);
    });
    li.appendChild(act);
    return li;
  }

  // After an action: redraw, update the menu count, say what happened, and
  // keep keyboard focus nearby (the item may have moved to another list).
  function after(message) {
    render();
    window.SevakNav.render();
    $("vol-status").textContent = message;
    $("requests-title").tabIndex = -1;
    $("requests-title").focus();
  }

  var expanded = false;

  function render() {
    var list = M.forOrg(org.id);
    var by = function (status) { return list.filter(function (m) { return m.status === status; }); };

    // Requests
    var requests = by("requested").sort(function (a, b) { return (a.requestedAt || "").localeCompare(b.requestedAt || ""); });
    var rl = $("request-list");
    rl.innerHTML = "";
    requests.forEach(function (m) {
      var services = (m.services || []).map(function (s) { return SERVICE_NAMES[s] || s; }).join(", ");
      rl.appendChild(person(m, [
        m.note ? "“" + m.note + "”" : "",
        services ? "Can help with: " + services : "",
        "Asked " + when(m.requestedAt)
      ], [
        { text: "Approve", cls: "btn-primary btn-small", onClick: function () { M.approve(m.id); after((m.name || m.email) + " is now a volunteer. (Approval email in the outbox.)"); } },
        { text: "Decline", cls: "btn-secondary btn-small", onClick: function () {
          if (!window.confirm("Decline " + (m.name || m.email) + "'s request?")) return;
          M.decline(m.id);
          after("Request declined.");
        } }
      ]));
    });
    $("requests-empty").hidden = requests.length > 0;
    $("requests-title").textContent = requests.length ? "Requests to join (" + requests.length + ")" : "Requests to join";

    // Approve automatically (Admins)
    $("auto-approve").checked = !!org.autoApprove;
    $("auto-approve").disabled = !isAdmin;
    $("auto-hint").hidden = isAdmin;
    $("auto-hint").textContent = isAdmin ? "" : "Only Admins can change this.";

    // Invite link
    var code = M.inviteCode(org.id);
    org = O.get(org.id);
    $("invite-link").value = M.inviteLink(code);
    $("invite-code").textContent = code;

    // Invited
    var invited = by("invited");
    var il = $("invited-list");
    il.innerHTML = "";
    invited.forEach(function (m) {
      il.appendChild(person(m, ["Invited " + when(m.invitedAt)], [
        { text: "Cancel invitation", cls: "btn-danger-link", onClick: function () { M.remove(m.id); after("Invitation cancelled."); } }
      ]));
    });
    $("invited-title").hidden = !invited.length;

    // Volunteers
    var active = by("active").sort(function (a, b) { return (a.name || a.email).localeCompare(b.name || b.email); });
    var ml = $("member-list");
    ml.innerHTML = "";
    // A long list starts short.
    var SHORT = 8;
    var showAll = $("show-all-members");
    if (!showAll) {
      showAll = el("button", "btn btn-secondary btn-small", "");
      showAll.type = "button";
      showAll.id = "show-all-members";
      showAll.addEventListener("click", function () { expanded = true; render(); ml.children[SHORT] && ml.children[SHORT].focus(); });
      ml.insertAdjacentElement("afterend", showAll);
    }
    var shown = expanded ? active : active.slice(0, SHORT);
    showAll.hidden = expanded || active.length <= SHORT;
    showAll.textContent = "Show all " + active.length + " volunteers";
    var how = { invitation: "Joined by invitation", "auto-approved": "Joined (approved automatically)", request: "Approved" };
    shown.forEach(function (m) {
      ml.appendChild(person(m, [(how[m.how] || "Joined") + " " + when(m.decidedAt || m.createdAt)], [
        { text: "Remove", cls: "btn-danger-link", onClick: function () {
          if (!window.confirm("Remove " + (m.name || m.email) + " from your volunteers? They'd need a new invitation or approval to sign up again.")) return;
          M.remove(m.id);
          after("Removed.");
        } }
      ]));
    });
    $("members-empty").hidden = active.length > 0;
    $("members-title").textContent = active.length ? "Volunteers (" + active.length + ")" : "Volunteers";

    // Declined
    var declined = by("declined");
    $("declined-box").hidden = !declined.length;
    $("declined-summary").textContent = declined.length === 1 ? "1 declined request" : declined.length + " declined requests";
    var dl = $("declined-list");
    dl.innerHTML = "";
    declined.forEach(function (m) {
      dl.appendChild(person(m, [m.note ? "“" + m.note + "”" : "", "Declined " + when(m.decidedAt)], [
        { text: "Approve after all", cls: "btn-secondary btn-small", onClick: function () { M.approve(m.id); after((m.name || m.email) + " is now a volunteer."); } }
      ]));
    });
  }

  // ---------- Invite ----------

  $("copy-link").addEventListener("click", function () {
    var input = $("invite-link");
    input.select();
    var done = function () { $("vol-status").textContent = "Invite link copied."; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(input.value).then(done, function () { document.execCommand("copy"); done(); });
    else { document.execCommand("copy"); done(); }
  });

  $("reset-link").addEventListener("click", function () {
    if (!window.confirm("Make a new invite link? The old link and code stop working.")) return;
    M.resetInviteCode(org.id);
    org = O.get(org.id);
    render();
    $("vol-status").textContent = "New invite link made. The old one no longer works.";
  });

  $("send-invites").addEventListener("click", function () {
    var raw = $("invite-emails").value;
    var emails = raw.split(/[\s,;]+/).map(function (x) { return x.trim(); }).filter(Boolean);
    var bad = emails.filter(function (x) { return !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x); });
    var input = $("invite-emails");
    if (!emails.length) { F.setError(input, "Enter at least one email."); input.focus(); return; }
    if (bad.length) { F.setError(input, "Check " + (bad.length === 1 ? "this email: " : "these emails: ") + bad.join(", ")); input.focus(); return; }
    F.setError(input, "");
    var r = M.invite(org.id, emails);
    input.value = "";
    render();
    $("vol-status").textContent = (r.sent.length ? "Invitation sent to " + r.sent.join(", ") + ". (See the outbox.)" : "") +
      (r.skipped.length ? " Already a volunteer or invited: " + r.skipped.join(", ") + "." : "");
  });

  $("auto-approve").addEventListener("change", function () {
    M.setAutoApprove(org.id, $("auto-approve").checked);
    org = O.get(org.id);
    $("vol-status").textContent = org.autoApprove ? "New requests will be approved automatically." : "You'll approve each request.";
  });

  render();
})();
