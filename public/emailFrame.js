// Bootstrap script for the sandboxed email body frame.
//
// The frame runs with `sandbox="allow-scripts"` and therefore has an opaque
// origin: the app cannot reach into the frame's document, and the frame cannot
// reach the app. Everything the frame needs to tell the app travels through
// postMessage.
//
// This file is served from the app's own origin on purpose. The inherited CSP
// is `script-src 'self'`, so this script runs while any script embedded in an
// email stays blocked even if it survives sanitization.

(function () {
  var LINK = "maish:link";
  var HEIGHT = "maish:height";

  function send(message) {
    parent.postMessage(message, "*");
  }

  // Links must never navigate the frame — the app opens them in the browser.
  document.addEventListener("click", function (event) {
    var target = event.target;
    var anchor = target && target.closest ? target.closest("a") : null;
    if (!anchor) return;

    var url = anchor.getAttribute("href");
    if (!url) return;

    event.preventDefault();
    send({ type: LINK, url: anchor.href || url });
  });

  var lastHeight = -1;

  function reportHeight() {
    var height = document.documentElement.scrollHeight;
    if (height > 0 && height !== lastHeight) {
      lastHeight = height;
      send({ type: HEIGHT, height: height });
    }
  }

  // Images and fonts settle after the first paint, so keep watching.
  if (typeof ResizeObserver === "function") {
    new ResizeObserver(reportHeight).observe(document.documentElement);
  }
  window.addEventListener("load", reportHeight);
  reportHeight();
})();
