// luce-ottima.js — le ore della luce scelte da un ottimizzatore, non da regole fisse. Puro: niente DOM, niente rete.
//
// Ogni giorno si scelgono una finestra «cerca luce» e una «evita luce» per i prossimi H giorni, minimizzando insieme
// (1) il disallineamento dell'orologio dai sonni principali (minimo corporeo 2 h prima della sveglia), (2) le ore di
// vigilanza bassa al lavoro e nei 30 minuti di rientro, (3) le ore di consigli (un consiglio pesante non si segue).
// Si tiene la scelta di oggi e domani si ricalcola (orizzonte mobile). Schemi «luce forte o buio» come in Serkh & Forger
// (PLoS Comput Biol 2014); robusto perché ottimizza insieme quattro orologi plausibili: Forger 1999 (τ 24,0 e 24,4) e
// Hannay 2019 (τ 23,64 e 24,04), verificati con la libreria circadian (tools/banco-circadiano). Vincoli fissi: mai
// «evita luce» al lavoro; luce forte vera (3000 lux) solo con il sole e fuori dal lavoro, altrimenti 1000; buio 20 lux.
// Il banco (tools/banco-circadiano/ottimizza.mjs) misura questa stessa logica contro le regole di prima.

export const OTTIMO = { H: 4, dt: 10, pesoVigilanza: 8, pesoCarico: 0.1, passate: 2 };

const FORGER = { taux: 24.2, mu: 0.23, k: 0.55, G: 33.75, a0: 0.05, beta: 0.0075, I0: 9500, p: 0.5 };
const HANNAY = { tau: 23.84, K: 0.06358, gamma: 0.024, Beta1: -0.09318, A1: 0.3855, A2: 0.1977, BetaL1: -0.0026, BetaL2: -0.957756, sigma: 0.0400692, G: 33.75, a0: 0.05, delta: 0.0075, p: 1.5, I0: 9325 };
const MEMBRI = [
  { tipo: "f", par: { ...FORGER, taux: 24.0 }, y0: [-0.0843259, -1.09607546, 0.45584306] },
  { tipo: "f", par: { ...FORGER, taux: 24.4 }, y0: [-0.0843259, -1.09607546, 0.45584306] },
  { tipo: "h", par: { ...HANNAY, tau: 23.64 }, y0: [0.82041911, 1.71383697, 0.52318122] },
  { tipo: "h", par: { ...HANNAY, tau: 24.04 }, y0: [0.82041911, 1.71383697, 0.52318122] }
];

function derF(P, x, xc, n, I) {
  const a = I > 0 ? P.a0 * Math.pow(I / P.I0, P.p) : 0, B = P.G * (1 - n) * a * (1 - 0.4 * x) * (1 - 0.4 * xc), w = Math.PI / 12;
  return [w * (xc + B), w * (P.mu * (xc - 4 * xc * xc * xc / 3) - x * ((24 / (0.99669 * P.taux)) ** 2 + P.k * B)), 60 * (a * (1 - n) - P.beta * n)];
}
function derH(P, R, Psi, n, I) {
  const Ip = I > 0 ? Math.pow(I, P.p) : 0, a = P.a0 * Ip / (Ip + P.I0), B = P.G * (1 - n) * a, R4 = R * R * R * R, R8 = R4 * R4;
  const amp = P.A1 * 0.5 * B * (1 - R4) * Math.cos(Psi + P.BetaL1) + P.A2 * 0.5 * B * R * (1 - R8) * Math.cos(2 * Psi + P.BetaL2);
  const fa = P.sigma * B - P.A1 * B * 0.5 * (R * R * R + 1 / R) * Math.sin(Psi + P.BetaL1) - P.A2 * B * 0.5 * (1 + R8) * Math.sin(2 * Psi + P.BetaL2);
  return [-P.gamma * R + P.K * Math.cos(P.Beta1) / 2 * R * (1 - R4) + amp, 2 * Math.PI / P.tau + P.K / 2 * Math.sin(P.Beta1) * (1 + R4) + fa, 60 * (a * (1 - n) - P.delta * n)];
}
function passo(m, y, I, h) {
  const D = m.tipo === "h" ? (a, b, c) => derH(m.par, a, b, c, I) : (a, b, c) => derF(m.par, a, b, c, I);
  const k1 = D(y[0], y[1], y[2]), k2 = D(y[0] + h / 2 * k1[0], y[1] + h / 2 * k1[1], y[2] + h / 2 * k1[2]);
  const k3 = D(y[0] + h / 2 * k2[0], y[1] + h / 2 * k2[1], y[2] + h / 2 * k2[2]), k4 = D(y[0] + h * k3[0], y[1] + h * k3[1], y[2] + h * k3[2]);
  return [y[0] + h / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]), y[1] + h / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]), y[2] + h / 6 * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2])];
}
const segno = (m, y) => m.tipo === "h" ? Math.cos(y[1]) : y[0];

