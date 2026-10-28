// alertness.js — finestra di rischio-fatica e picco di lucidità. GRATIS (sicurezza).
//
// Modello, non misura. Semplificazione del modello a tre processi dell'allerta
// (Åkerstedt & Folkard): un processo circadiano C con il nadir nella "window of
// circadian low" notturna, un processo omeostatico S (pressione del sonno che
// cresce con le ore di veglia) e un lieve calo post-prandiale. Nessun dato
// biologico: la fase circadiana è stimata dai TUOI orari di sonno abituali.
// Va sempre etichettato "modellato dai tuoi orari, non una misura".

const parseHM = s => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || "")); return m ? (+m[1]) * 60 + (+m[2]) : null; };
const minOf = d => d.getHours() * 60 + d.getMinutes();
// Arrotondato ai 5 minuti come hhmm() nel core (è un modello, non una
// misura — mostrare i minuti esatti del campionamento, es. "01:19", li
// faceva sembrare più precisi di quello che sono, e diversi da come il
// resto dell'app arrotonda gli orari).
const hhmm = d => {
  let m = Math.round((d.getHours() * 60 + d.getMinutes()) / 5) * 5 % 1440;
  if (m < 0) m += 1440;
  return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
};

// Ritmo circadiano a due armoniche (fondamentale 24h + armonica 12h): riproduce
// la forma reale — nadir notturno profondo, mattino buono, lieve calo pomeridiano,
// sera alta — invece di una cosinusoide sola che sbaglia mattino vs pomeriggio.
// min = minuto dell'orologio, wake = risveglio abituale (minuti).
const ritmo24 = (min, wake) => 0.7 * Math.cos(2 * Math.PI * (min - (wake + 540) % 1440) / 1440);
const ritmo12 = (min, wake) => 0.5 * Math.cos(2 * Math.PI * (min - (wake + 180) % 1440) / 720);

// opts: { now:Date, freeWake, freeBed, lastSleepEnd:Date|null, nextSleepStart:Date|null }
export function alertness(opts) {
  const now = opts.now || new Date();
  const wake = parseHM(opts.freeWake) != null ? parseHM(opts.freeWake) : 450;   // 07:30
  const nadir = ((wake - 180) % 1440 + 1440) % 1440;   // ~3h prima del risveglio, per l'etichetta

  const lastEnd = opts.lastSleepEnd ? opts.lastSleepEnd.getTime() : now.getTime() - 6 * 3600e3;
  // orizzonte: fino a ~1h prima del sonno pianificato (la stanchezza da nanna non è
  // un "rischio" azionabile); altrimenti le prossime 16h.
  const rawHorizon = opts.nextSleepStart ? opts.nextSleepStart.getTime() - 60 * 60000 : now.getTime() + 16 * 3600e3;
  const horizon = Math.max(rawHorizon, now.getTime() + 60 * 60000);

  const C = min => ritmo24(min, wake) + ritmo12(min, wake);
  const S = tMs => 1 - Math.exp(-Math.max(0, (tMs - lastEnd) / 3600e3) / 8); // pressione del sonno
  const A = tMs => C(minOf(new Date(tMs))) - 1.1 * S(tMs);                   // allerta netta

  let riskT = null, riskV = Infinity, peakT = null, peakV = -Infinity;
  const end = horizon;
  for (let t = now.getTime(); t <= end; t += 15 * 60000) {
    const a = A(t);
    if ((t - now.getTime()) >= 30 * 60000 && a < riskV) { riskV = a; riskT = t; }
    if (a > peakV) { peakV = a; peakT = t; }
  }
  const aNow = A(now.getTime());
  const peakFuture = peakT != null && (peakT - now.getTime()) > 45 * 60000;
  return {
    nadirMin: nadir,
    now: { level: aNow > 0.2 ? "alta" : aNow < -0.35 ? "bassa" : "media", value: +aNow.toFixed(3) },
    risk: riskT != null ? { at: new Date(riskT), value: +riskV.toFixed(3), severe: riskV < -0.6, hhmm: hhmm(new Date(riskT)) } : null,
    peak: peakFuture ? { at: new Date(peakT), value: +peakV.toFixed(3), hhmm: hhmm(new Date(peakT)) } : null,
    hoursAwakeAtRisk: riskT != null ? Math.round((riskT - lastEnd) / 3600e3) : null
  };
}

