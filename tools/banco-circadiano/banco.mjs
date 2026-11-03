// Banco di prova (fuori dall'app): il motore di Notturnisti contro il modello circadiano di Forger, Jewett & Kronauer
// (J Biol Rhythms 1999), scritto qui dalle equazioni pubblicate. Domande:
//  1. dove il motore crede che sia il minimo dell'orologio (P.cbt) e dove lo mette alertness.js (sveglia libera - 3 h),
//     rispetto al modello;
//  2. se seguire i consigli di luce dell'app sposta l'orologio nella direzione giusta rispetto a non seguirli.
import { createEngine } from "../../engine.js";

// ── Forger 1999 ──────────────────────────────────────────────────────────────────────────────
const P99 = { taux: 24.2, mu: 0.23, q: 1/3, k: 0.55, G: 33.75, a0: 0.05, beta: 0.0075, I0: 9500, p: 0.5 };
function deriv([x, xc, n], I) {
  const a = I > 0 ? P99.a0 * Math.pow(I / P99.I0, P99.p) : 0;          // per minuto
  const Bh = P99.G * (1 - n) * a, B = Bh * (1 - 0.4 * x) * (1 - 0.4 * xc);
  const w = Math.PI / 12;
  return [
    w * (xc + B),
    w * (P99.mu * (xc - 4 * xc ** 3 / 3) - x * ((24 / (0.99669 * P99.taux)) ** 2 + P99.k * B)),
    60 * (a * (1 - n) - P99.beta * n)
  ];
}
const DT = 1 / 60;   // ore
function passo(y, I) {
  const k1 = deriv(y, I), y2 = y.map((v, i) => v + DT / 2 * k1[i]);
  const k2 = deriv(y2, I), y3 = y.map((v, i) => v + DT / 2 * k2[i]);
  const k3 = deriv(y3, I), y4 = y.map((v, i) => v + DT * k3[i]);
  const k4 = deriv(y4, I);
  return y.map((v, i) => v + DT / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}
// simula minuto per minuto; restituisce i minimi di x (ore assolute)
function simula(y0, luce, oreTot) {
  let y = y0.slice(); const minimi = []; let prec = [null, null];
  for (let i = 0; i < oreTot * 60; i++) {
    const t = i * DT; y = passo(y, luce(t));
    if (prec[0] !== null && prec[1] < prec[0] && prec[1] <= y[0]) minimi.push(t - DT);
    prec = [prec[1], y[0]];
  }
  return { y, minimi };
}

// ── orari regolari (calibrazione e partenza) ───────────────────────────────────────────────────
const hm = s => +s.slice(0, 2) * 60 + +s.slice(3, 5);
const fmt = m => { m = ((Math.round(m) % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); };
function luceRegolare(bed, wake) {   // a letto 0 lux; mattina e giorno 600 (casa, fuori a tratti), sera 150
  return t => { const m = (t * 60) % 1440, sonno = bed > wake ? (m >= bed || m < wake) : (m >= bed && m < wake);
    return sonno ? 0 : (m >= wake && m < 18 * 60) ? 600 : 150; };
}
const LIBERO = { bed: "23:30", wake: "07:30" };
const reg = simula([-0.5, -0.5, 0.2], luceRegolare(hm(LIBERO.bed), hm(LIBERO.wake)), 24 * 60);
const ultimi = reg.minimi.slice(-10).map(t => (t * 60) % 1440);
const xminReg = ultimi.reduce((a, b) => a + b, 0) / ultimi.length;
// letteratura (Czeisler e coll.): il minimo della temperatura centrale cade ~2 h prima della sveglia abituale.
// Il minimo di x del modello si porta su quel riferimento: tutti gli scarti sotto sono relativi a questa calibrazione.
const FASE = (hm(LIBERO.wake) - 120) - xminReg;
const cbtDi = t => t * 60 + FASE;    // minuti assoluti
console.log(`Calibrazione: orario regolare ${LIBERO.bed}–${LIBERO.wake}, minimo di x del modello alle ${fmt(xminReg)}; riferimento minimo corporeo ${fmt(hm(LIBERO.wake) - 120)} (sveglia − 2 h).`);
console.log(`  il motore (metà sonno + 2 h) dice ${fmt((hm(LIBERO.bed) + (hm(LIBERO.wake) + 1440 - hm(LIBERO.bed)) / 2) + 120)}; alertness.js (sveglia − 3 h) dice ${fmt(hm(LIBERO.wake) - 180)}.\n`);

// ── rotazioni ──────────────────────────────────────────────────────────────────────────────────
const SH = { M: { n: "Mattino", s: 360, e: 840 }, P: { n: "Pomeriggio", s: 840, e: 1320 }, N: { n: "Notte", s: 1320, e: 1800 } };
const ROT = [
  ["Rotazione rapida M-P-N-S-R (5 giorni)", "MPNSR"],
  ["Ciclo continuo 2M 2P 2N 4R", "MMPPNNSRRR"],
  ["Blocco di 5 notti, poi 2 riposi", "NNNNNSR"],
  ["Solo mattine (controllo)", "MMMMMRR"]
];
const GIORNI = 28, INIZIO = "2026-11-02";
const iso = d => d.toISOString().slice(0, 10);
function piani(pattern) {
  const out = [];
  for (let g = 0; g < GIORNI; g++) {
    const d = new Date(INIZIO + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + g);
    const e = createEngine({ pattern, anchor: INIZIO, shifts: SH, repeat: true, focus: iso(d) + "T12:00:00", freeBed: LIBERO.bed, freeWake: LIBERO.wake });
    out.push({ g, P: e.plan(), codice: e.codeAt(0) });
  }
  return out;
}
// regole della luce come in index.html (scheda «Luce»)
function bloccLuce(P) {
  const s = P.s, b = P.b;
  if (P.night) { const fine = Math.min(P.cbt - 120, b.end); return [["seek", b.start, fine], ["avoid", fine, Math.max(s.onset, b.end)]]; }
  if (P.shift < -20) return [["seek", P.wake, P.wake + 180], ["avoid", s.onset - 120, s.onset]];
  return [["seek", P.wake, P.wake + 120], ["avoid", s.onset - 120, s.onset]];
}
function costruisci(lista, consigli) {
  // intervalli assoluti in minuti da INIZIO 00:00
  const sonno = [], turni = [], seek = [], avoid = [];
  for (const { g, P } of lista) {
    const o = g * 1440;
    for (const z of P.sleeps.concat(P.naps)) sonno.push([o + z.a, o + z.b]);
    if (!P.b.rest) turni.push([o + P.b.start, o + P.b.end]);
    for (const [k, a, z] of bloccLuce(P)) (k === "seek" ? seek : avoid).push([o + a, o + z]);
  }
  const dentro = (L, m) => L.some(([a, z]) => m >= a && m < z);
  return m => {
    if (dentro(sonno, m)) return 0;
    const mm = ((m % 1440) + 1440) % 1440, giorno = mm >= 7 * 60 && mm < 17 * 60;   // novembre: luce del giorno ~7-17
    const lavoro = dentro(turni, m);
    if (consigli && dentro(avoid, m)) return 20;                                    // luci basse, occhiali scuri
    if (consigli && dentro(seek, m)) return lavoro ? 1000 : (giorno ? 3000 : 1000);  // la luce più forte disponibile
    if (lavoro) return 300;
    return giorno ? 600 : 150;
  };
}
const riep = [];
for (const [nome, pattern] of ROT) {
  const L = piani(pattern);
  const righe = [], misure = {};
  for (const consigli of [false, true]) {
    const luce = costruisci(L, consigli);
    const ris = simula(reg.y, t => luce(t * 60), GIORNI * 24);
    misure[consigli] = ris.minimi.map(cbtDi);
  }
  console.log(`== ${nome}`);
  console.log("giorno  turno  motore(P.cbt)  vecchio alertness  modello senza consigli  modello con consigli  minimo nel sonno principale? (senza/con)");
  const st = { mot: [], ale: [], dentroS: 0, dentroC: 0, n: 0 };
  for (const { g, P, codice } of L) {
    const o = g * 1440, vicino = (arr, m) => arr.reduce((b, x) => Math.abs(x - m) < Math.abs(b - m) ? x : b, Infinity);
    const mot = o + P.cbt, mS = vicino(misure[false], mot), mC = vicino(misure[true], mot);
    const ale = o + hm(LIBERO.wake) - 180 + (Math.abs(o + hm(LIBERO.wake) - 180 + 1440 - mC) < Math.abs(o + hm(LIBERO.wake) - 180 - mC) ? 1440 : 0);
    const sonnoPrinc = [o + P.s.onset, o + P.s.onset + P.s.dur], dentro = m => m >= sonnoPrinc[0] && m < sonnoPrinc[1];
    if (g >= 7 && g < GIORNI - 1) { st.mot.push((mot - mS) / 60); st.motC = (st.motC || []).concat((mot - mC) / 60); st.ale.push((ale - mS) / 60); st.reg = (st.reg || []).concat((o + P.cbtRegola - mS) / 60); st.n++; if (dentro(mS)) st.dentroS++; if (dentro(mC)) st.dentroC++; }
    if (g >= 7 && g < 7 + Math.max(pattern.length, 5) + 2)
      righe.push(`${String(g).padStart(5)}  ${codice.padEnd(5)}  ${fmt(P.cbt).padEnd(13)}  ${fmt(ale - o).padEnd(9)}  ${fmt(mS - o).padEnd(22)}  ${fmt(mC - o).padEnd(20)}  ${dentro(mS) ? "sì" : "no"} / ${dentro(mC) ? "sì" : "no"}`);
  }
  righe.forEach(r => console.log(r));
  const media = a => a.reduce((x, y) => x + y, 0) / a.length, assm = a => media(a.map(Math.abs));
  console.log(`  dal giorno 7, scarto medio dal modello senza consigli: motore ${assm(st.mot).toFixed(1)} h (con i consigli ${assm(st.motC).toFixed(1)} h), vecchia regola ${assm(st.reg).toFixed(1)} h, vecchio alertness (sveglia − 3 h) ${assm(st.ale).toFixed(1)} h; minimo dentro il sonno principale ${st.dentroS}/${st.n} senza consigli, ${st.dentroC}/${st.n} con i consigli\n`);
  // allineamento: quanto il minimo sta lontano dal posto giusto (2 h prima della sveglia del sonno principale), per scenario
  const allinea = {};
  for (const sc of [false, true]) {
    const err = [], dentro = [];
    for (const { g, P } of L) { if (g < 7 || g >= GIORNI - 1) continue;
      const o = g * 1440, ideale = o + P.s.onset + P.s.dur - 120;
      const m = misure[sc].reduce((b, x) => Math.abs(x - ideale) < Math.abs(b - ideale) ? x : b, Infinity);
      err.push(Math.abs(m - ideale) / 60); dentro.push(m >= o + P.s.onset && m < o + P.s.onset + P.s.dur); }
    allinea[sc] = { err: media(err), dentro: dentro.filter(Boolean).length, n: dentro.length };
  }
  console.log(`  allineamento (scarto dal minimo ideale): senza consigli ${allinea[false].err.toFixed(2)} h, con i consigli ${allinea[true].err.toFixed(2)} h; minimo nel sonno ${allinea[false].dentro}/${allinea[true].dentro} su ${allinea[true].n}\n`);
  riep.push({ nome, mot: assm(st.mot), motC: assm(st.motC), reg: assm(st.reg), ale: assm(st.ale), dentroS: st.dentroS, dentroC: st.dentroC, n: st.n, allinea });
}
console.log("RIEPILOGO (scarto medio dal modello senza consigli)"); for (const r of riep) console.log(`${r.nome}: motore ±${r.mot.toFixed(1)} h, vecchia regola ±${r.reg.toFixed(1)} h, vecchio alertness ±${r.ale.toFixed(1)} h`);
console.log("\nALLINEAMENTO DELL'OROLOGIO (scarto medio dal minimo ideale; minimo dentro il sonno principale)");
for (const r of riep) { const a = r.allinea; console.log(`${r.nome}: senza consigli ${a[false].err.toFixed(2)} h (${a[false].dentro}/${a[false].n}) · con i consigli ${a[true].err.toFixed(2)} h (${a[true].dentro}/${a[true].n})`); }
