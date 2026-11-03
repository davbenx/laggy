// Ottimizzatore della luce su più giorni (orizzonte mobile) contro le regole attuali dell'app. Fuori dall'app.
// Idea (Serkh & Forger, PLoS Comput Biol 2014; schemi «bang-bang»: luce forte o buio): ogni giorno si scelgono una finestra
// «cerca luce» e una «evita luce» per i prossimi H giorni minimizzando il disallineamento dell'orologio dai sonni principali
// (minimo corporeo 2 h prima della sveglia); si tiene la scelta di oggi e si ripete domani. Vincoli: mai «evita» al lavoro,
// luce forte 3000 lux solo con il sole e fuori dal lavoro (1000 altrimenti), buio 20 lux.
// Uso: node ottimizza.mjs [tau] [adesione 0-1] [cartella per esportare la luce]
import { createEngine } from "../../engine.js";
import { writeFileSync } from "node:fs";
import { calcola } from "../../luce-worker.js";   // APP=1: le finestre le sceglie il codice dell'app (luce-ottima.js), giorno per giorno

const TAU = +(process.argv[2] || 24.2), ADES = +(process.argv[3] || 1), OUT = process.argv[4] || null;
// l'ottimizzatore conosce solo la persona media (τ 24,2); la valutazione usa la persona «vera» (τ dato)
const NOM = { taux: 24.2, mu: 0.23, k: 0.55, G: 33.75, a0: 0.05, beta: 0.0075, I0: 9500, p: 0.5 }, VERA = { ...NOM, taux: TAU };
let F = NOM;
const _F_inutile = { taux: TAU, mu: 0.23, k: 0.55, G: 33.75, a0: 0.05, beta: 0.0075, I0: 9500, p: 0.5 };
const der = (x, xc, n, I) => { const a = I > 0 ? F.a0 * Math.pow(I / F.I0, F.p) : 0, B = F.G * (1 - n) * a * (1 - 0.4 * x) * (1 - 0.4 * xc), w = Math.PI / 12;
  return [w * (xc + B), w * (F.mu * (xc - 4 * xc ** 3 / 3) - x * ((24 / (0.99669 * F.taux)) ** 2 + F.k * B)), 60 * (a * (1 - n) - F.beta * n)]; };
// Hannay 2019 (come la libreria circadian): ampiezza R, fase ψ; minimo corporeo dove ψ = π
const HN = {tau:23.84, K:0.06358, gamma:0.024, Beta1:-0.09318, A1:0.3855, A2:0.1977, BetaL1:-0.0026, BetaL2:-0.957756, sigma:0.0400692, G:33.75, a0:0.05, delta:0.0075, p:1.5, I0:9325};
const derH = (R, Psi, n, I) => { const Hp = F.H || HN, Ip = I > 0 ? Math.pow(I, Hp.p) : 0, a = Hp.a0 * Ip / (Ip + Hp.I0), B = Hp.G * (1 - n) * a, R4 = R ** 4, R8 = R4 * R4;
  const amp = Hp.A1*0.5*B*(1-R4)*Math.cos(Psi+Hp.BetaL1) + Hp.A2*0.5*B*R*(1-R8)*Math.cos(2*Psi+Hp.BetaL2);
  const fa = Hp.sigma*B - Hp.A1*B*0.5*(R**3 + 1/R)*Math.sin(Psi+Hp.BetaL1) - Hp.A2*B*0.5*(1+R8)*Math.sin(2*Psi+Hp.BetaL2);
  return [-Hp.gamma*R + Hp.K*Math.cos(Hp.Beta1)/2*R*(1-R4) + amp, 2*Math.PI/Hp.tau + Hp.K/2*Math.sin(Hp.Beta1)*(1+R4) + fa, 60*(a*(1-n) - Hp.delta*n)]; };
const DT = 10, h = DT / 60;
const passo = (y, I) => { const D = F.H ? derH : der, f = (d, c) => D(y[0] + c * d[0], y[1] + c * d[1], y[2] + c * d[2], I);
  const k1 = D(y[0], y[1], y[2], I), k2 = f(k1, h / 2), k3 = f(k2, h / 2), k4 = f(k3, h); return [0, 1, 2].map(i => y[i] + h / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])); };

