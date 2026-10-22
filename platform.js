// platform.js — l'unico punto in cui il codice sa se gira nel browser o
// nell'app nativa (Capacitor). Il resto (index.html, engine.js,
// notifications.js) chiama sempre le stesse tre funzioni:
//
//   notify.schedule(items)       items = buildSchedule(...) di notifications.js
//   calendar.sync(events, couple) events = engine.buildEvents(...)
//   widget.publish(snapshot)
//
// Web: comportamento identico a prima di questo file (notifiche via service
// worker; calendario e widget non disponibili, restano ICS/feed).
// Nativo: sistema operativo (AlarmManager / UNUserNotificationCenter),
// nessun server. Vedi docs/app-nativa.md.
//
// Nessun import di pacchetti: nell'app i plugin arrivano dal ponte nativo di
// Capacitor su window.Capacitor.Plugins, quindi questo file resta servibile
// così com'è, senza build step, sia dal sito sia dal bundle dell'app.

import { pdfDaFoglio } from "./pdf.js";   // solo per il PDF su iPhone (print)

const Cap = typeof window !== "undefined" ? window.Capacitor : undefined;

export const isNative = !!(Cap && typeof Cap.isNativePlatform === "function" && Cap.isNativePlatform());
export const name = isNative ? Cap.getPlatform() : "web";   // "web" | "android" | "ios"

const plugin = n => (isNative && Cap.Plugins && Cap.Plugins[n]) || null;

// Quanti giorni di notifiche armare in anticipo. Android tiene fino a ~500
// allarmi per app; iOS al massimo 64 notifiche in coda, da cui la finestra corta.
const NOTIFY_DAYS = { web: 7, android: 21, ios: 8 };
const IOS_MAX = 63; // 64 meno quella di "apri l'app per continuare"

/* ── Notifiche ─────────────────────────────────────────────────────────── */

const webNotify = {
  days: NOTIFY_DAYS.web,
  async exactStatus() { return "granted"; },
  async requestExact() { return "granted"; },
  async permission() {
    if (!(window.Notification && Notification.permission)) return "unsupported";
    return Notification.permission;             // "granted" | "denied" | "default"
  },
  async request() {
    if (!(window.Notification && Notification.permission)) return "unsupported";
    return Notification.requestPermission();
  },
  // Service worker: armato con timer. Limite noto (docs/app-nativa.md §1): i
  // timer muoiono quando il browser chiude il SW, quindi è best-effort.
  async schedule(items) {
    if (!navigator.serviceWorker) return false;
    if (!(window.Notification && Notification.permission) || Notification.permission !== "granted") return false;
    const sw = navigator.serviceWorker.controller;
    if (!sw) return false;
    sw.postMessage({ type: "NT_SCHEDULE", items });
    periodicSync();
    syncPush(items);
    return true;
  },
  // "attive": il server sveglia l'app all'ora dei promemoria (arrivano anche
  // ad app chiusa); "no": il browser non lo permette (iPhone fuori dalla Home).
  pushStato() {
    if (!pushPossibile()) return "no";
    try { return localStorage.getItem("nt-push-ult") ? "attive" : "in-attesa"; } catch (e) { return "in-attesa"; }
  },
  // Una notifica subito, per vedere che arrivano (non tocca la coda del piano).
  async prova() {
    if (!(window.Notification && Notification.permission) || Notification.permission !== "granted" || !navigator.serviceWorker) return false;
    const reg = await navigator.serviceWorker.ready;
    setTimeout(() => reg.showNotification("Notturnisti", { body: PROVA, tag: "nt-prova", icon: "./icon-192.png" }), 3000);
    return true;
  }
};
webNotify.canaliSpenti = async () => [];

