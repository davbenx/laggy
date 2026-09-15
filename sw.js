/* Notturnisti — service worker.
   Lo strumento è già local-first: qui aggiungiamo solo l'offline e l'icona in home.
   ⚠ CAMBIA CACHE a ogni deploy significativo (bumpa la data) per forzare
   l'aggiornamento agli utenti che hanno già installato la PWA. */
const CACHE = "nt-v20260915";
const CORE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-180.png",
  "./engine.js",
  "./alertness.js",
  "./history.js",
  "./paid.js",
  "./notifications.js"
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

/* ─── Notifiche locali pianificate ──────────────────────────────────────────
   L'app chiama sw.postMessage({ type:"NT_SCHEDULE", items:[...] }) con la
   lista di notifiche prodotta da notifications.js (buildSchedule).
   Il SW le arma con setTimeout e le lancia via showNotification.
   ─────────────────────────────────────────────────────────────────────────── */

// Timer attivi in memoria: { id → timeoutId }. Si perdono al restart del SW
// ma l'app li ricarica ad ogni avvio (e alla visibility change).
const _timers = new Map();

function _cancelAll() {
  for (const tid of _timers.values()) clearTimeout(tid);
  _timers.clear();
}

function _schedule(items) {
  _cancelAll();
  const now = Date.now();
  for (const n of items) {
    const when = new Date(n.at).getTime();
    const delay = when - now;
    if (delay < 0 || delay > 7 * 24 * 3600e3) continue;  // solo i prossimi 7 giorni

    const tid = setTimeout(() => {
      _timers.delete(n.id);
      const opts = {
        body: n.body,
        icon: "./icon-192.png",
        badge: "./owl-mark.png",
        tag: "nt-" + n.kind,       // raggruppa per tipo (bedtime, wake, nap…)
        renotify: true,
        silent: n.kind === "bedtime",  // la sveglia fa rumore, il promemoria no
        requireInteraction: n.kind === "wake",  // la sveglia resta finché non la tocchi
        data: { kind: n.kind, tab: n.kind === "wake" ? "diario" : "oggi" }
      };
      // Azioni rapide sul check-in sonno (solo sveglia)
      if (n.kind === "wake") {
        opts.actions = [
          { action: "ok",     title: "✅ Dormito bene" },
          { action: "annota", title: "✏️ Annotare" }
        ];
      }
      self.registration.showNotification(n.title, opts).catch(() => {});
    }, Math.max(delay, 500));

    _timers.set(n.id, tid);
  }
}

// Messaggio dall'app: { type:"NT_SCHEDULE", items:[{id,kind,title,body,at}] }
self.addEventListener("message", e => {
  if (!e.data) return;
  if (e.data.type === "NT_SCHEDULE") {
    _schedule(e.data.items || []);
    e.source && e.source.postMessage({ type: "NT_SCHEDULE_ACK", count: _timers.size });
  }
  if (e.data.type === "NT_CANCEL") {
    _cancelAll();
  }
});

// Tap sulla notifica → apre/focalizza l'app sul tab giusto
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const data = e.notification.data || {};
  const action = e.action;

  // "Dormito bene" → apre diario con focus già sul voto positivo
  const tab = action === "ok" ? "diario?voto=4" :
              action === "annota" ? "diario" :
              (data.tab || "oggi");

  const url = self.registration.scope + "?t=" + tab;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clients => {
      // Se l'app è già aperta, la porta in primo piano e naviga
      for (const client of clients) {
        if (client.url.startsWith(self.registration.scope)) {
          client.focus();
          client.postMessage({ type: "NT_NAV", tab });
          return;
        }
      }
      // Altrimenti apre una nuova finestra
      return self.clients.openWindow(url);
    })
  );
});

