// notifications.js — dal piano alle notifiche locali.
// Riusa lo STESSO engine.js del browser e del feed: i numeri sono quelli provati.
// Framework-agnostico: restituisce una lista di {id, title, body, at:Date, kind}.
// Il ponte con Capacitor (@capacitor/local-notifications) sta in platform.js.
//
// Differenza chiave col feed ICS: qui c'è una VERA sveglia AL risveglio (onset+durata),
// non solo il promemoria PRIMA di andare a letto. È il pezzo che il calendario non fa bene.

import { createEngine } from "./engine.js";

const MIN = 60000;
const localMidnight = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const at = (mid, mins) => new Date(mid.getTime() + mins * MIN);
const hhmm = d => String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");

// Catalogo dei tipi di notifica: unica fonte per il motore (qui), per gli
// interruttori in Impostazioni e per i canali Android (platform.js). Ogni tipo
// ha un suo canale, così si può spegnere anche dalle impostazioni del telefono.
// "essenziale" = acceso nella scelta "Essenziali" (2–3 al giorno).
export const TIPI = [
  { k: "cambio",   nome: "Domani cambi turno",       desc: "Il giorno prima di un cambio: a che ora andare a letto e come prepararti", essenziale: true,  canale: "turni" },
  { k: "ret",      nome: "Rientro dopo la notte",    desc: "Alla fine delle notti: l'ora più rischiosa per guidare",                essenziale: true,  canale: "sicurezza" },
  { k: "rischio",  nome: "Giorni impegnativi",       desc: "Prima della terza notte di fila o di un rientro con meno di 11 ore di riposo: cosa fare per arrivarci meglio", essenziale: true, canale: "sicurezza" },
  { k: "bedtime",  nome: "Preparati a dormire",      desc: "Mezz'ora prima del sonno pianificato",                                   essenziale: true,  canale: "sonno" },
  { k: "domani",   nome: "Che turno fai domani?",    desc: "Solo se domani non è segnato: senza turno il piano non c'è",             essenziale: true,  canale: "turni" },
  { k: "coffee",   nome: "Ultimo caffè",             desc: "L'ora oltre la quale il caffè ti disturba il sonno",                     essenziale: false, canale: "caffe" },
  { k: "nap",      nome: "Pisolino",                 desc: "Solo nei giorni in cui il piano lo prevede",                             essenziale: false, canale: "pisolini" },
  { k: "prep",     nome: "Preparati per il turno",   desc: "Un'ora prima dell'inizio del turno",                                     essenziale: false, canale: "turni" },
  { k: "luce",     nome: "Luce del mattino",         desc: "Quando prendere luce per restare in fase",                               essenziale: false, canale: "luce" },
  { k: "wake",     nome: "Ora di alzarti",           desc: "Fine del sonno pianificato. Non è una sveglia: per quella usa la sveglia del telefono", essenziale: false, canale: "sveglie" },
  { k: "settimana",nome: "La tua settimana",         desc: "La domenica sera, i turni dei prossimi 7 giorni",                        essenziale: false, canale: "suggerimenti" },
  // Questi due li prepara index.html (servono il diario e le impostazioni),
  // non buildSchedule: sono silenziosi e si diradano da soli.
  { k: "diario",   nome: "Come hai dormito?",        desc: "Poco dopo il risveglio, senza suono: annoti la notte in un tocco e il piano si adatta. Se non rispondi, si dirada da solo", essenziale: true, canale: "suggerimenti" },
  { k: "consigli", nome: "Consigli per il tuo piano", desc: "Al massimo uno a settimana, in un giorno libero: cosa manca perché il piano sia davvero tuo", essenziale: true, canale: "suggerimenti" }
];
export const TIPI_ESSENZIALI = TIPI.filter(t => t.essenziale).map(t => t.k);
export const TIPI_TUTTI = TIPI.map(t => t.k);

