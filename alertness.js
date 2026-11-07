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

// Taratura della fase circadiana dai voti sull'energia (ciclo chiuso senza wearable):
// Con abbastanza voti (almeno 6) registrati con timestamp, calcola lo scostamento
// circadiano (-45..+45 min) che massimizza la concordanza fra l'energia percepita e
// l'allerta stimata. Con meno voti: 0 min (nessun effetto).
export function calibraFaseEnergia(voti, opts = {}) {
  if (!Array.isArray(voti) || voti.length < 6) return { faseOffset: 0, nVoti: (voti || []).length, solido: false };
  const fw = parseHM(opts.freeWake) != null ? parseHM(opts.freeWake) : 450;
  const nadirRef = Number.isFinite(opts.nadir) ? ((Math.round(opts.nadir) % 1440) + 1440) % 1440 : ((fw - 180) % 1440 + 1440) % 1440;
  const wakeRef = nadirRef + 180;

  // Candidati di scostamento della fase: da -60 a +60 minuti con passo 15 min
  const candidati = [-60, -45, -30, -15, 0, 15, 30, 45, 60];
  let bestShift = 0, minErr = Infinity;

  for (const shift of candidati) {
    const w = wakeRef + shift;
    let errTot = 0, count = 0;
    for (const item of voti) {
      if (!item || typeof item.voto !== "number" || !item.at) continue;
      const v = Math.min(5, Math.max(1, item.voto));
      const yNorm = (v - 3) / 2;
      const dt = new Date(item.at);
      const min = dt.getHours() * 60 + dt.getMinutes();
      const predC = ritmo24(min, w) + ritmo12(min, w);
      errTot += Math.pow(yNorm - predC, 2);
      count++;
    }
    if (count >= 6 && errTot < minErr) {
      minErr = errTot;
      bestShift = shift;
    }
  }

  // Smorzamento prudente (massimo 45 minuti) per evitare oscillazioni repentine
  const faseOffset = Math.max(-45, Math.min(45, Math.round(bestShift * 0.75 / 15) * 15));
  return { faseOffset, nVoti: voti.length, solido: true };
}

// opts: { now:Date, freeWake, freeBed, lastSleepEnd:Date|null, nextSleepStart:Date|null, nadir?:minuti, faseOffset?:minuti }
// nadir: il minimo corporeo del motore (il modello dell'orologio, P.cbt): il ritmo si centra lì, così la vigilanza e il
// piano dicono la stessa ora. Senza, si stima dalla sveglia libera.
export function alertness(opts) {
  const now = opts.now || new Date();
  const fw = parseHM(opts.freeWake) != null ? parseHM(opts.freeWake) : 450;   // 07:30
  const faseOffset = Number.isFinite(opts.faseOffset) ? opts.faseOffset : 0;
  const nadir = Number.isFinite(opts.nadir) ? ((Math.round(opts.nadir + faseOffset) % 1440) + 1440) % 1440 : (((fw - 180 + faseOffset) % 1440 + 1440) % 1440);
  const wake = nadir + 180;   // il ritmo a due armoniche ha il fondo 3 h prima di questo riferimento (senza nadir: la sveglia libera)

  const lastEnd = opts.lastSleepEnd ? opts.lastSleepEnd.getTime() : now.getTime() - 6 * 3600e3;
  // orizzonte: fino a ~1h prima del sonno pianificato (la stanchezza da nanna non è
  // un "rischio" azionabile); altrimenti le prossime 16h.
  const rawHorizon = opts.nextSleepStart ? opts.nextSleepStart.getTime() - 60 * 60000 : now.getTime() + 16 * 3600e3;
  const horizon = Math.max(rawHorizon, now.getTime() + 60 * 60000);

  // Modello a tre processi (Åkerstedt & Folkard 1995/1997): decadimento esponenziale in sonno (tau = 4.2 h).
  // Se la durata del sonno precedente è inferiore al fabbisogno (di norma 7.5–8 h), permane una pressione residua S0.
  const durH = Number.isFinite(opts.lastSleepDur) ? (opts.lastSleepDur > 24 ? opts.lastSleepDur / 60 : opts.lastSleepDur) : null;
  const needH = Number.isFinite(opts.need) ? (opts.need > 24 ? opts.need / 60 : opts.need) : 7.5;
  const S0 = (durH != null && durH < needH) ? Math.max(0, Math.min(0.85, ((Math.exp(-durH / 4.2) - Math.exp(-needH / 4.2)) / (1 - Math.exp(-needH / 4.2))) * 0.85)) : 0;

  const C = min => ritmo24(min, wake) + ritmo12(min, wake);
  const S = tMs => 1 - (1 - S0) * Math.exp(-Math.max(0, (tMs - lastEnd) / 3600e3) / 8); // pressione del sonno con residuo al risveglio
  const A = tMs => C(minOf(new Date(tMs))) - 1.1 * S(tMs);                   // allerta netta

  // Il calo e il picco sono veri punti di svolta della curva (più bassa/alta dei punti vicini, 45 minuti prima
  // e dopo): così non dipendono da quando si guarda. Prima si cercava il minimo nella finestra da «adesso»:
  // se la curva scendeva e basta, il «calo» cadeva sempre a «adesso + 30 minuti» e scorreva avanti con l'orologio.
  const VICINO = 45 * 60000;
  let riskT = null, riskV = Infinity, peakT = null, peakV = -Infinity;
  const end = horizon;
  for (let t = now.getTime(); t <= end; t += 15 * 60000) {
    const a = A(t), prima = A(t - VICINO), dopo = A(t + VICINO);
    if ((t - now.getTime()) >= 30 * 60000 && a < prima && a < dopo && a < riskV) { riskV = a; riskT = t; }
    if ((t - now.getTime()) > 45 * 60000 && a > prima && a > dopo && a > peakV) { peakV = a; peakT = t; }
  }
  const aNow = A(now.getTime());
  const peakFuture = peakT != null;
  if (riskT != null && Number.isFinite(opts.nadir)) {
    const rDate = new Date(riskT);
    const rMin = minOf(rDate);
    const diff = Math.min(Math.abs(rMin - nadir), 1440 - Math.abs(rMin - nadir));
    if (diff <= 25) {
      let deltaMin = nadir - rMin;
      if (deltaMin > 720) deltaMin -= 1440;
      else if (deltaMin < -720) deltaMin += 1440;
      riskT += deltaMin * 60000;
    }
  }
  return {
    nadirMin: nadir,
    now: { level: aNow > 0.2 ? "alta" : aNow < -0.35 ? "bassa" : "media", value: +aNow.toFixed(3) },
    risk: riskT != null ? { at: new Date(riskT), value: +riskV.toFixed(3), severe: riskV < -0.6, hhmm: hhmm(new Date(riskT)) } : null,
    peak: peakFuture ? { at: new Date(peakT), value: +peakV.toFixed(3), hhmm: hhmm(new Date(peakT)) } : null,
    hoursAwakeAtRisk: riskT != null ? Math.round((riskT - lastEnd) / 3600e3) : null,
    residualPressure: +S0.toFixed(3)
  };
}

