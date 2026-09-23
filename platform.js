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
    if (!("Notification" in window)) return "unsupported";
    return Notification.permission;             // "granted" | "denied" | "default"
  },
  async request() {
    if (!("Notification" in window)) return "unsupported";
    return Notification.requestPermission();
  },
  // Service worker: armato con timer. Limite noto (docs/app-nativa.md §1): i
  // timer muoiono quando il browser chiude il SW, quindi è best-effort.
  async schedule(items) {
    if (!("serviceWorker" in navigator)) return false;
    if (!("Notification" in window) || Notification.permission !== "granted") return false;
    const sw = navigator.serviceWorker.controller;
    if (!sw) return false;
    sw.postMessage({ type: "NT_SCHEDULE", items });
    periodicSync();
    return true;
  }
};

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
    let list = items.map(n => ({
      id: n.id, title: n.title, body: n.body,
      schedule: { at: new Date(n.at), allowWhileIdle: true },
      isExactNotification: n.kind === "wake" && exactOk,
      channelId: n.kind === "wake" ? "sveglie" : "promemoria",
      extra: { kind: n.kind, tab: n.kind === "wake" ? "diario" : "oggi" }
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
  }
};

let _channels = false;
async function ensureChannels(LN) {
  if (_channels || name !== "android") return;
  // Due canali: l'utente regola suono/priorità dalle impostazioni di sistema,
  // senza una schermata nostra da mantenere.
  await LN.createChannel({ id: "sveglie", name: "Sveglia", importance: 5, visibility: 1, vibration: true });
  await LN.createChannel({ id: "promemoria", name: "Promemoria del piano", importance: 3, visibility: 1 });
  _channels = true;
}

export const notify = isNative ? nativeNotify : webNotify;

/* ── Calendario ────────────────────────────────────────────────────────── */
// Web: non disponibile (restano feed ICS e download .ics). Nativo: arriva con
// la fase 3 del piano (docs/app-nativa.md §4.2). La firma è già quella finale.
export const calendar = {
  available: false,
  async sync(events, coupleEvents) { return false; }
};

/* ── Widget ────────────────────────────────────────────────────────────── */
// Fase 4 (Android) e 5 (iOS). Web: nessun widget possibile, no-op.
export const widget = {
  available: false,
  async publish(snapshot) { return false; }
};

/* ── Eventi dell'app nativa ────────────────────────────────────────────── */
// Sul web non scattano mai: lì bastano visibilitychange e i messaggi del SW.
export function onResume(cb) {
  const App = plugin("App");
  if (App) App.addListener("resume", () => { try { cb(); } catch (e) {} });
}
export function onNotificationTap(cb) {
  const LN = plugin("LocalNotifications");
  if (LN) LN.addListener("localNotificationActionPerformed", ev => {
    try { cb((ev && ev.notification && ev.notification.extra && ev.notification.extra.tab) || "oggi"); } catch (e) {}
  });
}

const NTPlatform = { isNative, name, notify, calendar, widget, onResume, onNotificationTap };
try { if (typeof window !== "undefined") window.NTPlatform = NTPlatform; } catch (e) {}
export default NTPlatform;