// Web Push (vedi functions/_push.js): al server vanno SOLO gli orari dei
// promemoria, mai cosa dicono; all'ora giusta manda una push vuota e il
// service worker mostra la notifica dal piano salvato sul telefono. Si
// rimanda solo quando gli orari cambiano. Lista vuota (promemoria spenti):
// iscrizione cancellata, sul server e nel browser.
function pushPossibile() {
  return typeof navigator !== "undefined" && !!navigator.serviceWorker && typeof window !== "undefined" && !!window.PushManager;
}
const u8 = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), c => c.charCodeAt(0));
async function syncPush(items) {
  try {
    if (!pushPossibile()) return "no";
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    const now = Date.now();
    const orari = [...new Set((items || []).map(n => Math.floor(new Date(n.at).getTime() / 60e3) * 60e3))]
      .filter(t => t > now).sort((a, b) => a - b).slice(0, 120);
    if (!orari.length || Notification.permission !== "granted") {
      if (sub) {
        await fetch("/push/sync", { method: "POST", body: JSON.stringify({ endpoint: sub.endpoint, stop: true }) }).catch(() => {});
        await sub.unsubscribe().catch(() => {});
      }
      localStorage.removeItem("nt-push-ult");
      return "off";
    }
    if (!sub) {
      // Iscrizione rifiutata (finestra in incognito, servizio push assente):
      // non ci si riprova a ogni riprogrammazione, solo alla prossima apertura.
      if (sessionStorage.getItem("nt-push-no")) return "no";
      const rk = await fetch("/push/key");
      if (!rk.ok) return "err";
      const { key } = await rk.json();
      try { sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: u8(key) }); }
      catch (e) { sessionStorage.setItem("nt-push-no", "1"); return "no"; }
    }
    const firma = sub.endpoint + "|" + orari.join(",");
    if (firma === localStorage.getItem("nt-push-ult")) return "ok";
    const r = await fetch("/push/sync", { method: "POST", body: JSON.stringify({ endpoint: sub.endpoint, orari }) });
    if (r.ok) localStorage.setItem("nt-push-ult", firma);
    return r.ok ? "ok" : "err";
  } catch (e) { return "err"; }
}
const PROVA = "Le notifiche funzionano: così arriveranno i promemoria del piano.";

// Periodic Background Sync: dove il browser la concede (oggi solo
// Chrome/Android, e solo in base a quanto l'utente usa l'app), risveglia il SW
// per riarmare i promemoria anche ad app chiusa. Sugli altri browser non fa
// nulla, in silenzio: è un miglioramento quando c'è, mai la strada principale.
async function periodicSync() {
  try {
    if (!("permissions" in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    if (!("periodicSync" in reg)) return;
    const stato = await navigator.permissions.query({ name: "periodic-background-sync" });
    if (stato.state !== "granted") return;
    await reg.periodicSync.register("nt-notif-refresh", { minInterval: 12 * 3600e3 });
  } catch (e) {}
}

const nativeNotify = {
  days: NOTIFY_DAYS[name] || 8,
  async permission() {
    const LN = plugin("LocalNotifications"); if (!LN) return "unsupported";
    const p = await LN.checkPermissions();
    return p.display === "granted" ? "granted" : p.display === "denied" ? "denied" : "default";
  },
  async request() {
    const LN = plugin("LocalNotifications"); if (!LN) return "unsupported";
    const p = await LN.requestPermissions();
    if (p.display === "granted") await ensureChannels(LN);
    return p.display === "granted" ? "granted" : "denied";
  },
  // Allarmi esatti (Android 12+): permesso "Sveglie e promemoria", che su
  // Android 14+ è spento di default. Si chiede SOLO da un tocco esplicito
  // (requestExact), mai da schedule(): il plugin, se una notifica vuole
  // l'esattezza e il permesso manca, apre la schermata di sistema a ogni
  // chiamata — cioè a ogni ritorno nell'app.
  async exactStatus() {
    const LN = plugin("LocalNotifications"); if (!LN || name !== "android") return "granted";
    try { return (await LN.checkExactNotificationSetting()).exact_alarm; } catch (e) { return "granted"; }
  },
  async requestExact() {
    const LN = plugin("LocalNotifications"); if (!LN || name !== "android") return "granted";
    try { return (await LN.changeExactNotificationSetting()).exact_alarm; } catch (e) { return "denied"; }
  },
  // Sostituisce in blocco tutto ciò che era in coda: il piano è la fonte di
  // verità, la coda del sistema operativo è solo una sua copia.
  async schedule(items) {
    const LN = plugin("LocalNotifications"); if (!LN) return false;
    if ((await this.permission()) !== "granted") return false;
    await ensureChannels(LN);
    const pending = await LN.getPending();
    if (pending.notifications.length) await LN.cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) });

    // Solo la sveglia merita l'esattezza, e solo se il permesso c'è già;
    // tutto il resto va bene con qualche minuto di scarto (Doze).
    const exactOk = (await this.exactStatus()) === "granted";
    await ensureAzioni(LN);
    let list = items.map(n => ({
      id: n.id, title: n.title, body: n.body,
      schedule: { at: new Date(n.at), allowWhileIdle: true },
      isExactNotification: n.kind === "wake" && exactOk,
      channelId: CANALE_DI[n.kind] || "promemoria",
      ...(AZIONI_DI[n.kind] ? { actionTypeId: AZIONI_DI[n.kind] } : {}),
      extra: { kind: n.kind, tab: (n.extra && n.extra.tab) || (n.kind === "wake" ? "diario" : "oggi") }
    }));
    if (name === "ios" && list.length) {
      list = list.slice(0, IOS_MAX);
      // Senza aperture per giorni la coda si esaurisce: l'ultima notifica lo
      // dice, invece di lasciare che i promemoria smettano in silenzio.
      const last = list[list.length - 1].schedule.at;
      list.push({ id: 999999, title: "Notturnisti", body: "Apri l'app per continuare a ricevere i promemoria.",
        schedule: { at: new Date(last.getTime() + 60 * 60e3) }, isExactNotification: false, extra: { tab: "oggi" } });
    }
    if (list.length) await LN.schedule({ notifications: list });
    return true;
  },
  // Canali che l'utente ha spento dalle impostazioni del telefono.
  async canaliSpenti() {
    const LN = plugin("LocalNotifications"); if (!LN || name !== "android") return [];
    try { const r = await LN.listChannels(); return (r.channels || []).filter(c => c.importance === 0).map(c => c.id); }
    catch (e) { return []; }
  },
  async prova() {
    const LN = plugin("LocalNotifications"); if (!LN) return false;
    if ((await this.permission()) !== "granted") return false;
    await ensureChannels(LN);
    // Subito, senza "schedule": un allarme non esatto a 5 secondi, da
    // Android 14, il sistema può rinviarlo di minuti (visto su Android 15).
    // isExactNotification:false perché il plugin, se manca il permesso delle
    // sveglie esatte (Android 12+), aprirebbe la schermata di sistema
    // "Sveglie e promemoria" anche per una notifica immediata.
    await LN.schedule({ notifications: [{ id: 999990, title: "Notturnisti", body: PROVA,
      channelId: "promemoria", isExactNotification: false, extra: { tab: "oggi" } }] });
    return true;
  }
};

