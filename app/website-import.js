// Reads an organization's description and address from its website.
//
// Browsers only let a page read another site if that site allows it (CORS),
// and most don't. So in this static prototype the fetch often fails. Once
// Sevak has a server, fetchDetails should call it instead (see ORG-10);
// extract() stays the same.
(function () {
  "use strict";

  var TIMEOUT_MS = 8000;
  var ORG_TYPES = /^(Organization|NGO|NonprofitOrganization|LocalBusiness|Corporation|EducationalOrganization|School|CollegeOrUniversity|GovernmentOrganization|Place|PlaceOfWorship|Church|SportsOrganization|CivicStructure)$/i;

  function clean(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function typesOf(node) {
    var t = node && node["@type"];
    return Array.isArray(t) ? t : t ? [t] : [];
  }

  // Flattens JSON-LD blocks, including @graph arrays, into a list of objects.
  function jsonLdNodes(doc) {
    var nodes = [];
    var visit = function (value) {
      if (Array.isArray(value)) { value.forEach(visit); return; }
      if (!value || typeof value !== "object") return;
      nodes.push(value);
      if (value["@graph"]) visit(value["@graph"]);
    };
    doc.querySelectorAll('script[type="application/ld+json"]').forEach(function (script) {
      try { visit(JSON.parse(script.textContent)); } catch (e) { /* skip invalid blocks */ }
    });
    return nodes;
  }

  function addressFromSchema(address) {
    if (!address) return null;
    if (Array.isArray(address)) address = address[0];
    if (typeof address === "string") return { line1: clean(address) };
    var country = address.addressCountry;
    if (country && typeof country === "object") country = country.name || country["@id"] || "";
    var result = {
      line1: clean(address.streetAddress),
      city: clean(address.addressLocality),
      state: clean(address.addressRegion),
      postalCode: clean(address.postalCode),
      country: clean(country)
    };
    return result.line1 || result.city || result.postalCode ? result : null;
  }

  function addressFromMicrodata(doc) {
    var get = function (prop) {
      var el = doc.querySelector('[itemprop="' + prop + '"]');
      return el ? clean(el.getAttribute("content") || el.textContent) : "";
    };
    var result = {
      line1: get("streetAddress"),
      city: get("addressLocality"),
      state: get("addressRegion"),
      postalCode: get("postalCode"),
      country: get("addressCountry")
    };
    return result.line1 || result.city ? result : null;
  }

  function meta(doc, selector) {
    var el = doc.querySelector(selector);
    return el ? clean(el.getAttribute("content")) : "";
  }

  // Returns { description, address } from a page's HTML. Either may be empty.
  function extract(html) {
    var doc = new DOMParser().parseFromString(html, "text/html");
    var nodes = jsonLdNodes(doc);
    var orgs = nodes.filter(function (n) { return typesOf(n).some(function (t) { return ORG_TYPES.test(t); }); });

    var description = "";
    var address = null;
    orgs.forEach(function (n) {
      if (!description && typeof n.description === "string") description = clean(n.description);
      if (!address) address = addressFromSchema(n.address);
    });
    if (!address) {
      nodes.forEach(function (n) {
        if (!address && typesOf(n).indexOf("PostalAddress") !== -1) address = addressFromSchema(n);
      });
    }
    if (!address) address = addressFromMicrodata(doc);

    description = description ||
      meta(doc, 'meta[property="og:description"]') ||
      meta(doc, 'meta[name="description"]') ||
      meta(doc, 'meta[name="twitter:description"]');

    return { description: description.slice(0, 1000), address: address };
  }

  // Fetches the website and extracts details. Rejects with an Error whose
  // `reason` is "blocked" (the site doesn't allow it or can't be reached),
  // "timeout" or "http".
  function fetchDetails(url) {
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, TIMEOUT_MS) : null;
    return fetch(url, { mode: "cors", credentials: "omit", redirect: "follow", signal: controller && controller.signal })
      .then(function (response) {
        if (!response.ok) {
          var err = new Error("HTTP " + response.status);
          err.reason = "http";
          throw err;
        }
        return response.text();
      })
      .then(extract)
      .catch(function (e) {
        if (!e.reason) e.reason = e.name === "AbortError" ? "timeout" : "blocked";
        throw e;
      })
      .finally(function () { if (timer) clearTimeout(timer); });
  }

  window.SevakWebsite = { extract: extract, fetchDetails: fetchDetails };
})();
