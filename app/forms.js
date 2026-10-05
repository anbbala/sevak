// Shared helpers for prototype forms: browser storage and field validation.
(function () {
  "use strict";

  function load(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function store(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  }

  function clear(key) {
    try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
  }

  // Shows or clears the message in the element with id "<field id>-error"
  // (or "<field name>-error" for radio groups).
  function setError(input, message) {
    var errorEl = document.getElementById(input.id + "-error") ||
      document.getElementById(input.name + "-error");
    if (message) {
      input.setAttribute("aria-invalid", "true");
      if (errorEl) {
        errorEl.textContent = message;
        input.setAttribute("aria-describedby", errorEl.id);
      }
    } else {
      input.removeAttribute("aria-invalid");
      if (errorEl) errorEl.textContent = "";
    }
  }

  // Checks shared by every form: required fields, radio groups, email and phone.
  function basicMessage(input) {
    var v = input.value.trim();

    if (input.type === "radio") {
      var group = input.form.querySelectorAll('input[name="' + input.name + '"]');
      var picked = Array.prototype.some.call(group, function (r) { return r.checked; });
      return picked ? "" : "Choose one option.";
    }
    if (input.required && !v) {
      return input.tagName === "SELECT" ? "Choose an option." : "This field is required.";
    }
    if (!v) return "";
    if (input.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      return "Enter an email address like name@example.com.";
    }
    if (input.type === "tel") {
      var digits = (v.match(/\d/g) || []).length;
      if (!/^[0-9+().\-\s]+$/.test(v) || digits < 7 || digits > 15) {
        return "Enter a phone number with 7 to 15 digits.";
      }
    }
    if (input.dataset.zip !== undefined && !/^\d{5}(-\d{4})?$/.test(v)) {
      return "Enter a 5-digit ZIP code.";
    }
    return "";
  }

  // Validates the given inputs with messageFor, shows errors, and returns the
  // first invalid input (or null). Hidden inputs are skipped and cleared.
  function validate(inputs, messageFor) {
    var firstInvalid = null;
    var seenRadio = {};
    Array.prototype.forEach.call(inputs, function (input) {
      if (input.closest("[hidden]")) { setError(input, ""); return; }
      if (input.type === "radio") {
        if (seenRadio[input.name]) return;
        seenRadio[input.name] = true;
      }
      var msg = messageFor(input);
      setError(input, msg);
      if (msg && !firstInvalid) firstInvalid = input;
    });
    return firstInvalid;
  }

  // Clears a field's error as soon as it becomes valid.
  function clearErrorsAsYouType(form, messageFor) {
    form.addEventListener("input", function (e) {
      var t = e.target;
      if (t.getAttribute("aria-invalid") === "true" && !messageFor(t)) setError(t, "");
    });
    form.addEventListener("change", function (e) {
      var t = e.target;
      if (t.type === "radio") {
        var errorEl = document.getElementById(t.name + "-error");
        if (errorEl) errorEl.textContent = "";
      }
    });
  }

  window.SevakForms = {
    load: load,
    store: store,
    clear: clear,
    setError: setError,
    basicMessage: basicMessage,
    validate: validate,
    clearErrorsAsYouType: clearErrorsAsYouType
  };
})();
