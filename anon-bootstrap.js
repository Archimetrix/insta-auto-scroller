(() => {
  "use strict";

  if (window.__igav_bootstrapped) return;
  window.__igav_bootstrapped = true;

  const api = typeof browser !== "undefined" ? browser : chrome;

  const injectScript = () => {
    const script = document.createElement("script");
    script.src = api.runtime.getURL("inject.js");
    script.async = false;
    script.onload = () => script.remove();
    script.onerror = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
  };

  api.storage.sync.get({ anonStoryViewer: false }, (result) => {
    if (result.anonStoryViewer) {
      injectScript();
    }
  });
})();
