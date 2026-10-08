// A profile photo picker (prototype): take a photo with the camera, drag and
// drop an image, or choose a file. The picture is cropped to a square and
// shrunk to SIZE pixels, then kept as a JPEG data URL with the form's data.
(function () {
  "use strict";

  var SIZE = 400;
  var MAX_BYTES = 15 * 1024 * 1024;
  var counter = 0;

  var PERSON_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="12" cy="8.5" r="4"/><path d="M4.5 20.5c1.2-3.8 4.2-5.8 7.5-5.8s6.3 2 7.5 5.8"/></svg>';

  // Draws the centre square of `source` (an image, bitmap or video frame of
  // width w and height h) onto a SIZE x SIZE canvas and returns a JPEG data URL.
  function toSquare(source, w, h, mirror) {
    var side = Math.min(w, h);
    var canvas = document.createElement("canvas");
    canvas.width = canvas.height = SIZE;
    var ctx = canvas.getContext("2d");
    if (mirror) { ctx.translate(SIZE, 0); ctx.scale(-1, 1); }
    ctx.drawImage(source, (w - side) / 2, (h - side) / 2, side, side, 0, 0, SIZE, SIZE);
    return canvas.toDataURL("image/jpeg", 0.85);
  }

  function readImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        resolve(toSquare(img, img.naturalWidth, img.naturalHeight, false));
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("unreadable"));
      };
      img.src = url;
    });
  }

  function hasFiles(e) {
    return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], "Files") !== -1;
  }

  // Builds the picker inside `container`. opts.onChange(dataUrl or "") is
  // called when the photo changes. Returns { get, set }.
  function mount(container, opts) {
    opts = opts || {};
    var id = "photo" + (++counter);
    var value = "";

    container.className = "photo-field";
    container.innerHTML =
      '<div class="photo-frame" aria-hidden="true">' +
        '<img class="photo-img" alt="" hidden>' +
        '<span class="photo-placeholder">' + PERSON_ICON + '</span>' +
      '</div>' +
      '<div class="photo-body">' +
        '<p class="label" id="' + id + '-label">Photo <span class="optional">(optional)</span></p>' +
        '<p class="hint photo-hint">Helps organizers recognise you at events. Take one with your camera, choose a file, or drag and drop a picture here.</p>' +
        '<div class="photo-buttons">' +
          '<button type="button" class="btn btn-secondary btn-small photo-camera">Take a photo</button>' +
          '<button type="button" class="btn btn-secondary btn-small photo-choose">Choose a file</button>' +
          '<button type="button" class="btn btn-danger-link photo-remove" hidden>Remove photo</button>' +
        '</div>' +
        '<input type="file" class="photo-file" accept="image/*" hidden>' +
        '<input type="file" class="photo-capture" accept="image/*" capture="user" hidden>' +
        '<p class="error photo-error" id="' + id + '-error"></p>' +
        '<p class="status photo-status" role="status" aria-live="polite"></p>' +
      '</div>' +
      '<div class="photo-drop-hint" aria-hidden="true">Drop your photo here</div>';

    var dialog = document.createElement("dialog");
    dialog.className = "camera-dialog";
    dialog.setAttribute("aria-labelledby", id + "-camera-title");
    dialog.innerHTML =
      '<h2 class="camera-title" id="' + id + '-camera-title">Take a photo</h2>' +
      '<div class="camera-frame"><video class="camera-video" autoplay playsinline muted></video>' +
        '<div class="camera-guide" aria-hidden="true"></div>' +
        '<p class="camera-message" role="status" aria-live="polite">Starting your camera…</p></div>' +
      '<div class="camera-actions">' +
        '<button type="button" class="btn btn-secondary camera-cancel">Cancel</button>' +
        '<button type="button" class="btn btn-secondary camera-file" hidden>Choose a file instead</button>' +
        '<button type="button" class="btn btn-primary camera-shoot" disabled>Take photo</button>' +
      '</div>';
    document.body.appendChild(dialog);

    var q = function (sel, root) { return (root || container).querySelector(sel); };
    var img = q(".photo-img"), placeholder = q(".photo-placeholder");
    var fileInput = q(".photo-file"), captureInput = q(".photo-capture");
    var errorEl = q(".photo-error"), statusEl = q(".photo-status"), removeBtn = q(".photo-remove");
    var video = q(".camera-video", dialog), message = q(".camera-message", dialog);
    var shoot = q(".camera-shoot", dialog), fileInstead = q(".camera-file", dialog);
    var stream = null;

    function show(dataUrl) {
      value = dataUrl || "";
      img.hidden = !value;
      placeholder.hidden = !!value;
      if (value) {
        img.src = value;
        img.alt = "Your photo";
      } else {
        img.removeAttribute("src");
      }
      q(".photo-frame").setAttribute("aria-hidden", value ? "false" : "true");
      removeBtn.hidden = !value;
      q(".photo-camera").textContent = value ? "Retake photo" : "Take a photo";
    }

    function setError(msg) {
      errorEl.textContent = msg;
      if (msg) statusEl.textContent = "";
    }

    function changed(dataUrl, how) {
      show(dataUrl);
      setError("");
      statusEl.textContent = how;
      if (opts.onChange) opts.onChange(value);
    }

    function useFile(file) {
      if (!file) return;
      if (!/^image\//.test(file.type || "") && !/\.(jpe?g|png|gif|webp|bmp|heic|heif)$/i.test(file.name || "")) {
        setError("That isn't an image. Choose a JPEG, PNG or similar picture.");
        return;
      }
      if (file.size > MAX_BYTES) {
        setError("That picture is too large (over 15 MB). Choose a smaller one.");
        return;
      }
      statusEl.textContent = "Adding your photo…";
      readImage(file).then(function (dataUrl) {
        changed(dataUrl, "Photo added. Save your profile to keep it.");
      }).catch(function () {
        statusEl.textContent = "";
        setError("We couldn't read that picture. Try a JPEG or PNG.");
      });
    }

    // ---------- Choose a file ----------

    q(".photo-choose").addEventListener("click", function () { fileInput.click(); });
    [fileInput, captureInput].forEach(function (input) {
      input.addEventListener("change", function () {
        useFile(input.files[0]);
        input.value = "";
      });
    });

    removeBtn.addEventListener("click", function () {
      changed("", "Photo removed. Save your profile to keep this change.");
      q(".photo-choose").focus();
    });

    // ---------- Drag and drop ----------
    // The whole photo area takes drops. Elsewhere on the page a dropped file
    // is ignored, so the browser doesn't navigate away from the form.

    var depth = 0;
    container.addEventListener("dragenter", function (e) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth += 1;
      container.classList.add("is-dragover");
    });
    container.addEventListener("dragover", function (e) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    });
    container.addEventListener("dragleave", function () {
      depth = Math.max(0, depth - 1);
      if (!depth) container.classList.remove("is-dragover");
    });
    container.addEventListener("drop", function (e) {
      e.preventDefault();
      e.stopPropagation();
      depth = 0;
      container.classList.remove("is-dragover");
      useFile(e.dataTransfer.files[0]);
    });
    window.addEventListener("dragover", function (e) { if (hasFiles(e)) e.preventDefault(); });
    window.addEventListener("drop", function (e) { if (hasFiles(e)) e.preventDefault(); });

    // ---------- Camera ----------
    // Uses a live preview where the browser allows it; otherwise falls back
    // to the device's camera app (on phones) or a file picker.

    function stopCamera() {
      if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
      stream = null;
      video.srcObject = null;
    }

    function cameraFailed(err) {
      var name = err && err.name;
      message.textContent = name === "NotAllowedError" || name === "SecurityError"
        ? "Camera access is blocked. Allow it in your browser's settings, or choose a file instead."
        : name === "NotFoundError" || name === "OverconstrainedError"
          ? "We couldn't find a camera on this device. You can choose a file instead."
          : "We couldn't start your camera. You can choose a file instead.";
      message.hidden = false;
      shoot.disabled = true;
      fileInstead.hidden = false;
    }

    q(".photo-camera").addEventListener("click", function () {
      setError("");
      if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) || typeof dialog.showModal !== "function") {
        captureInput.click();
        return;
      }
      message.textContent = "Starting your camera…";
      message.hidden = false;
      shoot.disabled = true;
      fileInstead.hidden = true;
      dialog.showModal();
      navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false })
        .then(function (s) {
          if (!dialog.open) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
          stream = s;
          video.srcObject = s;
          return video.play().catch(function () { /* autoplay handles it */ });
        })
        .catch(cameraFailed);
    });

    video.addEventListener("loadeddata", function () {
      message.hidden = true;
      shoot.disabled = false;
      shoot.focus();
    });

    shoot.addEventListener("click", function () {
      if (!video.videoWidth) return;
      // The preview is mirrored like a mirror; the photo matches what you saw.
      var dataUrl = toSquare(video, video.videoWidth, video.videoHeight, true);
      stopCamera();
      dialog.close();
      changed(dataUrl, "Photo taken. Save your profile to keep it.");
      q(".photo-camera").focus();
    });

    q(".camera-cancel", dialog).addEventListener("click", function () {
      stopCamera();
      dialog.close();
    });
    fileInstead.addEventListener("click", function () {
      stopCamera();
      dialog.close();
      fileInput.click();
    });
    // Escape fires "cancel" straight away; "close" follows a moment later.
    dialog.addEventListener("cancel", stopCamera);
    dialog.addEventListener("close", stopCamera);

    show("");
    return {
      get: function () { return value; },
      set: function (dataUrl) {
        show(dataUrl);
        setError("");
        statusEl.textContent = "";
      }
    };
  }

  window.SevakPhoto = { mount: mount };
})();