// Un canale per tipo: ognuno si spegne anche dalle impostazioni del telefono
// (Impostazioni › App › Notturnisti › Notifiche), senza toccare gli altri.
// Stessa tabella dei tipi di notifications.js (campo "canale").
const CANALI = [
  { id: "turni",        name: "Cambi di turno",            importance: 4 },
  { id: "sicurezza",    name: "Rientro e giorni impegnativi", importance: 4 },
  { id: "sonno",        name: "Sonno",                     importance: 3 },
  { id: "caffe",        name: "Ultimo caffè",              importance: 3 },
  { id: "pisolini",     name: "Pisolini",                  importance: 3 },
  { id: "luce",         name: "Luce",                      importance: 2 },
  { id: "sveglie",      name: "Ora di alzarti",            importance: 4 },
  { id: "suggerimenti", name: "Suggerimenti e riepiloghi", importance: 2 },
  // «Come hai dormito?» ha un canale suo, a importanza normale: su quello
  // silenzioso dei suggerimenti molti telefoni la mettevano fra le
  // "Silenziose", senza banner, e passava inosservata (sul web invece arriva).
  { id: "diario",       name: "Come hai dormito?",         importance: 3 },
  { id: "promemoria",   name: "Prova e altri avvisi",      importance: 3 }
];
const CANALE_DI = { cambio: "turni", domani: "turni", prep: "turni", ret: "sicurezza", rischio: "sicurezza", bedtime: "sonno", coffee: "caffe",
  nap: "pisolini", luce: "luce", wake: "sveglie", settimana: "suggerimenti", tip: "suggerimenti",
  diario: "diario", consigli: "suggerimenti" };
