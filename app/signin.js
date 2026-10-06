// Prototype sign-in: there is no backend yet, so this matches the email
// against the profile saved in this browser and opens it.
(function () {
  "use strict";

  var F = window.SevakForms;
  var form = document.getElementById("signin-form");
  var email = document.getElementById("email");

  F.clearErrorsAsYouType(form, F.basicMessage);

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var invalid = F.validate([email], F.basicMessage);
    if (invalid) { invalid.focus(); return; }
    var profile = F.load("sevak.profile.v1");
    var saved = profile && profile.email ? String(profile.email).trim().toLowerCase() : "";
    if (saved && saved === email.value.trim().toLowerCase()) {
      window.location.href = "profile.html";
      return;
    }
    F.setError(email, "We couldn't find a profile with that email in this browser. Check it, or sign up.");
    email.focus();
  });
})();