// Le finestre migliori della giornata per tre cose: pensare (testa), muoversi piano (movimento leggero),
// allenarsi (movimento impegnativo). Stessa stima dell'allerta: ritmo circadiano + pressione del sonno,
// con le regole del buon senso (non appena svegli, non subito dopo i pasti, non a ridosso del sonno,
// non durante il turno). Nessun dato biologico: solo i tuoi orari. Minuti sulla scala del giorno guardato.
// inp: { wake, sleepOnset, fase (minuto del minimo corporeo, opzionale), freeWake,
//        occupato:[[a,z]...] (turno con viaggio, sonni, pisolini), pasti:[{at, lt}], lastSleepDur, need }
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
  const durH = Number.isFinite(inp.lastSleepDur) ? (inp.lastSleepDur > 24 ? inp.lastSleepDur / 60 : inp.lastSleepDur) : null;
  const needH = Number.isFinite(inp.need) ? (inp.need > 24 ? inp.need / 60 : inp.need) : 7.5;
  const S0 = (durH != null && durH < needH) ? Math.max(0, Math.min(0.85, ((Math.exp(-durH / 4.2) - Math.exp(-needH / 4.2)) / (1 - Math.exp(-needH / 4.2))) * 0.85)) : 0;
  const S = m => 1 - (1 - S0) * Math.exp(-Math.max(0, (m - w0) / 60) / 8);
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
  const lastSleepDur = P.sp && isFinite(P.sp.dur) ? P.sp.dur : (c.need || 480);
  return finestreAttivita({ wake: P.wake, sleepOnset: P.s.onset, fase: P.cbt, freeWake: c.freeWake, occupato, pasti: P.meals || [], quando: (c.piano || {}).quando, lastSleepDur, need: c.need });
}

// ─────────── integrazione GRATIS nella pagina (guardata: se manca il ponte, non fa nulla) ───────────
// Solo modello. La card "Ora" (rischio + azione del momento + check-in) la disegna
// il core in un unico blocco: qui esponiamo la funzione e, al caricamento, chiediamo
// un re-render così il core può usarla (il modulo arriva dopo il primo render).
try {
  if (typeof window !== "undefined") {
    window.NTAlert = { alertness, finestreAttivita, finestreDelPiano, calibraFaseEnergia };
    var _k = function () { try { window.dispatchEvent(new Event("nt:refresh")); } catch (e) {} };
    if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", _k);
    else setTimeout(_k, 0);
  }
} catch (e) {}