// Le regole di prima (scheda «Luce» di index.html): punto di partenza dell'ottimizzazione e riserva se qualcosa va storto.
export function regoleLuce(P) {
  const s = P.s, b = P.b;
  if (P.night) { const f = s.strategy === "contieni" ? b.end : Math.min(P.cbt - 120, b.end); return { c: [b.start, f], e: [f, Math.max(s.onset, b.end)] }; }
  if (P.shift < -20) return { c: [P.wake, P.wake + 180], e: [s.onset - 120, s.onset] };
  return { c: [P.wake, P.wake + 120], e: [s.onset - 120, s.onset] };
}

// giorni: [{P, alba, tramonto}] dal giorno -prima al giorno H-1 compreso (P = piano del motore di quel giorno, minuti dalla
// sua mezzanotte); oggi = indice del giorno di oggi in giorni; libero = {inizio, fine} del sonno libero (minuti), con
// alba/tramonto del mese per calibrare. Restituisce le finestre dei giorni da oggi a oggi+H-1 (minuti dalla loro mezzanotte).
export function ottimizzaLuce({ giorni, oggi, libero, alba, tramonto, andata = 25 }, opz = {}) {
  const O = { ...OTTIMO, ...opz }, DT = O.dt, h = DT / 60, PG = 1440 / DT, N = giorni.length * PG;
  // stato del giorno minuto per minuto (a passi di DT): 0 dorme, 1 al lavoro, 2 sveglio; in minuti assoluti dal giorno 0.
  // «via» segna il tragitto verso il lavoro: si guida, quindi mai luce bassa lì (come al lavoro)
  const st = new Uint8Array(N).fill(2), sole = new Uint8Array(N), via = new Uint8Array(N);
  giorni.forEach(({ P, alba: a, tramonto: t }, g) => {
    for (let i = 0; i < PG; i++) { const m = i * DT; sole[g * PG + i] = m >= a && m < t ? 1 : 0; }
    if (P.b && !P.b.rest) { for (let m = P.b.start; m < P.b.end; m += DT) { const i = g * PG + Math.floor(m / DT); if (i >= 0 && i < N) st[i] = 1; }
      for (let m = P.b.start - andata; m < P.b.start; m += DT) { const i = g * PG + Math.floor(m / DT); if (i >= 0 && i < N) via[i] = 1; } }
  });
  giorni.forEach(({ P }, g) => { for (const z of (P.sleeps || []).concat(P.naps || [])) for (let m = z.a; m < z.b; m += DT) { const i = g * PG + Math.floor(m / DT); if (i >= 0 && i < N) st[i] = 0; } });
  const base = new Float32Array(N); for (let i = 0; i < N; i++) base[i] = st[i] === 0 ? 0 : st[i] === 1 ? 300 : sole[i] ? 600 : 150;
  // pressione del sonno (Borbély): dipende solo da sonno e veglia, si calcola una volta
  const S = new Float32Array(N); { let v = 0.3; for (let i = 0; i < N; i++) { v = st[i] === 0 ? v * Math.exp(-h / 4.2) : 1 - (1 - v) * Math.exp(-h / 18.2); S[i] = v; } }
  const ideale = giorni.map(({ P }, g) => g * 1440 + P.s.onset + P.s.dur - 120);
  // i quattro orologi: orario libero ripetuto (30 giorni), poi i giorni passati senza consigli; calibrazione sul minimo libero
  const membri = MEMBRI.map(m => {
    let y = m.y0.slice(), p = null, p2 = null; const mins = [];
    for (let d = 0; d < 30; d++) for (let i = 0; i < PG; i++) { const t = i * DT, dorme = ((t - libero.inizio) % 1440 + 1440) % 1440 < ((libero.fine - libero.inizio) % 1440 + 1440) % 1440;
      y = passo(m, y, dorme ? 0 : t >= alba && t < tramonto ? 600 : 150, h); const x = segno(m, y);
      if (d >= 22 && p2 !== null && p < p2 && p <= x) mins.push(((t - DT) % 1440 + 1440) % 1440); p2 = p; p = x; }
    const ang = mins.map(v => v / 1440 * 2 * Math.PI), xm = ((Math.atan2(ang.reduce((s, v) => s + Math.sin(v), 0), ang.reduce((s, v) => s + Math.cos(v), 0)) / (2 * Math.PI) * 1440) % 1440 + 1440) % 1440;
    let fase = ((libero.fine - 120) % 1440 + 1440) % 1440 - xm; while (fase > 720) fase -= 1440; while (fase < -720) fase += 1440;
    for (let i = 0; i < oggi * PG; i++) y = passo(m, y, base[i], h);   // i giorni passati: luce senza consigli
    return { ...m, y, fase };
  });
  // soglia della vigilanza bassa: il 10% più basso delle ore da sveglio in una giornata libera (orologio di Forger medio)
  const soglia = (() => { const m = { tipo: "f", par: FORGER }; let y = MEMBRI[0].y0.slice(), v = 0.3; const A = [];
    for (let d = 0; d < 25; d++) for (let i = 0; i < PG; i++) { const t = i * DT, dorme = ((t - libero.inizio) % 1440 + 1440) % 1440 < ((libero.fine - libero.inizio) % 1440 + 1440) % 1440;
      y = passo(m, y, dorme ? 0 : t >= alba && t < tramonto ? 600 : 150, h); v = dorme ? v * Math.exp(-h / 4.2) : 1 - (1 - v) * Math.exp(-h / 18.2); if (d >= 20 && !dorme) A.push(0.5 * y[0] - v); }
    A.sort((a, b) => a - b); return A[Math.floor(A.length * 0.1)]; })();

  const luce = dec => { const L = Float32Array.from(base);
    dec.forEach((d, g) => { if (!d) return; const o = g * 1440;
      if (d.c) for (let m = d.c[0]; m < d.c[1]; m += DT) { const i = Math.floor((o + m) / DT); if (i >= 0 && i < N && st[i] !== 0) L[i] = st[i] === 1 || !sole[i] ? 1000 : 3000; }
      if (d.e) for (let m = d.e[0]; m < d.e[1]; m += DT) { const i = Math.floor((o + m) / DT); if (i >= 0 && i < N && st[i] === 2 && !via[i]) L[i] = 20; } });
    return L; };
  const g0 = oggi, g1 = Math.min(giorni.length, oggi + O.H), i0 = g0 * PG, i1 = g1 * PG;
  const costo = dec => {
    const L = luce(dec); let c = 0;
    for (const m of membri) {
      let y = m.y.slice(), p = null, p2 = null, bassi = 0; const mins = [];
      for (let i = i0; i < i1; i++) { y = passo(m, y, L[i], h); const x = segno(m, y);
        if (m.tipo === "f" && (st[i] === 1 || (st[i] === 2 && i >= 3 && (st[i - 1] === 1 || st[i - 2] === 1 || st[i - 3] === 1))) && 0.5 * y[0] - S[i] < soglia) bassi += h;
        if (p2 !== null && p < p2 && p <= x) { const d = p2 - 2 * p + x, v = d > 0 ? 0.5 * (p2 - x) / d : 0; mins.push((i - 1 + v) * DT + DT + m.fase); }
        p2 = p; p = x; }
      for (let g = g0; g < g1 - 1; g++) { const t = ideale[g]; let b = Infinity; for (const v of mins) if (Math.abs(v - t) < Math.abs(b - t)) b = v; if (isFinite(b)) c += ((b - t) / 60) ** 2; }
      c += O.pesoVigilanza * bassi;
    }
    let ore = 0; for (let g = g0; g < g1; g++) { const d = dec[g]; if (d && d.c) ore += (d.c[1] - d.c[0]) / 60; if (d && d.e) ore += (d.e[1] - d.e[0]) / 60; }
    return c + O.pesoCarico * membri.length * ore;
  };
  const candidati = (g, tipo) => { const out = [null], lens = tipo === "c" ? [60, 120, 180, 240] : [60, 120, 180];
    for (let a = 0; a < 1440 + 360; a += 60) { const i = g * PG + Math.floor(a / DT); if (i >= N || st[i] === 0 || (tipo === "e" && st[i] === 1)) continue;
      for (const l of lens) { if (tipo === "e") { let tocca = false; for (let m = a; m < a + l; m += DT) { const j = g * PG + Math.floor(m / DT); if (j < N && (st[j] === 1 || via[j])) { tocca = true; break; } } if (tocca) continue; } out.push([a, a + l]); } }
    return out; };
  const dec = giorni.map(({ P }) => ({ ...regoleLuce(P) }));
  let migliore = costo(dec);
  for (let pass = 0; pass < O.passate; pass++) for (let g = g0; g < g1; g++) for (const t of ["c", "e"]) {
    let best = dec[g][t];
    for (const cand of candidati(g, t)) { dec[g][t] = cand; const c = costo(dec); if (c < migliore - 1e-9) { migliore = c; best = cand; } }
    dec[g][t] = best;
  }
  // da mostrare: solo le ore da sveglio (il tratto più lungo, se la finestra attraversa un sonno), a passi di 5 minuti
  const sveglio = (g, w) => { if (!w) return null; let best = null, a = null;
    for (let m = w[0]; m <= w[1]; m += DT) { const i = g * PG + Math.floor(m / DT), ok = m < w[1] && i >= 0 && i < N && st[i] !== 0;
      if (ok && a === null) a = m; if (!ok && a !== null) { if (!best || m - a > best[1] - best[0]) best = [a, m]; a = null; } }
    return best && best[1] - best[0] >= 30 ? best : null; };
  // le regole di partenza possono toccare il tragitto: la luce bassa da mostrare non lo tocca mai
  const senzaVia = (g, w) => { if (!w) return null; let best = null, a = null;
    for (let m = w[0]; m <= w[1]; m += DT) { const i = g * PG + Math.floor(m / DT), ok = m < w[1] && i >= 0 && i < N && !via[i] && st[i] !== 1;
      if (ok && a === null) a = m; if (!ok && a !== null) { if (!best || m - a > best[1] - best[0]) best = [a, m]; a = null; } }
    return best && best[1] - best[0] >= 30 ? best : null; };
  return dec.slice(g0, g1).map((d, k) => ({ g: g0 + k - oggi, cerca: sveglio(g0 + k, d.c), evita: sveglio(g0 + k, senzaVia(g0 + k, d.e)) }));
}