// tipi -> codice id. id = giorno*100 + tipo*10 + progressivo: stabile per
// giorno e tipo, e unico anche con più pisolini nello stesso giorno (prima
// giorno*10+tipo: due pisolini avevano lo stesso id, e su Android il secondo
// cancellava il primo).
const KIND = { bedtime: 1, wake: 2, nap: 3, coffee: 4, ret: 5, prep: 6, cambio: 7, domani: 8, luce: 9, settimana: 0 };
// Priorità quando un giorno ne avrebbe troppe (si tengono le prime).
const PRIO = ["cambio", "ret", "rischio", "bedtime", "domani", "nap", "coffee", "prep", "luce", "wake", "settimana"];
const MAX_AL_GIORNO = 4, UNISCI_ENTRO = 20 * MIN;
const GIORNI = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];
const durTxt = m => { m = Math.round(Math.abs(m)); const h = Math.floor(m / 60), r = m % 60; return h ? h + (r ? "h" + String(r).padStart(2, "0") : " or" + (h === 1 ? "a" : "e")) : r + " min"; };

export function buildSchedule(config, opts = {}) {
  const {
    days = 14,                 // iOS tiene max 64 notifiche in coda: finestra corta e si ri-arma
    bedtimeLead = 30,          // minuti di preavviso "preparati a dormire"
    prepLead = 60,             // minuti prima del turno (solo se il tipo "prep" è acceso)
    types = TIPI_ESSENZIALI
  } = opts;

  const e = createEngine(config);
  const f0 = e.state.focus;
  const now = Date.now();
  const out = [];
  const sonni = [];             // intervalli di sonno pianificato: lì non si disturba
  const want = k => types.includes(k);
  const seq = {};
  const push = (base, mins, kind, title, body, extra) => {
    const when = at(localMidnight(base), mins);
    const dayIdx = Math.round((localMidnight(base) - localMidnight(f0)) / (1440 * MIN));
    const k = dayIdx + ":" + kind, n = seq[k] = (seq[k] || 0) + 1;   // contato anche se nel passato: id stabili
    if (when.getTime() <= now) return;            // solo futuro
    // "rischio" non ha una cifra libera in KIND (0–9 usate): una sua fascia di id
    const id = kind === "rischio" ? 980000 + (dayIdx + 1) * 10 + (n - 1) : dayIdx * 100 + KIND[kind] * 10 + (n - 1);
    out.push({ id, kind, title, body, at: when, extra });
  };
  const fb = /^(\d\d):(\d\d)$/.exec(String(e.state.freeBed || "23:30"));
  let lettoSolito = fb ? (+fb[1]) * 60 + (+fb[2]) : 1410; if (lettoSolito < 720) lettoSolito += 1440;
  let domaniContati = 0;
  // Sonno della sera prima (stessa scala: minuti dalla mezzanotte del suo
  // giorno), per riconoscere un CAMBIO e non ripetere l'avviso ogni sera di
  // una settimana di mattine.
  let onsetIeri = null;
  { const ieri = new Date(f0); ieri.setDate(ieri.getDate() - 1); e.state.focus = ieri;
    if (e.codeAt(0) !== "?") { try { onsetIeri = e.plan().s.onset; } catch (_) {} } e.state.focus = f0; }

  // Notti di fila fino a ieri (al massimo 6 indietro): poi si aggiorna giorno per giorno.
  let nottiDiFila = 0;
  for (let k = 1; k <= 6; k++) {
    const d = new Date(f0); d.setDate(d.getDate() - k); e.state.focus = d;
    let Pk = null; if (e.codeAt(0) !== "?") { try { Pk = e.plan(); } catch (_) {} }
    if (Pk && Pk.night) nottiDiFila++; else break;
  }
  e.state.focus = f0;
  const ORDINALE = ["", "", "seconda", "terza", "quarta", "quinta", "sesta", "settima"];

  for (let o = 0; o < days; o++) {
    const base = new Date(f0); base.setDate(base.getDate() + o);
    e.state.focus = base;
    const codice = e.codeAt(0), codiceDomani = e.codeAt(1);
    // Turni variabili: l'ultimo giorno segnato, la sera, chiede il successivo.
    if (want("domani") && codice !== "?" && codiceDomani === "?" && domaniContati < 1) {
      domaniContati++;
      push(base, 19 * 60, "domani", "Che turno fai domani?", "Tocca per segnarlo: il piano di domani dipende da questo.", { tab: "domani" });
    }
    if (codice === "?") { onsetIeri = null; nottiDiFila = 0; continue; }
    let P; try { P = e.plan(); } catch (_) { onsetIeri = null; nottiDiFila = 0; continue; }
    nottiDiFila = P.night ? nottiDiFila + 1 : 0;
    const prevOnset = onsetIeri; onsetIeri = P.s.onset;
    const mid = localMidnight(base);
    sonni.push([at(mid, P.s.onset).getTime(), at(mid, P.s.onset + P.s.dur).getTime()]);

    if (want("bedtime"))
      push(base, P.s.onset - bedtimeLead, "bedtime", "Preparati a dormire",
        "Sonno pianificato alle " + hhmm(at(mid, P.s.onset)) + ".");

    if (want("wake"))
      push(base, P.s.onset + P.s.dur, "wake", "Ora di alzarti",
        "Fine del sonno pianificato. In piedi per restare in fase.");

    if (want("nap") && P.naps)
      P.naps.forEach((n, i) => push(base, n.a, "nap",
        (n.rec || n.debito) ? "Pisolino di recupero" : "Pisolino",
        "Fino alle " + hhmm(at(mid, n.b)) + ".", { tab: "pisolino" }));

    if (want("coffee"))
      push(base, P.cut, "coffee", "Ultimo caffè",
        "Dopo quest'ora la caffeina resta in circolo quando provi a dormire.");

    // 10 minuti prima della fine: lo leggi prima di uscire, non già alla guida.
    if (want("ret") && (P.night || P.lateStart) && !P.b.rest)
      push(base, P.b.end - 10, "ret", "Rientro dal turno",
        "Tra poco l'ora più rischiosa per guidare. Occhiali da sole, e se hai sonno non guidare: 20 minuti di sosta e un caffè.");

    // Giorni impegnativi: non un allarme nel momento del calo (al lavoro, o
    // alla guida, sarebbe solo una distrazione) ma un consiglio prima, quando
    // si può ancora fare qualcosa. Solo dove il piano lo vede davvero.
    if (want("rischio") && !P.b.rest) {
      const pb = P.pb;
      // Rientro ravvicinato: meno di 11 ore tra la fine di ieri e l'inizio di oggi.
      // Si dice a fine turno di ieri, quando si decide come passare la sera.
      if (pb && !pb.rest && isFinite(pb.end) && isFinite(P.b.start)) {
        const riposo = 1440 + P.b.start - pb.end;
        if (riposo > 0 && riposo < 660)
          // mezz'ora prima della fine del turno di ieri: si è ancora al lavoro (svegli)
          push(base, pb.end - 1440 - 30, "rischio", "Domani rientri presto",
            "Inizi alle " + hhmm(at(mid, P.b.start)) + ", " + durTxt(riposo) + " dopo la fine di oggi: a letto appena arrivi a casa.", { tab: "oggi", alLavoro: true });
      }
      // Notte impegnativa: terza (o più) di fila, o il calo più forte dentro il
      // turno con poco sonno prima.
      if (P.night && nottiDiFila >= 3) {
        // Dalla terza notte di fila il debito si accumula: il pisolino prima e
        // una pausa nel momento del calo contano di più.
        const parti = [(ORDINALE[nottiDiFila] ? ORDINALE[nottiDiFila][0].toUpperCase() + ORDINALE[nottiDiFila].slice(1) : nottiDiFila + "ª") + " notte di fila"];
        const pis = (P.naps || []).find(n => n.b <= P.b.start);
        if (pis) parti.push("Se puoi, pisolino alle " + hhmm(at(mid, pis.a)));
        // il minimo corporeo resta ancorato al ritmo naturale (come in Oggi)
        const minimo = e.naturalMid() + e.CFG.cbtOffset;
        if (minimo >= P.b.start && minimo < P.b.end) parti.push("Il calo più forte cadrà verso le " + hhmm(at(mid, minimo)) + ": tieni lì una pausa, se puoi");
        push(base, pis ? pis.a - 30 : P.b.start - 180, "rischio", "Notte impegnativa",
          "Inizio alle " + hhmm(at(mid, P.b.start)) + ". " + parti.join(". ") + ".");
      }
    }

    if (want("prep") && prepLead > 0 && !P.b.rest)
      push(base, P.b.start - prepLead, "prep", "Preparati per il turno",
        "Inizio alle " + hhmm(at(mid, P.b.start)) + ".");

    if (want("luce") && !P.night)
      push(base, P.wake + 15, "luce", "Luce del mattino",
        "Esci o apri le tende entro un'ora: aiuta il corpo a restare in fase.");

    // Domani cambi turno: il giorno prima di un cambio che chiede di
    // spostare il sonno (a letto presto) o di prepararsi a una notte.
    if (want("cambio")) {
      let Pn = null; const dom = new Date(base); dom.setDate(dom.getDate() + 1);
      if (codiceDomani !== "?") { e.state.focus = dom; try { Pn = e.plan(); } catch (_) {} e.state.focus = base; }
      // a letto almeno 90 minuti prima di ieri sera (o del solito, se ieri non si sa)
      const scarto = P.s.onset - (prevOnset != null ? prevOnset : lettoSolito);
      if (Pn && !Pn.b.rest && Pn.night && !P.night) {
        const pis = (Pn.naps || [])[0];
        push(base, Math.max(12 * 60, P.s.onset - 240), "cambio", "Domani fai la notte",
          (Pn.b.name || "Notte") + " dalle " + hhmm(at(localMidnight(dom), Pn.b.start)) + ". Stanotte dormi pure fino a tardi" +
          (pis ? ", domani pisolino alle " + hhmm(at(localMidnight(dom), pis.a)) : "") + ".");
      } else if (Pn && !Pn.b.rest && scarto <= -90 && !P.night) {
        push(base, Math.max(12 * 60, P.s.onset - 240), "cambio", "Stasera a letto presto",
          "Alle " + hhmm(at(mid, P.s.onset)) + ", " + durTxt(scarto) + " prima di ieri sera: domani " +
          (Pn.b.name || "turno") + " alle " + hhmm(at(localMidnight(dom), Pn.b.start)) + ".");
      }
    }

    // La domenica sera, la settimana che arriva.
    if (want("settimana") && base.getDay() === 0) {
      const righe = [];
      for (let k = 1; k <= 7; k++) {
        const d = new Date(base); d.setDate(d.getDate() + k); e.state.focus = d;
        const c = e.codeAt(0); const sh = e.state.shifts && e.state.shifts[c];
        righe.push(GIORNI[d.getDay()] + " " + (c === "?" ? "?" : sh ? sh.n : "riposo"));
      }
      e.state.focus = base;
      push(base, 19 * 60, "settimana", "La tua settimana", righe.join(" · "), { tab: "turni" });
    }
  }
  e.state.focus = f0;

  // Regole contro il fastidio: niente durante il sonno pianificato (tranne
  // "ora di alzarti"); due avvisi entro 20 minuti diventano uno; al massimo
  // 4 al giorno, tenendo i più importanti.
  let lista = out.filter(n => n.kind === "wake" || (n.extra && n.extra.alLavoro) || !sonni.some(([a, z]) => n.at.getTime() > a + MIN && n.at.getTime() < z - MIN));
  lista.sort((a, b) => a.at - b.at);
  const unite = [];
  for (const n of lista) {
    const prec = unite[unite.length - 1];
    if (prec && n.at - prec.at <= UNISCI_ENTRO && n.kind !== "wake" && prec.kind !== "wake") {
      const [prima, dopo] = PRIO.indexOf(n.kind) < PRIO.indexOf(prec.kind) ? [n, prec] : [prec, n];
      unite[unite.length - 1] = { ...prima, at: prec.at, body: prima.body + " · " + dopo.title + ": " + dopo.body };
    } else unite.push(n);
  }
  const perGiorno = {};
  unite.forEach(n => { const k = localMidnight(n.at).getTime(); (perGiorno[k] = perGiorno[k] || []).push(n); });
  const finali = [];
  Object.values(perGiorno).forEach(g => {
    g.sort((a, b) => PRIO.indexOf(a.kind) - PRIO.indexOf(b.kind));
    finali.push(...g.slice(0, MAX_AL_GIORNO));
  });
  finali.sort((a, b) => a.at - b.at);
  return finali;
}

/* ─── Ponte browser senza import incrociati ─────────────────────────────────
   Espone buildSchedule sul global così che index.html possa chiamarla senza
   import dinamico (stesso pattern di NTAlert e NTHistory).                   */
try {
  if (typeof window !== "undefined") {
    window.NTNotif = { buildSchedule, TIPI, TIPI_ESSENZIALI, TIPI_TUTTI };
    // Segnala al core che il modulo è pronto (potrebbe essere arrivato dopo render)
    var _kn = function () { try { window.dispatchEvent(new Event("nt:refresh")); } catch (e) {} };
    if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", _kn);
    else setTimeout(_kn, 0);
  }
} catch (e) {}

/* Dove queste notifiche vengono armate (service worker sul web, sistema
   operativo nell'app nativa) lo decide platform.js — notify.schedule(). */