let _channels = false;
// Pulsanti nella notifica: solo dove un tocco basta a fare la cosa.
// «Come hai dormito?» → «Come previsto» registra gli orari del piano (con
// Annulla subito dopo), «Altri orari» apre il modulo. Il tocco sulla
// notifica fa come «Altri orari».
const AZIONI_DI = { diario: "diario" };
let _azioni = false;
async function ensureAzioni(LN) {
  if (_azioni) return;
  try { await LN.registerActionTypes({ types: [{ id: "diario", actions: [
    { id: "previsto", title: "Come previsto" }, { id: "altri", title: "Altri orari" } ] }] }); } catch (e) {}
  _azioni = true;
}
async function ensureChannels(LN) {
  if (_channels || name !== "android") return;
  for (const c of CANALI) await LN.createChannel({ ...c, visibility: 1, vibration: c.importance >= 4 });
  _channels = true;
}

export const notify = isNative ? nativeNotify : webNotify;

/* ── Calendario ────────────────────────────────────────────────────────── */
// Web: non disponibile (restano feed ICS e download .ics).
// Nativo: un calendario "Notturnisti" sul telefono (Android: account LOCALE,
// non sincronizzato con Google; resta sul dispositivo), riscritto da capo a
// ogni cambio. Niente server, niente ritardi di aggiornamento: è la ragione
// principale dell'app nativa (docs/app-nativa.md §4.2).
// Gli eventi NON hanno promemoria: l'app manda già le sue notifiche, i
// promemoria del calendario sarebbero doppi.
const CAL_KEY = "nt:calNativo";
const calState = () => { try { return JSON.parse(localStorage.getItem(CAL_KEY) || "null") || {}; } catch (e) { return {}; } };
const calSave = st => { try { localStorage.setItem(CAL_KEY, JSON.stringify(st)); } catch (e) {} };
let _calBusy = null;

async function calPermesso(chiedi) {
  const C = plugin("CapacitorCalendar");
  const ok = r => r && r.result && r.result.readCalendar === "granted" && r.result.writeCalendar === "granted";
  if (ok(await C.checkAllPermissions())) return true;
  return chiedi ? ok(await C.requestAllPermissions()) : false;
}
async function calCrea(titolo, colore) {
  const C = plugin("CapacitorCalendar");
  const r = await C.createCalendar({ title: titolo, color: colore, accountName: "Notturnisti", ownerAccount: "Notturnisti" });
  return r.id;
}
// Il calendario può essere stato cancellato a mano dall'utente: si controlla
// che esista ancora prima di scriverci.
async function calEsiste(id) {
  if (!id) return false;
  try { const r = await plugin("CapacitorCalendar").listCalendars(); return (r.result || []).some(c => String(c.id) === String(id)); }
  catch (e) { return false; }
}
// salva(ids) dopo ogni evento creato: se la scrittura si interrompe a metà
// (permesso revocato, app chiusa), gli eventi già creati restano registrati
// e la volta dopo vengono cancellati, invece di restare duplicati per sempre.
async function calScrivi(id, vecchi, eventi, salva) {
  const C = plugin("CapacitorCalendar");
  if (vecchi && vecchi.length) { try { await C.deleteEventsById({ ids: vecchi }); } catch (e) {} }
  const nuovi = [];
  salva(nuovi);
  for (const e of eventi) {
    // Occupato solo il turno; sonno, caffè, luce e riposi in comune non
    // devono far risultare "impegnato" a chi guarda la tua disponibilità.
    const opt = { calendarId: String(id), title: e.title, startDate: e.start.getTime(), endDate: e.end.getTime(),
      isAllDay: !!e.allDay, availability: e.tipo === "turno" ? 0 : 1 };
    if (e.desc) opt.description = e.desc;
    const r = await C.createEvent(opt);
    if (r && r.id) { nuovi.push(String(r.id)); salva(nuovi); }
  }
  return nuovi;
}

