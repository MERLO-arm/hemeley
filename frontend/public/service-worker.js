// HEMELEY service worker — KILL SWITCH.
// The previous SW was caching stale dev-mode bundles and intercepting fetches,
// causing infinite reload loops when the dev server pushed hot updates.
// This file replaces it with a self-uninstalling worker so every existing
// browser registration is cleaned up automatically on next visit.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Drop every cache the previous SW had populated
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((c) => caches.delete(c)));

      // Unregister this SW so it stops intercepting requests
      try {
        await self.registration.unregister();
      } catch (_) {
        /* ignore */
      }

      // Force every controlled tab to reload once with the SW gone
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        try {
          client.navigate(client.url);
        } catch (_) {
          /* ignore */
        }
      }
    })()
  );
});

// Pass-through: never intercept any request from now on
self.addEventListener('fetch', () => {});