const SH = { M: { n: "Mattino", s: 360, e: 840 }, P: { n: "Pomeriggio", s: 840, e: 1320 }, N: { n: "Notte", s: 1320, e: 1800 } };
const ROT_BASE = [["M-P-N-S-R", "MPNSR"], ["2M 2P 2N 4R", "MMPPNNSRRR"], ["5 notti, 2 riposi", "NNNNNSR"], ["Solo mattine", "MMMMMRR"]];
// turnazioni estreme: 12 ore, 24 ore, notti fisse, rientri rapidi, sere lunghe, calendario irregolare senza schema
const SH12 = { G: { n: "Giorno 12h", s: 420, e: 1140 }, N: { n: "Notte 12h", s: 1140, e: 1860 } };
const SH24 = { X: { n: "24 ore", s: 480, e: 1920 } };
const SHL = { L: { n: "Sera lunga", s: 1080, e: 1560 } };
// irregolare: 35 giorni a caso (bit alti del generatore: i bassi si ripetono), dopo una notte mai un mattino o un pomeriggio
const irregolare = (() => { let r = 7; const c = "MPNR"; let out = ""; for (let i = 0; i < 35; i++) { r = (r * 1103515245 + 12345) % 2147483648; out += c[(r >>> 16) % 4]; } return out.replace(/N[MP]/g, "NR"); })();
if (process.env.SOLO) console.log("irregolare:", irregolare);
const ROT_ESTREME = [["12 ore 2G 2N 4R", "GGNNSRRR", SH12], ["24 ore ogni 4 giorni", "XRRR", SH24], ["7 notti fisse, 7 riposi", "NNNNNNNSRRRRRR"],
  ["Rientri rapidi P→M", "PMPMPRR"], ["Sere lunghe 18-02", "LLLLLRR", SHL], ["Irregolare 5 settimane", irregolare]];
const ROT = (process.env.ESTREME === "1" ? ROT_ESTREME : ROT_BASE).filter(r => !process.env.SOLO || r[0].startsWith(process.env.SOLO));
const GIORNI = 28, INIZIO = "2026-11-02", H = 4;
const iso = d => d.toISOString().slice(0, 10);
const giornoLuce = g => g >= 7 * 60 && g < 17 * 60;   // novembre

function piani(pattern, turni = SH) {
  const out = [];
  for (let g = 0; g < GIORNI + H; g++) { const d = new Date(INIZIO + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + g);
    const e = createEngine({ pattern, anchor: INIZIO, shifts: turni, repeat: true, focus: iso(d) + "T12:00:00", freeBed: "23:30", freeWake: "07:30" });
    out.push(e.plan()); }
  return out;
}
// minuto per minuto (passo 10): stato di base del giorno: 0 sonno, 1 lavoro, 2 sveglio
function base(P) {
  const N = (GIORNI + H + 1) * 1440 / DT, s = new Uint8Array(N).fill(2);
  P.forEach((p, g) => { const o = g * 1440;
    for (const z of p.sleeps.concat(p.naps)) for (let m = o + z.a; m < o + z.b; m += DT) if (m >= 0 && m / DT < N) s[Math.floor(m / DT)] = 0;
    if (!p.b.rest) for (let m = o + p.b.start; m < o + p.b.end; m += DT) if (m / DT < N && s[Math.floor(m / DT)] !== 0) s[Math.floor(m / DT)] = 1; });
  return s;
}
const luceBase = (st, i) => st === 0 ? 0 : st === 1 ? 300 : giornoLuce((i * DT) % 1440) ? 600 : 150;
// una decisione per giorno: {c:[a,z]|null, e:[a,z]|null} in minuti assoluti
function luce(st, dec, adesione) {
  const L = new Float32Array(st.length);
  for (let i = 0; i < st.length; i++) L[i] = luceBase(st[i], i);
  dec.forEach((d, g) => { if (!d || !adesione[g]) return;
    if (d.c) for (let m = d.c[0]; m < d.c[1]; m += DT) { const i = Math.floor(m / DT); if (i >= 0 && i < L.length && st[i] !== 0) L[i] = st[i] === 1 || !giornoLuce(m % 1440) ? 1000 : 3000; }
    if (d.e) for (let m = d.e[0]; m < d.e[1]; m += DT) { const i = Math.floor(m / DT); if (i >= 0 && i < L.length && st[i] === 2) L[i] = 20; } });
  return L;
}
function simula(y0, L, i0, i1) {   // minimi di x fra i campioni i0 e i1 (minuti assoluti), con interpolazione
  let y = y0.slice(), p = null, p2 = null; const min = [];
  for (let i = i0; i < i1; i++) { y = passo(y, L[i]); const x = F.H ? Math.cos(y[1]) : y[0];
    if (p2 !== null && p < p2 && p <= x) { const d = p2 - 2 * p + x, v = d > 0 ? 0.5 * (p2 - x) / d : 0; min.push((i - 1 + v) * DT + DT); }
    p2 = p; p = x; }
  return { y, min };
}
// partenza: orario libero ripetuto 30 giorni; scarto di fase come nel motore (minimo 2 h prima della sveglia libera)
const entra = () => { let y = F.H ? [0.82041911, 1.71383697, 0.52318122] : [-0.0843259, -1.09607546, 0.45584306]; const L = []; for (let i = 0; i < 1440 / DT; i++) { const m = i * DT; L.push(m >= 1410 || m < 450 ? 0 : giornoLuce(m) ? 600 : 150); }
  let mins = []; for (let g = 0; g < 30; g++) { const r = simula(y, L, 0, L.length); y = r.y; if (g > 24) mins.push(...r.min.map(m => m % 1440)); }
  const xm = mins.reduce((a, b) => a + b, 0) / mins.length; return { y, fase: (450 - 120) - xm }; };
