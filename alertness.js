// alertness.js — finestra di rischio-fatica e picco di lucidità. GRATIS (sicurezza).
//
// Modello, non misura. Semplificazione del modello a tre processi dell'allerta
// (Åkerstedt & Folkard): un processo circadiano C con il nadir nella "window of
// circadian low" notturna, un processo omeostatico S (pressione del sonno che
// cresce con le ore di veglia) e un lieve calo post-prandiale. Nessun dato
// biologico: la fase circadiana è stimata dai TUOI orari di sonno abituali.
// Va sempre etichettato "modellato dai tuoi orari, non una misura".

const parseHM = s => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || "")); return m ? (+m[1]) * 60 + (+m[2]) : null; };
const wrap720 = x => { while (x > 720) x -= 1440; while (x < -720) x += 1440; return x; };
const minOf = d => d.getHours() * 60 + d.getMinutes();
const hhmm = d => String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");

// opts: { now:Date, freeWake, freeBed, lastSleepEnd:Date|null, nextSleepStart:Date|null }
export function alertness(opts) {
  const now = opts.now || new Date();
  const wake = parseHM(opts.freeWake) != null ? parseHM(opts.freeWake) : 450;   // 07:30
  // Ritmo circadiano a due armoniche (fondamentale 24h + armonica 12h): riproduce
  // la forma reale — nadir notturno profondo, mattino buono, lieve calo pomeridiano,
  // sera alta — invece di una cosinusoide sola che sbaglia mattino vs pomeriggio.
  const acro24 = (wake + 540) % 1440;   // picco fondamentale ~9h dopo il risveglio (sera)
  const acro12 = (wake + 180) % 1440;   // seconda armonica ~3h dopo il risveglio
  const nadir = ((wake - 180) % 1440 + 1440) % 1440;   // ~3h prima del risveglio, per l'etichetta

  const lastEnd = opts.lastSleepEnd ? opts.lastSleepEnd.getTime() : now.getTime() - 6 * 3600e3;
  // orizzonte: fino a ~1h prima del sonno pianificato (la stanchezza da nanna non è
  // un "rischio" azionabile); altrimenti le prossime 16h.
  const rawHorizon = opts.nextSleepStart ? opts.nextSleepStart.getTime() - 60 * 60000 : now.getTime() + 16 * 3600e3;
  const horizon = Math.max(rawHorizon, now.getTime() + 60 * 60000);

  const C = min =>
    0.7 * Math.cos(2 * Math.PI * (min - acro24) / 1440) +
    0.5 * Math.cos(2 * Math.PI * (min - acro12) / 720);
  const S = tMs => 1 - Math.exp(-Math.max(0, (tMs - lastEnd) / 3600e3) / 8); // pressione del sonno
  const A = tMs => C(minOf(new Date(tMs))) - 1.1 * S(tMs);                   // allerta netta

  let riskT = null, riskV = Infinity, peakT = null, peakV = -Infinity;
  const end = horizon;
  for (let t = now.getTime(); t <= end; t += 15 * 60000) {
    const a = A(t);
    if (a < riskV) { riskV = a; riskT = t; }
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

// ─────────── integrazione GRATIS nella pagina (guardata: se manca il ponte, non fa nulla) ───────────
// Solo modello. La card "Ora" (rischio + azione del momento + check-in) la disegna
// il core in un unico blocco: qui esponiamo la funzione e, al caricamento, chiediamo
// un re-render così il core può usarla (il modulo arriva dopo il primo render).
try {
  if (typeof window !== "undefined") {
    window.NTAlert = { alertness };
    var _k = function () { try { window.dispatchEvent(new Event("nt:refresh")); } catch (e) {} };
    if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", _k);
    else setTimeout(_k, 0);
  }
} catch (e) {}
