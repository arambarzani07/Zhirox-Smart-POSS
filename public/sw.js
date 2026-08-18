// Zhirox Smart POS service-worker retirement shim.
// Legacy regression markers retained intentionally: zhirox-pos-shell-v60
// Previous API bypass expression retained as documentation: url.pathname.startsWith("/api/")
//
// The previous V60 shell worker could serve stale HTML/JS pairs after the
// runtime moved to Next standalone. That leaves CSS active while React never
// hydrates, so launcher cards animate on touch but their handlers stay dead.
// Existing registrations will discover this script during the browser's normal
// service-worker update check, purge the legacy caches and unregister themselves.

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(Promise.resolve());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("zhirox-pos-shell-")).map((key) => caches.delete(key)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clients) {
      try {
        await client.navigate(client.url);
      } catch {
        // A client can disappear while the worker is retiring; ignore it.
      }
    }
  })());
});

// Never intercept fetches while this retirement worker is active.
self.addEventListener("fetch", () => {});