export const calendar = {
  available: isNative && !!plugin("CapacitorCalendar"),
  attivo() { return !!calState().on; },
  coppiaAttiva() { return !!calState().coppia; },
  ultimoSync() { return calState().at || null; },
  // Attiva (chiede il permesso). Restituisce "ok" | "negato".
  async attiva({ coppia } = {}) {
    if (!this.available) return "negato";
    if (!(await calPermesso(true))) return "negato";
    const st = calState(); st.on = true; if (coppia !== undefined) st.coppia = !!coppia; st.sig = null; calSave(st);
    return "ok";
  },
  async impostaCoppia(on) { const st = calState(); st.coppia = !!on; st.sig = null; calSave(st); },
  // Spegne e cancella i calendari creati dall'app (solo quelli).
  async disattiva() {
    const C = plugin("CapacitorCalendar"), st = calState();
    for (const id of [st.id, st.idCoppia]) if (id) { try { await C.deleteCalendar({ id: String(id) }); } catch (e) {} }
    calSave({});
  },
  // Riscrive gli eventi se sono cambiati. events/coupleEvents = buildEvents()/
  // buildCoupleEvents() del motore. Due chiamate ravvicinate non si accavallano.
  async sync(events, coupleEvents) {
    if (!this.available || !this.attivo()) return false;
    if (_calBusy) return _calBusy;
    _calBusy = (async () => {
      try {
        if (!(await calPermesso(false))) return false;
        const st = calState();
        const coppia = st.coppia ? (coupleEvents || []) : [];
        const sig = JSON.stringify([events.map(e => [e.uid, +e.start, +e.end, e.title]), coppia.map(e => [e.uid, e.desc])]);
        if (sig === st.sig && await calEsiste(st.id)) return true;
        if (!(await calEsiste(st.id))) { st.id = await calCrea("Notturnisti", "#3D7BE0"); st.ids = []; }
        st.ids = await calScrivi(st.id, st.ids, events, ids => { st.ids = ids.slice(); st.sig = null; calSave(st); });
        if (st.coppia) {
          if (!(await calEsiste(st.idCoppia))) { st.idCoppia = await calCrea("Notturnisti · insieme", "#E0913D"); st.idsCoppia = []; }
          st.idsCoppia = await calScrivi(st.idCoppia, st.idsCoppia, coppia, ids => { st.idsCoppia = ids.slice(); st.sig = null; calSave(st); });
        } else if (st.idCoppia) {
          try { await plugin("CapacitorCalendar").deleteCalendar({ id: String(st.idCoppia) }); } catch (e) {}
          st.idCoppia = null; st.idsCoppia = [];
        }
        st.sig = sig; st.at = Date.now(); calSave(st);
        return true;
      } finally { _calBusy = null; }
    })();
    return _calBusy;
  },
  async apri() { try { await plugin("CapacitorCalendar").openCalendar({ date: Date.now() }); } catch (e) {} },
  // Quanti eventi dell'app ci sono davvero nel calendario del telefono nei
  // prossimi 7 giorni: lo legge dal telefono, non dalla memoria dell'app.
  async verifica() {
    if (!this.available || !this.attivo()) return { on: false, n: 0 };
    try {
      if (!(await calPermesso(false))) return { on: true, permesso: false, n: 0 };
      const st = calState();
      if (!(await calEsiste(st.id))) return { on: true, permesso: true, esiste: false, n: 0 };
      const from = Date.now(), to = from + 7 * 864e5;
      const r = await plugin("CapacitorCalendar").listEventsInRange({ from, to });
      const n = (r.result || []).filter(e => String(e.calendarId) === String(st.id)).length;
      return { on: true, permesso: true, esiste: true, n };
    } catch (e) { return { on: true, errore: String(e && e.message || e), n: 0 }; }
  },
  // Importazione dei turni: gli eventi degli ALTRI calendari del telefono
  // (non quelli scritti dall'app) fra due date. Solo lettura, solo qui: gli
  // eventi non lasciano il telefono. Restituisce {permesso, calendari, eventi}.
  async leggi(from, to) {
    if (!this.available) return { permesso: false, calendari: [], eventi: [] };
    if (!(await calPermesso(true))) return { permesso: false, calendari: [], eventi: [] };
    const C = plugin("CapacitorCalendar"), st = calState(), nostri = [st.id, st.idCoppia].filter(Boolean).map(String);
    let cal = []; try { cal = ((await C.listCalendars()).result || []); } catch (e) {}
    const r = await C.listEventsInRange({ from, to });
    const eventi = (r.result || []).filter(e => !nostri.includes(String(e.calendarId))).map(e => {
      // tutto il giorno: le date arrivano a mezzanotte UTC, si leggono in UTC
      const g = x => { const d = new Date(x); return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); };
      return { titolo: e.title || "", calendario: String(e.calendarId), tuttoIlGiorno: !!e.isAllDay,
        inizio: e.isAllDay ? g(e.startDate) : new Date(e.startDate), fine: e.isAllDay ? g(e.endDate) : new Date(e.endDate) };
    });
    const calendari = cal.filter(c => !nostri.includes(String(c.id))).map(c => ({ id: String(c.id), titolo: c.title || "Calendario",
      n: eventi.filter(e => e.calendario === String(c.id)).length })).filter(c => c.n > 0).sort((a, b) => b.n - a.n);
    return { permesso: true, calendari, eventi };
  },
  // Riscrive tutto alla prossima sincronizzazione (dimentica la firma).
  riscrivi() { const st = calState(); st.sig = null; calSave(st); }
};

