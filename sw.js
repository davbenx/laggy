/* Notturnisti — service worker.
   Lo strumento è già local-first: qui aggiungiamo solo l'offline e l'icona in home.
   Cambia CACHE a ogni deploy dell'index (es. nt-v2) per forzare l'aggiornamento. */
const CACHE = "nt-v1";
const CORE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Il feed calendario NON va messo in cache dal SW: deve ruotare col tempo.
  if (url.pathname === "/feed" || url.pathname.endsWith("/feed")) return;

  // Navigazione: rete, poi cade sulla copia in cache (offline).
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put("./index.html", copy));
        return res;
      }).catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Font di Google e altri statici: cache-first, aggiorna in background.
  e.respondWith(
    caches.match(req).then(cached => {
      const net = fetch(req).then(res => {
        if (res && res.status === 200 && (url.origin === location.origin || url.host.includes("gstatic") || url.host.includes("googleapis"))) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || net;
    })
  );
});
