// notifications.js — dal piano alle notifiche locali.
// Riusa lo STESSO engine.js del browser e del feed: i numeri sono quelli provati.
// Framework-agnostico: restituisce una lista di {id, title, body, at:Date, kind}.
// Il ponte con Capacitor (@capacitor/local-notifications) è banale, sotto in fondo.
//
// Differenza chiave col feed ICS: qui c'è una VERA sveglia AL risveglio (onset+durata),
// non solo il promemoria PRIMA di andare a letto. È il pezzo che il calendario non fa bene.

import { createEngine } from "./engine.js";

const MIN = 60000;
const localMidnight = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const at = (mid, mins) => new Date(mid.getTime() + mins * MIN);
const hhmm = d => String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");

// tipi -> codice id (per id interi stabili: giorno*10 + tipo)
const KIND = { bedtime: 1, wake: 2, nap: 3, coffee: 4, ret: 5, prep: 6 };

export function buildSchedule(config, opts = {}) {
  const {
    days = 14,                 // iOS tiene max 64 notifiche in coda: finestra corta e si ri-arma
    bedtimeLead = 30,          // minuti di preavviso "preparati a dormire"
    prepLead = 0,              // minuti prima del turno (0 = niente promemoria pre-turno)
    types = ["bedtime", "wake", "nap", "coffee", "ret"]
  } = opts;

  const e = createEngine(config);
  const f0 = e.state.focus;
  const now = Date.now();
  const out = [];
  const want = k => types.includes(k);
  const push = (base, mins, kind, title, body) => {
    const when = at(localMidnight(base), mins);
    if (when.getTime() <= now) return;            // solo futuro
    const dayIdx = Math.round((localMidnight(base) - localMidnight(f0)) / (1440 * MIN));
    out.push({ id: dayIdx * 10 + KIND[kind], kind, title, body, at: when });
  };

  for (let o = 0; o < days; o++) {
    const base = new Date(f0); base.setDate(base.getDate() + o);
    e.state.focus = base;
    if (e.codeAt(0) === "?") continue;
    let P; try { P = e.plan(); } catch (_) { continue; }

    if (want("bedtime"))
      push(base, P.s.onset - bedtimeLead, "bedtime", "Preparati a dormire",
        "Sonno pianificato alle " + hhmm(at(localMidnight(base), P.s.onset)) + ".");

    if (want("wake"))
      push(base, P.s.onset + P.s.dur, "wake", "Sveglia",
        "Fine del sonno pianificato. In piedi per restare in fase.");

    if (want("nap") && P.naps)
      P.naps.forEach((n, i) => push(base, n.a, "nap",
        (n.rec || n.debito) ? "Pisolino di recupero" : "Pisolino",
        "Fino alle " + hhmm(at(localMidnight(base), n.b)) + "."));

    if (want("coffee"))
      push(base, P.cut, "coffee", "Ultimo caffè",
        "Dopo quest'ora la caffeina resta in circolo quando provi a dormire.");

    if (want("ret") && (P.night || P.lateStart) && !P.b.rest)
      push(base, P.b.end, "ret", "Rientro dal turno",
        "L'ora più rischiosa. Occhiali, e se sei stanco non guidare: 20 minuti fermo e un caffè.");

    if (want("prep") && prepLead > 0 && !P.b.rest)
      push(base, P.b.start - prepLead, "prep", "Preparati per il turno",
        "Inizio alle " + hhmm(at(localMidnight(base), P.b.start)) + ".");
  }
  e.state.focus = f0;
  out.sort((a, b) => a.at - b.at);
  return out;
}

/* ─── Ponte Capacitor (nel progetto app, non qui) ───────────────────────────
import { LocalNotifications } from "@capacitor/local-notifications";
import { buildSchedule } from "./notifications.js";

export async function riprogramma(config) {
  const perm = await LocalNotifications.requestPermissions();
  if (perm.display !== "granted") return;
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length)
    await LocalNotifications.cancel({ notifications: pending.notifications });
  const items = buildSchedule(config, { days: 14 }).slice(0, 60); // margine sotto il 64 di iOS
  await LocalNotifications.schedule({
    notifications: items.map(n => ({
      id: n.id, title: n.title, body: n.body,
      schedule: { at: n.at, allowWhileIdle: true },   // allowWhileIdle: spara anche in Doze
      sound: n.kind === "wake" ? "sveglia.wav" : undefined,
      channelId: n.kind === "wake" ? "sveglie" : "promemoria"   // Android: canale ad alta priorità per la sveglia
    }))
  });
}
──────────────────────────────────────────────────────────────────────────── */
