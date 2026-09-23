/* Notturnisti — service worker.
   Lo strumento è già local-first: qui aggiungiamo solo l'offline e l'icona in home. */
const CACHE_PREFIX = "nt-";
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
  "./notifications.js",
  "./platform.js",
  "./analytics.js"
];

// Il nome della cache è l'hash del contenuto dei file CORE, non una versione
// bumpata a mano: cambia da solo appena un deploy modifica anche un solo
// byte di uno di questi file. Il memo scade dopo CACHE_TTL_MS: senza
// scadenza, un service worker rimasto vivo a lungo (scheda tenuta aperta)
// non lo ricalcolava mai più, e continuava a servire per sempre il
// contenuto visto la prima volta — anche con più deploy nel frattempo,
// perché sw.js stesso di solito non cambia byte da un deploy all'altro
// (cambiano solo i file CORE che elenca), quindi il browser non si
// accorgeva di nulla e il ciclo install/activate non ripartiva mai.
const CACHE_TTL_MS = 20 * 60 * 1000;
let _cacheNamePromise = null;
let _cacheNameAt = 0;
function cacheName() {
  if (_cacheNamePromise && (Date.now() - _cacheNameAt) < CACHE_TTL_MS) return _cacheNamePromise;
  _cacheNameAt = Date.now();
  _cacheNamePromise = (async () => {
    const responses = await Promise.all(CORE.map(url => fetch(url, { cache: "no-store" })));
    for (const res of responses) if (!res || !res.ok) throw new Error("core fetch fallito: " + (res && res.url));
    const chunks = [];
    for (const res of responses) chunks.push(await res.clone().text());
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(chunks.join(" ")));
    const hex = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
    const name = CACHE_PREFIX + hex;
    const cache = await caches.open(name);
    await Promise.all(CORE.map((url, i) => cache.put(url, responses[i])));
    // Pulizia subito, non solo su install/activate (che spesso non
    // riscatta più: vedi sopra) — appena l'hash cambia davvero, qui.
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k.startsWith(CACHE_PREFIX) && k !== name).map(k => caches.delete(k)))
    ).catch(() => {});
    return name;
  })();
  return _cacheNamePromise;
}

self.addEventListener("install", e => {
  e.waitUntil(cacheName().then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    cacheName()
      .then(name => caches.keys().then(keys =>
        Promise.all(keys.filter(k => k.startsWith(CACHE_PREFIX) && k !== name).map(k => caches.delete(k)))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (/^\/(feed|config|couple)(\/|$)/.test(url.pathname)) return;

  // Navigazione: rete, poi cade sulla cache CORRENTE (mai caches.match()
  // senza nome: cerca fra tutte le cache rimaste, ordine non garantito —
  // può ripescare una versione vecchia anche quando ne esiste una nuova).
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        cacheName().then(name => caches.open(name)).then(c => c.put("./index.html", copy));
        return res;
      }).catch(() => cacheName().then(name => caches.open(name)).then(c => c.match("./index.html")))
    );
    return;
  }

  // Font di Google e altri statici: cache-first (nella cache corrente),
  // aggiorna in background.
  e.respondWith(
    cacheName().then(name => caches.open(name)).then(cache =>
      cache.match(req).then(cached => {
        const net = fetch(req).then(res => {
          if (res && res.status === 200 && (url.origin === location.origin || url.host.includes("gstatic") || url.host.includes("googleapis"))) {
            cache.put(req, res.clone());
          }
          return res;
        }).catch(() => cached);
        return cached || net;
      })
    )
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

// Copia dell'ultimo piano ricevuto, persistita in IndexedDB (il SW non ha
// localStorage): serve solo a Periodic Background Sync qui sotto, per
// riarmare i promemoria anche se l'app non è aperta da giorni. Nessun
// calcolo nuovo, nessun server: rilegge solo quello che la pagina aveva già
// mandato l'ultima volta che era aperta.
const _DB_NAME = "nt-sw", _STORE = "kv";
function _dbOpen(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(_DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function _kvSet(key, value){
  const db = await _dbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(_STORE, "readwrite");
    tx.objectStore(_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function _kvGet(key){
  const db = await _dbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(_STORE, "readonly");
    const req = tx.objectStore(_STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

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
          { action: "ok",     title: "Dormito bene" },
          { action: "annota", title: "Annota diario" }
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
    _kvSet("lastItems", e.data.items || []).catch(() => {});
    e.source && e.source.postMessage({ type: "NT_SCHEDULE_ACK", count: _timers.size });
  }
  if (e.data.type === "NT_CANCEL") {
    _cancelAll();
  }
});

// Periodic Background Sync: solo dove il browser lo concede (oggi solo
// Chrome/Android, in base a quanto l'utente usa l'app — nessuna garanzia sui
// tempi reali, li decide il browser). Non calcola niente di nuovo: riarma
// con _schedule() lo stesso identico piano che la pagina aveva già mandato
// l'ultima volta, letto da IndexedDB — l'unico modo per il SW di ritrovarlo
// senza che l'app sia mai stata aperta di recente.
self.addEventListener("periodicsync", e => {
  if (e.tag === "nt-notif-refresh") {
    e.waitUntil(_kvGet("lastItems").then(items => { if (items && items.length) _schedule(items); }).catch(() => {}));
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
