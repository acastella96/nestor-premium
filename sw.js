// Néstor Premium · service worker
// Guarda l'app a la memòria cau perquè funcioni sense connexió. Google Maps sí que necessita dades.
// Si canvies algun fitxer, puja el número de VERSION perquè els mòbils agafin la versió nova.
const VERSION = "np-v14";
const SHELL = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "config.js",
  "data.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
  "fotos/ulls-1.jpg", "fotos/ulls-2.jpg", "fotos/ulls-3.jpg", "fotos/ulls-4.jpg", "fotos/ulls-5.jpg",
  "fotos/nas-1.jpg", "fotos/nas-2.jpg", "fotos/nas-3.jpg", "fotos/nas-4.jpg", "fotos/nas-5.jpg",
  "fotos/llavis-1.jpg", "fotos/llavis-2.jpg", "fotos/llavis-3.jpg", "fotos/llavis-4.jpg", "fotos/llavis-5.jpg",
  "fotos/melic-1.jpg", "fotos/melic-2.jpg", "fotos/melic-3.jpg", "fotos/melic-4.jpg", "fotos/melic-5.jpg",
  "fotos/mans-1.jpg", "fotos/mans-2.jpg", "fotos/mans-3.jpg", "fotos/mans-4.jpg", "fotos/mans-5.jpg",
  "fotos/orelles-1.jpg", "fotos/orelles-2.jpg", "fotos/orelles-3.jpg", "fotos/orelles-4.jpg", "fotos/orelles-5.jpg",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/dist/umd/supabase.js",
];
// Fonts, Leaflet i les rajoles del mapa que ja s'han vist també es guarden
// (les crides a Supabase no es guarden mai: sempre van a la xarxa)
const EXTERNAL = ["fonts.googleapis.com", "fonts.gstatic.com", "unpkg.com", "cdn.jsdelivr.net"];
const isExternal = (host) => EXTERNAL.includes(host) || host === "tile.openstreetmap.org";

self.addEventListener("install", (e) => {
  // cache: "reload" perquè no s'aprofiti cap còpia vella de la memòria HTTP del navegador
  const fresh = SHELL.map((u) => new Request(u, { cache: "reload" }));
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(fresh)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Primer la memòria cau (ràpid i sense connexió) i, en segon pla, s'actualitza des de la xarxa
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin && !isExternal(url.hostname)) return;

  e.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const hit = await cache.match(req, { ignoreSearch: url.origin === self.location.origin });
      const net = fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);
      if (hit) {
        e.waitUntil(net);
        return hit;
      }
      const res = await net;
      if (res) return res;
      if (req.mode === "navigate") return cache.match("index.html");
      return Response.error();
    })
  );
});
