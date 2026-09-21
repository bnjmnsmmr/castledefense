// Castle Defense service worker — offline-first shell cache.
// Bump the version string whenever the shell (index.html, css/, js/) ships meaningful changes.
// Every file listed in ASSETS is precached; add new js/css files here when you create them.
const CACHE = 'castle-defense-v5';
const ASSETS = [
  '.',
  'index.html',
  'css/base.css',
  'css/screens.css',
  'css/responsive.css',
  'js/config.js',
  'js/core.js',
  'js/feat-maps.js',
  'js/audio.js',
  'js/render-world.js',
  'js/render-enemies.js',
  'js/render-fx.js',
  'js/waves.js',
  'js/feat-storms.js',
  'js/game.js',
  'js/feat-powers.js',
  'js/feat-affixes.js',
  'js/feat-combos.js',
  'js/feat-relics.js',
  'js/feat-targeting.js',
  'js/feat-branches.js',
  'js/feat-intel.js',
  'js/feat-modifiers.js',
  'js/screens.js',
  'js/admin.js',
  'js/ui.js',
  'js/input.js',
  'js/main.js',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Stale-while-revalidate: serve from cache instantly (offline play), refresh the
// cache from the network in the background so the next launch gets updates.
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req).then(cached => {
      const refresh = fetch(req)
        .then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(cache => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || refresh;
    })
  );
});
