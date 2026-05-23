/**
 * One-time helper for browsers that still request /sw.js from an old deploy.
 * Open /unregister-sw.js once, then hard-refresh the app.
 */
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    Promise.all(regs.map((r) => r.unregister())).then(() => {
      console.info("[Lunar] service workers unregistered:", regs.length);
    });
  });
}
