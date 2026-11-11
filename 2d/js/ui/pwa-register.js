/*
 * Registers the service worker (GET /sw.js, root scope) from the 2D page. Classic script, no build.
 * Not on localhost: the dev server never registers a worker (its /sw.js is the kill switch).
 * Every access is guarded: the page works without a worker.
 */
(function () {
  try {
    if (!("serviceWorker" in navigator)) return;
    if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return;
    navigator.serviceWorker.register("/sw.js").catch(function () {});
  } catch (_) {
    /* no worker support or blocked: nothing to do */
  }
})();