/* ── Widget ────────────────────────────────────────────────────────────── */
// Android: widget "Il tuo piano" (app/android/.../NotturnistiWidget.java).
// La pagina gli passa la timeline delle prossime ore già calcolata; il
// widget sceglie solo cosa vale adesso. Web: nessun widget possibile, no-op.
export const widget = {
  available: isNative && !!plugin("NTWidget"),
  // extra: {turno: il prossimo turno, diario: la domanda del mattino}
  async publish(voci, giorni, extra) {
    const W = plugin("NTWidget"); if (!W) return false;
    try { const r = await W.publish({ json: JSON.stringify(Object.assign({ v: 3, at: Date.now(), voci, giorni: giorni || [] }, extra || {})) }); widgetSalvaConteggio(r); return true; }
    catch (e) { return false; }
  },
  // Le risposte del diario date dal widget ({giorno: {sonno, bed, wake, voto, at}}):
  // si leggono una volta e il widget le dimentica.
  async risposte() {
    const W = plugin("NTWidget"); if (!W || !W.risposte) return {};
    try { const r = await W.risposte(); return JSON.parse(r && r.json || "{}") || {}; } catch (e) { return {}; }
  },
  // Quanti widget ci sono (l'ultimo valore noto è anche in localStorage,
  // così la lista di attivazione lo sa subito, senza attendere il nativo).
  presenti() { try { return +(localStorage.getItem("nt:widgetN") || 0); } catch (e) { return 0; } },
  async aggiorna() { const W = plugin("NTWidget"); if (!W) return 0; try { widgetSalvaConteggio(await W.count()); } catch (e) {} return this.presenti(); },
  // Un tocco: finestra di sistema "Aggiungi alla schermata Home" (Android 8+).
  async aggiungi() { const W = plugin("NTWidget"); if (!W) return false; try { return !!(await W.pin()).supported; } catch (e) { return false; } }
};
function widgetSalvaConteggio(r) { try { if (r && r.widgets != null) localStorage.setItem("nt:widgetN", String(r.widgets)); } catch (e) {} }

/* ── Eventi dell'app nativa ────────────────────────────────────────────── */
// Sul web non scattano mai: lì bastano visibilitychange e i messaggi del SW.
// Link interni dell'app (notturnisti://giorno/AAAA-MM-GG dal widget): cb(data).
// A freddo il link arriva da getLaunchUrl, ad app aperta dall'evento.
export function onApriGiorno(cb) {
  const App = plugin("App"); if (!App) return;
  const gestisci = u => { const m = /^notturnisti:\/\/giorno\/(\d{4}-\d{2}-\d{2})/.exec(String(u || "")); if (m) { try { cb(m[1]); } catch (e) {} } };
  App.addListener("appUrlOpen", ev => gestisci(ev && ev.url));
  App.getLaunchUrl().then(r => gestisci(r && r.url)).catch(() => {});
}
export function onResume(cb) {
  const App = plugin("App");
  if (App) App.addListener("resume", () => { try { cb(); } catch (e) {} });
}
export function onNotificationTap(cb) {
  const LN = plugin("LocalNotifications");
  if (LN) LN.addListener("localNotificationActionPerformed", ev => {
    const x = (ev && ev.notification && ev.notification.extra) || {};
    try { cb(x.tab || "oggi", x.kind || "", (ev && ev.actionId) || ""); } catch (e) {}
  });
}

/* ── Condivisione ──────────────────────────────────────────────────────── */
// Nel WebView di Android navigator.share non esiste: senza il plugin si
// finiva sempre sul "link copiato". Annullare dal pannello è un AbortError,
// come per navigator.share, così i chiamanti lo gestiscono una volta sola.
export function canShare() { return !!plugin("Share") || (typeof navigator !== "undefined" && !!navigator.share); }
export async function share({ title, text, url }) {
  const Sh = plugin("Share");
  if (Sh) {
    try { await Sh.share({ title, text, url, dialogTitle: title }); return true; }
    catch (e) {
      if (/cancel/i.test(String(e && (e.message || e)))) { const a = new Error("annullato"); a.name = "AbortError"; throw a; }
      throw e;
    }
  }
  await navigator.share({ title, text, url });
  return true;
}