// Le finestre migliori della giornata per tre cose: pensare (testa), muoversi piano (movimento leggero),
// allenarsi (movimento impegnativo). Stessa stima dell'allerta: ritmo circadiano + pressione del sonno,
// con le regole del buon senso (non appena svegli, non subito dopo i pasti, non a ridosso del sonno,
// non durante il turno). Nessun dato biologico: solo i tuoi orari. Minuti sulla scala del giorno guardato.
// inp: { wake, sleepOnset, fase (minuto del minimo corporeo, opzionale), freeWake,
//        occupato:[[a,z]...] (turno con viaggio, sonni, pisolini), pasti:[{at, lt}] }
const FIN = {
  testa:   { lungo: 90, dopoSveglia: 90,  primaSonno: 120, dopoPasto: [0, 60],  dopoPastoLt: [0, 30] },
  leggera: { lungo: 45, dopoSveglia: 45,  primaSonno: 60,  dopoPasto: [0, 30],  dopoPastoLt: [0, 20] },
  intensa: { lungo: 60, dopoSveglia: 120, primaSonno: 180, dopoPasto: [-60, 120], dopoPastoLt: [-30, 60] }
};
// «Quando preferisci»: la fascia dell'orologio in cui far cominciare il momento (minuti dalla mezzanotte).
const FASCE = { mattina: [300, 720], pomeriggio: [720, 1080], sera: [1080, 1380] };
export function finestreAttivita(inp) {
  const fw = isFinite(inp.fase) ? ((inp.fase + 180) % 1440 + 1440) % 1440 : (parseHM(inp.freeWake) != null ? parseHM(inp.freeWake) : 450);
  const w0 = inp.wake, w1 = inp.sleepOnset;
  const out = { testa: null, leggera: null, intensa: null };
  if (!isFinite(w0) || !isFinite(w1) || w1 <= w0) return out;
  const S = m => 1 - Math.exp(-Math.max(0, (m - w0) / 60) / 8);
  const A = m => ritmo24(((m % 1440) + 1440) % 1440, fw) + ritmo12(((m % 1440) + 1440) % 1440, fw) - 1.1 * S(m);
  const F = m => 0.8 * ritmo24(((m % 1440) + 1440) % 1440, fw) + 0.2 * A(m);   // forza e coordinazione seguono soprattutto il ritmo della temperatura
  const occ = (inp.occupato || []).filter(x => x && isFinite(x[0]) && isFinite(x[1]));
  const sovrappone = (a, z, x) => a < x[1] && z > x[0];
  for (const tipo of ["testa", "leggera", "intensa"]) {
    const R = FIN[tipo], score = tipo === "testa" ? A : F, blocchi = occ.slice();
    for (const p of (inp.pasti || [])) {
      const r = p.lt ? R.dopoPastoLt : R.dopoPasto;
      blocchi.push([p.at + r[0], p.at + r[1]]);
    }
    // fascia preferita (ora dell'orologio d'inizio); se in quel giorno non c'è posto, vale il momento migliore
    const trova = fascia => {
      let meglio = null;
      for (let a = Math.ceil((w0 + R.dopoSveglia) / 15) * 15; a + R.lungo <= w1 - R.primaSonno; a += 15) {
        const z = a + R.lungo;
        if (fascia) { const h = ((a % 1440) + 1440) % 1440; if (h < fascia[0] || h >= fascia[1]) continue; }
        if (blocchi.some(x => sovrappone(a, z, x))) continue;
        let somma = 0, n = 0;
        for (let m = a; m < z; m += 15) { somma += score(m); n++; }
        const media = somma / n;
        if (!meglio || media > meglio.media + 1e-9) meglio = { a, z, media };
      }
      return meglio;
    };
    const meglio = trova(FASCE[inp.quando && inp.quando[tipo]]) || trova(null);
    if (meglio) out[tipo] = { a: meglio.a, z: meglio.z };
  }
  return out;
}

// Le finestre di un giorno dal piano del motore (P) e dalle impostazioni (cTo/cFrom = viaggio, prep = preparazione):
// il turno con viaggio e preparazione, e i pisolini, sono tempo occupato. Un solo posto per la pagina e le notifiche.
export function finestreDelPiano(P, cfg) {
  const c = cfg || {}, cTo = +c.cTo || 25, cFrom = +c.cFrom || 25, prep = +c.prep || 45;
  const b = P.b, occupato = [];
  if (b && !b.rest && isFinite(b.start) && isFinite(b.end)) occupato.push([b.start - prep - cTo, b.end + cFrom]);
  for (const n of (P.naps || [])) occupato.push([n.a, n.b]);
  return finestreAttivita({ wake: P.wake, sleepOnset: P.s.onset, fase: P.cbt, freeWake: c.freeWake, occupato, pasti: P.meals || [], quando: (c.piano || {}).quando });
}

// ─────────── integrazione GRATIS nella pagina (guardata: se manca il ponte, non fa nulla) ───────────
// Solo modello. La card "Ora" (rischio + azione del momento + check-in) la disegna
// il core in un unico blocco: qui esponiamo la funzione e, al caricamento, chiediamo
// un re-render così il core può usarla (il modulo arriva dopo il primo render).
try {
  if (typeof window !== "undefined") {
    window.NTAlert = { alertness, finestreAttivita, finestreDelPiano };
    var _k = function () { try { window.dispatchEvent(new Event("nt:refresh")); } catch (e) {} };
    if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", _k);
    else setTimeout(_k, 0);
  }
} catch (e) {}
