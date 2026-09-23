/* analytics.js — telemetria di prodotto minima, con la privacy come vincolo
   di design, non come ripensamento.

   Regola non negoziabile: gli eventi possono dire CHE COSA è successo, mai
   CHI l'ha fatto o CON CHE DATI. "Un piano è stato generato" sì; "Davide ha
   dormito 5h42 dopo il turno 21:00–07:00" mai. Per questo ogni evento ha un
   elenco esplicito di proprietà ammesse (vedi ALLOWED sotto) — chiamare
   track() con una proprietà non elencata la scarta e avvisa in console,
   invece di lasciarla passare in silenzio.

   Dove finiscono: /collect sul nostro stesso Worker (functions/collect.js),
   che NON salva eventi singoli ma solo contatori aggregati per giorno
   ("plan_generated, pattern_type=notte, 2026-09-23: 14"). Niente IP, niente
   id, niente cookie, niente servizi terzi. Si leggono su /stats.
   Il server ricontrolla lo stesso elenco ALLOWED qui sotto
   (functions/_analytics.js — un test verifica che restino identici).

   Uso:
     NTAnalytics.track("plan_generated", { pattern_type: "notte" });
     NTAnalytics.setEnabled(false);           // opt-out esplicito, persiste
     NTAnalytics.isEnabled();
     NTAnalytics.configure({ endpoint: "https://…/collect" });
*/
(function () {
  "use strict";

  // Evento → proprietà ammesse. Un array vuoto = solo il nome dell'evento,
  // nessuna proprietà. Nessun evento qui sotto può MAI portare identificatori,
  // orari di turno reali, dati di sonno, nome, email o posizione.
  var ALLOWED = {
    landing_view: [],
    example_started: [],
    example_completed: [],

    onboarding_started: [],
    onboarding_step_completed: ["step"],   // nome/indice dello step, non i valori inseriti
    onboarding_abandoned: ["step"],
    onboarding_completed: [],

    plan_generated: ["pattern_type"],      // categoria del pattern (es. "notte","rotazione"), mai orari reali
    today_viewed: [],
    calendar_viewed: [],

    share_started: [],
    share_created: [],
    share_opened: [],
    share_accepted: [],

    install_prompt_shown: [],
    pwa_installed: [],

    notification_prompt_shown: [],
    notifications_enabled: [],

    return_d1: [],
    return_d7: [],
    return_d30: [],

    share_whatsapp: [],

    // Una volta al giorno per dispositivo, senza id: "quanti dispositivi hanno
    // aperto l'app oggi". platform ∈ web | pwa | android | ios.
    active_day: ["platform"]
  };

  var LS_OPTOUT = "nt:analytics-optout";
  var LS_QUEUE = "nt:analytics-queue";
  var LS_FIRSTSEEN = "nt:analytics-firstseen";
  var LS_RETURNFIRED = "nt:analytics-return-fired"; // {d1:true,d7:true,d30:true}
  var LS_ACTIVEDAY = "nt:analytics-active-day";     // ultima data in cui active_day è partito
  var QUEUE_MAX = 50;

  // Stessa origine sul web; dall'app nativa (origine capacitor://, https://localhost)
  // l'indirizzo assoluto del sito. Nessun endpoint su file:// (sviluppo locale).
  function defaultEndpoint() {
    try {
      var nativo = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
      if (nativo) return "https://app.notturnisti.club/collect";
      if (/^https?:$/.test(location.protocol)) return "/collect";
    } catch (e) {}
    return null;
  }
  var cfg = { endpoint: defaultEndpoint() };

  function readJSON(key, fallback) {
    try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; }
  }
  function writeJSON(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }

  function isEnabled() {
    // Rispetta sia l'opt-out esplicito in-app sia il Do Not Track del browser.
    try { if (navigator.doNotTrack === "1" || window.doNotTrack === "1") return false; } catch (e) {}
    return readJSON(LS_OPTOUT, false) !== true;
  }
  function setEnabled(on) { writeJSON(LS_OPTOUT, !on); if (!on) writeJSON(LS_QUEUE, []); }

  function sanitize(event, props) {
    var allowed = ALLOWED[event];
    if (!allowed) {
      try { console.warn("[analytics] evento sconosciuto, scartato:", event); } catch (e) {}
      return null;
    }
    var out = {};
    if (props) {
      for (var k in props) {
        if (allowed.indexOf(k) === -1) {
          try { console.warn("[analytics] proprietà non ammessa su " + event + ", scartata:", k); } catch (e) {}
          continue;
        }
        out[k] = props[k];
      }
    }
    return out;
  }

  function send(payload) {
    if (!cfg.endpoint) return false; // no-op finché non è configurato un endpoint reale
    try {
      var body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        // text/plain e non application/json: così è una richiesta "semplice"
        // anche cross-origin (dall'app nativa), senza preflight CORS che
        // sendBeacon non sa fare. Il server la legge comunque come JSON.
        var blob = new Blob([body], { type: "text/plain" });
        return navigator.sendBeacon(cfg.endpoint, blob);
      }
      fetch(cfg.endpoint, { method: "POST", headers: { "content-type": "text/plain" }, body: body, keepalive: true }).catch(function () {});
      return true;
    } catch (e) { return false; }
  }

  function flushQueue() {
    if (!cfg.endpoint) return;
    var q = readJSON(LS_QUEUE, []);
    if (!q.length) return;
    var rest = q.filter(function (item) { return !send(item); });
    writeJSON(LS_QUEUE, rest);
  }

  function track(event, props) {
    try {
      if (!isEnabled()) return;
      var clean = sanitize(event, props);
      if (clean === null) return;
      var payload = { event: event, props: clean, t: Date.now() };
      if (!send(payload)) {
        var q = readJSON(LS_QUEUE, []);
        q.push(payload);
        if (q.length > QUEUE_MAX) q = q.slice(q.length - QUEUE_MAX);
        writeJSON(LS_QUEUE, q);
      }
    } catch (e) { /* la telemetria non deve mai rompere l'app */ }
  }

  // ── return_d1 / d7 / d30: nessun timestamp di visita salvato per utente,
  // solo "oggi sono passati N giorni dalla prima apertura" — un booleano per
  // soglia, una volta sola ciascuno. ──
  function checkReturns() {
    try {
      var first = readJSON(LS_FIRSTSEEN, null);
      var today = new Date().toISOString().slice(0, 10);
      if (!first) { writeJSON(LS_FIRSTSEEN, today); return; }
      var days = Math.round((new Date(today) - new Date(first)) / 86400000);
      var fired = readJSON(LS_RETURNFIRED, {});
      [[1, "return_d1"], [7, "return_d7"], [30, "return_d30"]].forEach(function (pair) {
        var threshold = pair[0], event = pair[1];
        if (days >= threshold && !fired[event]) { track(event); fired[event] = true; }
      });
      writeJSON(LS_RETURNFIRED, fired);
    } catch (e) {}
  }

  function platform() {
    try {
      if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())
        return window.Capacitor.getPlatform() === "ios" ? "ios" : "android";
      if (window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true) return "pwa";
    } catch (e) {}
    return "web";
  }
  // Un booleano per giorno, come checkReturns: nessuna cronologia delle visite.
  function checkActiveDay() {
    try {
      var today = new Date().toISOString().slice(0, 10);
      if (readJSON(LS_ACTIVEDAY, null) === today) return;
      writeJSON(LS_ACTIVEDAY, today);
      track("active_day", { platform: platform() });
    } catch (e) {}
  }

  function configure(opts) {
    cfg = Object.assign({}, cfg, opts || {});
    if (cfg.endpoint) flushQueue();
  }

  window.NTAnalytics = { track: track, setEnabled: setEnabled, isEnabled: isEnabled, configure: configure, ALLOWED: ALLOWED };

  function start() { checkReturns(); checkActiveDay(); flushQueue(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