/* ── Stampa ────────────────────────────────────────────────────────────── */
// Nel WebView window.print() non fa nulla: nell'app si passa dal servizio di
// stampa di Android (plugin locale NTPrint, anche "Salva come PDF").
// iPhone/iPad sul web: window.print() dall'app aggiunta alla schermata Home
// non apre niente, e in Safari il PDF è nascosto nell'anteprima di stampa.
// Lì si crea un PDF vero e si apre il pannello di condivisione (Salva su
// File, WhatsApp, Stampa). Tutto sincrono fino a share(): il tocco
// dell'utente deve valere ancora quando il pannello si apre.
function iosWeb() {
  try { return !isNative && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)); }
  catch (e) { return false; }
}
export async function print(title) {
  const P = plugin("NTPrint");
  if (P) { await P.print({ title: title || "Notturnisti" }); return true; }
  const foglio = document.getElementById("printSheet");
  if (iosWeb() && foglio) {
    const nome = (title || "Notturnisti").replace(/[^\w\- ]+/g, "").replace(/\s+/g, " ").trim() + ".pdf";
    const file = new File([pdfDaFoglio(foglio)], nome, { type: "application/pdf" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: title || "Notturnisti" }); }
      catch (e) { if (!e || e.name !== "AbortError") scarica(file); }
      return true;
    }
    scarica(file);
    return true;
  }
  window.print();
  return true;
}
function scarica(file) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(file); a.download = file.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}

// Versione dell'app ("1.0.0 (12)") nell'app nativa; sul web null.
export async function versione() {
  const App = plugin("App");
  if (!App || !App.getInfo) return null;
  try { const i = await App.getInfo(); return i.version + (i.build ? " (" + i.build + ")" : ""); } catch (e) { return null; }
}

/* ── Recensione su Google Play ──────────────────────────────────────────── */
// Il riquadro delle stelle di Play dentro l'app (plugin locale NTReview).
// Google decide se mostrarlo e non dice mai l'esito: niente da aspettarsi.
export const review = {
  available: isNative && name === "android" && !!plugin("NTReview"),
  request() { const R = plugin("NTReview"); return R ? R.request().catch(() => {}) : Promise.resolve(); },
  url: "https://play.google.com/store/apps/details?id=club.notturnisti.app"
};

/* ── Sveglia ──────────────────────────────────────────────────────────── */
// Una sveglia vera nell'app Orologio (plugin locale NTAlarm, solo Android).
// L'Orologio la mette alla prossima volta che arriva quell'ora: chi chiama
// deve proporla solo per un orario entro 24 ore.
export const alarm = {
  available: isNative && name === "android" && !!plugin("NTAlarm"),
  set(hour, minutes, message) {
    const A = plugin("NTAlarm");
    return A ? A.set({ hour, minutes, message }) : Promise.reject(new Error("non disponibile"));
  }
};

/* ── Barre di sistema ──────────────────────────────────────────────────── */
// Icone della barra di stato e della barra dei gesti leggibili sul tema
// dell'app: chiare su fondo scuro, scure su fondo chiaro. Senza, seguivano
// il tema del telefono anche quando l'app era forzata sul chiaro.
export function setSystemBars(chiaro) {
  const SB = plugin("SystemBars");
  if (SB) SB.setStyle({ style: chiaro ? "LIGHT" : "DARK" }).catch(() => {});
}

// Tasto "indietro" di Android. cb() restituisce true se ha chiuso qualcosa;
// altrimenti l'app va in secondo piano (come le app native sulla schermata
// principale), invece di chiudersi del tutto. Con un listener registrato il
// plugin App non esegue più il suo comportamento di default.
export function onBackButton(cb) {
  const App = plugin("App");
  if (App) App.addListener("backButton", () => {
    let gestito = false;
    try { gestito = !!cb(); } catch (e) {}
    if (!gestito) App.minimizeApp();
  });
}

const NTPlatform = { isNative, name, notify, calendar, widget, onResume, onApriGiorno, onNotificationTap, onBackButton, canShare, share, print, review, alarm, versione, setSystemBars };
try { if (typeof window !== "undefined") window.NTPlatform = NTPlatform; } catch (e) {}
export default NTPlatform;
