(function () {
  "use strict";

  if (window.__igav_injected) return;
  window.__igav_injected = true;

  const config = {
    blockedPatterns: [/viewSeenAt/i, /story_view/i],
  };

  const notifyBlocked = () => {
    try { window.postMessage({ source: "igav", type: "blocked" }, "*"); } catch (_e) {}
  };

  const isPlainObject = (v) => Object.prototype.toString.call(v) === "[object Object]";

  const isLikelyTargetUrl = (url) => {
    if (!url || typeof url !== "string") return false;
    return /\/graphql\//i.test(url) || /graphql\/query/i.test(url);
  };

  const isAllowedContentType = (ct) => {
    if (!ct || typeof ct !== "string") return true;
    return /application\/json|application\/x-www-form-urlencoded/i.test(ct);
  };

  const getHeader = (headers, key) => {
    if (!headers || !key) return "";
    try {
      if (typeof headers.get === "function") return headers.get(key) || "";
      if (Array.isArray(headers)) {
        const found = headers.find(([n]) => String(n).toLowerCase() === key.toLowerCase());
        return found ? String(found[1] || "") : "";
      }
      if (typeof headers === "object") {
        for (const n of Object.keys(headers)) {
          if (n.toLowerCase() === key.toLowerCase()) return String(headers[n] || "");
        }
      }
    } catch (_e) {}
    return "";
  };

  const bodyToString = (body) => {
    if (!body) return "";
    if (typeof body === "string") return body;
    if (body instanceof URLSearchParams) return body.toString();
    if (body instanceof FormData) {
      try {
        const p = new URLSearchParams();
        for (const [n, v] of body.entries()) p.append(n, typeof v === "string" ? v : "[file]");
        return p.toString();
      } catch (_e) { return ""; }
    }
    if (Array.isArray(body) || isPlainObject(body)) {
      try { return JSON.stringify(body); } catch (_e) { return ""; }
    }
    return "";
  };

  const shouldBlock = (data) => {
    if (!data) return false;
    try { return config.blockedPatterns.some((p) => p.test(data)); } catch (_e) { return false; }
  };

  // --- Override XMLHttpRequest ---
  const origOpen = XMLHttpRequest.prototype.open;
  const origSetHeader = XMLHttpRequest.prototype.setRequestHeader;
  const origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (...args) {
    try { this._igav_url = typeof args[1] === "string" ? args[1] : String(args[1] || ""); } catch (_e) { this._igav_url = ""; }
    return origOpen.apply(this, args);
  };

  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    try {
      if (typeof name === "string" && name.toLowerCase() === "content-type")
        this._igav_content_type = String(value || "");
    } catch (_e) {}
    return origSetHeader.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    try {
      const url = this._igav_url || this.responseURL || "";
      if (isLikelyTargetUrl(url) && isAllowedContentType(this._igav_content_type)) {
        const bodyStr = bodyToString(args[0]);
        if (shouldBlock(bodyStr) || shouldBlock(url)) {
          notifyBlocked();
          return;
        }
      }
    } catch (_e) {}
    return origSend.apply(this, args);
  };

  // --- Override fetch ---
  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    try {
      const [resource, options = {}] = args;
      const url = typeof resource === "string" ? resource : (resource?.url || "");
      if (!isLikelyTargetUrl(url)) return await origFetch.apply(this, args);
      const ct = getHeader(options.headers, "content-type");
      if (!isAllowedContentType(ct)) return await origFetch.apply(this, args);
      const bodyStr = bodyToString(options.body || null);
      if (shouldBlock(bodyStr) || shouldBlock(url)) {
        notifyBlocked();
        return new Promise(() => {});
      }
    } catch (_e) {}
    return origFetch.apply(this, args);
  };

  // Protect overrides from being undone
  try {
    Object.defineProperty(window, "fetch", { value: window.fetch, writable: false, configurable: false });
    Object.defineProperty(XMLHttpRequest.prototype, "send", { value: XMLHttpRequest.prototype.send, writable: false, configurable: false });
  } catch (_e) {}
})();