const lib = entra();                    // persona media: stato di partenza e calibrazione dell'app
// ottimizzazione robusta («più individui»): tre orologi plausibili, τ 24,0 / 24,2 / 24,4, ognuno con il suo stato di partenza
const ROBUSTO = process.env.ROBUSTO === "1";
const MEMBRI = process.env.ROBUSTO === "2"
  ? [{ ...NOM, taux: 24.0 }, { ...NOM, taux: 24.4 }, { ...NOM, H: { ...HN, tau: 23.64 } }, { ...NOM, H: { ...HN, tau: 24.04 } }]
  : (ROBUSTO ? [24.0, 24.2, 24.4] : [24.2]).map(t => ({ ...NOM, taux: t }));
const GRUPPO = MEMBRI.map(m => { const prima = F; F = m; const e = entra(); const r = { F, y: e.y, fase: e.fase }; F = prima; return r; });
F = VERA; const libVera = entra(); F = NOM;   // persona vera: il suo stato di partenza (la calibrazione resta quella dell'app)
const ideali = P => P.map((p, g) => g * 1440 + p.s.onset + p.s.dur - 120);
function costo(min, ideale, g0, g1, fase = lib.fase) {
  let c = 0; for (let g = g0; g < g1; g++) { const t = ideale[g]; let b = Infinity; for (const m of min) { const v = m + fase; if (Math.abs(v - t) < Math.abs(b - t)) b = v; } c += ((b - t) / 60) ** 2; }
  return c;
}
// le regole attuali dell'app (scheda «Luce»), per confronto
function regole(P) {
  return P.map((p, g) => { const o = g * 1440, s = p.s, b = p.b;
    if (p.night) { const f = s.strategy === "contieni" ? b.end : Math.min(p.cbt - 120, b.end); return { c: [o + b.start, o + f], e: [o + f, o + Math.max(s.onset, b.end)] }; }
    if (p.shift < -20) return { c: [o + p.wake, o + p.wake + 180], e: [o + s.onset - 120, o + s.onset] };
    return { c: [o + p.wake, o + p.wake + 120], e: [o + s.onset - 120, o + s.onset] }; });
}
// candidati di un giorno: inizio a passi di un'ora nelle ore da sveglio (o al lavoro per «cerca»), durate 1-4 h; nessuna finestra
function candidati(st, g, tipo) {
  const out = [null], lens = tipo === "c" ? [60, 120, 180, 240] : [60, 120, 180];
  for (let a = g * 1440; a < (g + 1) * 1440 + 360; a += 60) { const i = Math.floor(a / DT); if (i >= st.length || st[i] === 0 || (tipo === "e" && st[i] === 1)) continue;
    for (const l of lens) out.push([a, a + l]); }
  return out;
}
const PESO_VIG = +(process.env.PESO_VIG ?? 8), PESO_CARICO = +(process.env.PESO_CARICO ?? 0.1);
function pressione(st) { const S = new Float32Array(st.length); let v = 0.3; for (let i = 0; i < st.length; i++) { v = st[i] === 0 ? v * Math.exp(-h / 4.2) : 1 - (1 - v) * Math.exp(-h / 18.2); S[i] = v; } return S; }
function simulaV(y0, L, i0, i1, S, st) {   // come simula, più le ore di vigilanza bassa al lavoro e al rientro
  let y = y0.slice(), p = null, p2 = null, bassi = 0; const min = [], forger = !F.H;
  for (let i = i0; i < i1; i++) { y = passo(y, L[i]); const x = F.H ? Math.cos(y[1]) : y[0];
    if (forger && st && (st[i] === 1 || (st[i] === 2 && i >= 3 && (st[i-1] === 1 || st[i-2] === 1 || st[i-3] === 1))) && 0.5 * y[0] - S[i] < SOGLIA) bassi += h;
    if (p2 !== null && p < p2 && p <= x) { const d = p2 - 2 * p + x, v = d > 0 ? 0.5 * (p2 - x) / d : 0; min.push((i - 1 + v) * DT + DT); }
    p2 = p; p = x; }
  return { y, min, bassi };
}
function ottimizza(P, st, ideale) {
  const S = pressione(st);
  const dec = regole(P), R = regole(P), tutti = new Array(P.length).fill(true);
  const MINIMAX = process.env.MINIMAX === "1";
  let ys = GRUPPO.map(m => m.y.slice());
  for (let g = 0; g < GIORNI; g++) {
    const i0 = g * 1440 / DT, i1 = (g + H) * 1440 / DT;
    const prova = () => { const L = luce(st, dec, tutti); let c = 0;
      GRUPPO.forEach((m, k) => { F = m.F; const r = simulaV(ys[k], L, i0, i1, S, st); c += costo(r.min, ideale, g, g + H - 1, m.fase) + PESO_VIG * r.bassi; }); F = NOM;
      return c + PESO_CARICO * GRUPPO.length * carico(dec, g, g + H) * H; };
    let migliore = prova();
    for (let pass = 0; pass < 2; pass++) for (let d = g; d < g + H; d++) for (const t of ["c", "e"]) {
      const prima = dec[d][t]; let best = prima;
      for (const cand of candidati(st, d, t)) { dec[d][t] = cand; const c = prova(); if (c < migliore - 1e-9) { migliore = c; best = cand; } }
      dec[d][t] = best; }
    // garanzia (minimax): la scelta ottimizzata di oggi resta solo se, sull'orizzonte, è migliore delle regole per OGNI orologio del gruppo
    if (MINIMAX) {
      const perMembro = d => { const L = luce(st, d, tutti); return GRUPPO.map((m, k) => { F = m.F; const c = costo(simula(ys[k], L, i0, i1).min, ideale, g, g + H - 1, m.fase); F = NOM; return c; }); };
      const conRegole = dec.map((x, k) => k >= g && k < g + H ? R[k] : x);
      const a = perMembro(dec), b = perMembro(conRegole);
      if (a.some((c, k) => c > b[k])) dec[g] = R[g];
    }
    const L = luce(st, dec, tutti); ys = GRUPPO.map((m, k) => { F = m.F; const r = simula(ys[k], L, i0, i0 + 1440 / DT).y; F = NOM; return r; });   // si tiene la scelta di oggi, si va a domani
  }
  return dec;
}
// Vigilanza: ritmo (x del modello di Forger: il fondo è il minimo corporeo) meno pressione del sonno (modello a due
// processi di Borbély: sale da svegli con τ 18,2 h, scende dormendo con τ 4,2 h). Soglia: il 10% più basso delle ore da
// sveglio in una giornata regolare. Si contano i minuti di lavoro e dei 30 minuti di rientro sotto soglia.
function vigilanza(y0, L, st, n) {
  let y = y0.slice(), S = 0.3; const A = new Float32Array(n);
  for (let i = 0; i < n; i++) { y = passo(y, L[i]);
    S = st[i] === 0 ? S * Math.exp(-h / 4.2) : 1 - (1 - S) * Math.exp(-h / 18.2);
    A[i] = 0.5 * y[0] - S; }
  return A;
}
const SOGLIA = (() => { const st = new Uint8Array(30 * 1440 / DT), L = new Float32Array(st.length);
  for (let i = 0; i < st.length; i++) { const m = (i * DT) % 1440; st[i] = (m >= 1410 || m < 450) ? 0 : 2; L[i] = luceBase(st[i], i); }
  const A = vigilanza([-0.0843259, -1.09607546, 0.45584306], L, st, st.length), v = [];
  for (let i = 20 * 1440 / DT; i < st.length; i++) if (st[i] !== 0) v.push(A[i]);
  v.sort((a, b) => a - b); return v[Math.floor(v.length * 0.1)]; })();
