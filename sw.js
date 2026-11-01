/* Service worker: guarda la app, las fuentes, los sprites y las respuestas
   de PokeAPI para que la Pokédex siga funcionando sin conexión. */
const VERSION = 'pkdx-v1';
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;
const IMAGES = `${VERSION}-img`;
const MAX_IMAGES = 600;

const SHELL_FILES = [
  './',
  './index.html',
  './css/styles.css',
  './js/data.js',
  './js/api.js',
  './js/app.js',
  './manifest.webmanifest',
  './icons/icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

// Primero la red; si falla, la copia guardada.
async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: false });
    if (hit) return hit;
    throw err;
  }
}

// Primero la copia guardada; si no existe, la red.
async function cacheFirst(req, cacheName, max) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') {
    cache.put(req, res.clone());
    if (max) trim(cacheName, max);
  }
  return res;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (req.mode === 'navigate') {
      event.respondWith(networkFirst(req, SHELL).catch(() => caches.match('./index.html')));
    } else {
      event.respondWith(networkFirst(req, SHELL));
    }
    return;
  }

  if (url.hostname === 'pokeapi.co') {
    event.respondWith(networkFirst(req, RUNTIME));
    return;
  }

  if (url.hostname === 'raw.githubusercontent.com') {
    event.respondWith(cacheFirst(req, IMAGES, MAX_IMAGES));
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(req, RUNTIME));
  }
});
