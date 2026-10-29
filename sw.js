// Castle Defense service worker — offline-first shell cache.
// Bump the version string whenever the shell (index.html, css/, js/) ships meaningful changes.
// Every file listed in ASSETS is precached; add new js/css files here when you create them.
//
// Scope: this worker registers at the site root (see js/main.js), so by default it would
// intercept EVERY same-origin request — including unrelated pages like keydash.html that
// were never meant to be part of this app's offline shell. The fetch handler below only
// takes over requests whose URL matches an entry in ASSETS; everything else (keydash.html,
// future standalone pages, etc.) falls through to the network/browser cache untouched.
const CACHE = 'castle-defense-v6';
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

// Absolute URLs for every precached asset, resolved against this worker's own scope —
// the only requests this worker is allowed to intercept. Built once at worker startup.
const ASSET_URLS = new Set(ASSETS.map(a => new URL(a, self.registration.scope).href));

// Stale-while-revalidate: serve from cache instantly (offline play), refresh the
// cache from the network in the background so the next launch gets updates.
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (!ASSET_URLS.has(req.url)) return; // not part of this app's shell — let it pass through
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