function minutiBassi(A, st, g0, g1) {
  let n = 0; for (let i = g0 * 1440 / DT; i < g1 * 1440 / DT; i++) {
    const rientro = st[i] === 2 && [1, 2, 3].some(k => i - k >= 0 && st[i - k] === 1);
    if ((st[i] === 1 || rientro) && A[i] < SOGLIA) n += DT; }
  return n / (g1 - g0);   // minuti al giorno
}
const carico = (dec, g0, g1) => { let m = 0; for (let g = g0; g < g1; g++) { const d = dec[g]; if (!d) continue; if (d.c) m += d.c[1] - d.c[0]; if (d.e) m += d.e[1] - d.e[0]; } return m / 60 / (g1 - g0); };
const rnd = (() => { let s = 12345; return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648; })();
const ris = [];
for (const [nome, pattern, turni] of ROT) {
  const P = piani(pattern, turni), st = base(P), ideale = ideali(P);
  const ades = P.map(() => rnd() < ADES);
  const extra = dec => { F = VERA; const n = GIORNI * 1440 / DT, A = vigilanza(libVera.y, luce(st, dec, ades), st, n); F = NOM;
    return { bassi: minutiBassi(A, st, 7, GIORNI - 1), carico: carico(dec, 7, GIORNI - 1) }; };
  const valuta = dec => { F = VERA; const r = simula(libVera.y, luce(st, dec, ades), 0, GIORNI * 1440 / DT); F = NOM; let e = 0, n = 0;
    for (let g = 7; g < GIORNI - 1; g++) { const t = ideale[g]; let b = Infinity; for (const m of r.min) { const v = m + lib.fase; if (Math.abs(v - t) < Math.abs(b - t)) b = v; } e += Math.abs(b - t) / 60; n++; } return e / n; };
  const nulla = P.map(() => ({ c: null, e: null })), R = regole(P);
  const t0 = Date.now();
  const O = process.env.APP === "1" ? R.map((x, g) => { if (g >= GIORNI) return x;
      const d = new Date(INIZIO + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + g);
      const r = calcola({ stato: { pattern, anchor: INIZIO, shifts: turni || SH, repeat: true, freeBed: "23:30", freeWake: "07:30" }, oggi: iso(d) })[0];
      return { c: r.cerca ? [g * 1440 + r.cerca[0], g * 1440 + r.cerca[1]] : null, e: r.evita ? [g * 1440 + r.evita[0], g * 1440 + r.evita[1]] : null }; })
    : ottimizza(P, st, ideale);
  const ms = Date.now() - t0;
  ris.push([nome, valuta(nulla), valuta(R), valuta(O), ms, extra(nulla), extra(R), extra(O)]);
  if (OUT) for (const [k, dec] of [["nulla", nulla], ["regole", R], ["ottimo", O]]) writeFileSync(`${OUT}/${pattern}_${k}.json`, JSON.stringify(Array.from(luce(st, dec, ades)).slice(0, GIORNI * 1440 / DT)));
  if (OUT) writeFileSync(`${OUT}/${pattern}_ideale.json`, JSON.stringify(ideale.slice(0, GIORNI)));
}
console.log(`τ ${TAU} h, adesione ${ADES * 100}% — scarto medio dal minimo ideale (dal 7° giorno)`);
for (const [n, a, b, c, ms, xa, xb, xc] of ris) {
  console.log(`  ${n.padEnd(24)} allineamento: senza ${a.toFixed(2)} · regole ${b.toFixed(2)} · ottimizzatore ${c.toFixed(2)} h  (${(ms / 1000).toFixed(1)} s)`);
  console.log(`  ${"".padEnd(24)} vigilanza bassa al lavoro/rientro: senza ${xa.bassi.toFixed(0)} · regole ${xb.bassi.toFixed(0)} · ottimizzatore ${xc.bassi.toFixed(0)} min/giorno; carico: regole ${xb.carico.toFixed(1)} · ottimizzatore ${xc.carico.toFixed(1)} h/giorno`); }
