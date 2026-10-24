// Regole delle notifiche: pochi avvisi, mai nel sonno, cambi annunciati una volta.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSchedule, TIPI, TIPI_ESSENZIALI, TIPI_TUTTI } from "../notifications.js";
import { createEngine } from "../engine.js";

const iso = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const SH = { M: { n: "Mattino", s: 360, e: 840 }, P: { n: "Pomeriggio", s: 840, e: 1320 }, N: { n: "Notte", s: 1320, e: 1860 } };
const giorno = d => iso(d);

test("catalogo: ogni tipo ha nome, descrizione e canale; essenziali ⊂ tutti", () => {
  for (const t of TIPI) assert.ok(t.k && t.nome && t.desc && t.canale, t.k);
  assert.ok(TIPI_ESSENZIALI.every(k => TIPI_TUTTI.includes(k)));
  assert.ok(!TIPI_ESSENZIALI.includes("wake"), "'Ora di alzarti' non è una sveglia: spenta di default");
});

test("al massimo 4 notifiche al giorno, anche con tutti i tipi accesi", () => {
  for (const pattern of ["MPNSR", "MMMMMRRPPPPPRRNNNNNRR", "NNNRR", "MMPPNNRRRR"]) {
    const L = buildSchedule({ pattern, anchor: iso(new Date()), shifts: SH, napTurno: "pausa" }, { days: 21, types: TIPI_TUTTI });
    const per = {}; L.forEach(n => { const k = giorno(n.at); per[k] = (per[k] || 0) + 1; });
    assert.ok(Object.values(per).every(n => n <= 4), pattern + " " + JSON.stringify(per));
    assert.equal(new Set(L.map(n => n.id)).size, L.length, "id unici");
  }
});

test("niente notifiche dentro il sonno pianificato (tranne 'ora di alzarti')", () => {
  const cfg = { pattern: "MPNSR", anchor: iso(new Date()), shifts: SH };
  const L = buildSchedule(cfg, { days: 14, types: TIPI_TUTTI });
  const e = createEngine(cfg); const sonni = [];
  for (let o = -1; o < 15; o++) { const d = new Date(); d.setDate(d.getDate() + o); e.state.focus = d;
    // ore di calendario, non millisecondi: nei giorni del cambio d'ora (23 o 25 ore) la somma sbaglia di un'ora
    const at = min => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, min).getTime();
    try { const P = e.plan(); sonni.push([at(P.s.onset), at(P.s.onset + P.s.dur)]); } catch (_) {} }
  const dentro = L.filter(n => n.kind !== "wake" && sonni.some(([a, z]) => +n.at > a + 6e4 && +n.at < z - 6e4));
  assert.deepEqual(dentro.map(n => n.title + " " + n.at), []);
});

test("'a letto presto' solo la prima sera di un blocco di mattine, non tutte le sere", () => {
  const oggi = new Date();
  const L = buildSchedule({ pattern: "RRMMMMMRR", anchor: iso(oggi), shifts: SH }, { days: 9, types: ["cambio"] });
  const presto = L.filter(n => n.title === "Stasera a letto presto");
  assert.ok(presto.length <= 1, presto.map(n => n.at).join(", "));
});

test("turni variabili: l'ultimo giorno segnato chiede quello dopo, una volta", () => {
  const oggi = new Date(); const dom = new Date(oggi); dom.setDate(dom.getDate() + 1);
  const cfg = { pattern: "M", anchor: iso(oggi), repeat: false, shifts: SH, ecc: { [iso(oggi)]: "M", [iso(dom)]: "P" } };
  const L = buildSchedule(cfg, { days: 7, types: TIPI_ESSENZIALI }).filter(n => n.kind === "domani");
  assert.equal(L.length, 1);
  assert.equal(giorno(L[0].at), iso(dom), "la sera di domani, che è l'ultimo giorno segnato");
  assert.equal(L[0].extra.tab, "domani");
});

test("giorni impegnativi: dalla terza notte di fila, e prima di un rientro con meno di 11 ore", () => {
  const domani = new Date(); domani.setDate(domani.getDate() + 1);
  const notti = buildSchedule({ pattern: "NNNNRRR", anchor: iso(domani), shifts: SH }, { days: 7, types: TIPI_ESSENZIALI });
  const r = notti.filter(n => n.kind === "rischio");
  assert.equal(r.length, 2, "terza e quarta notte: " + r.map(n => n.body).join(" | "));
  assert.ok(/Terza notte di fila/.test(r[0].body) && /Quarta notte di fila/.test(r[1].body));
  assert.ok(r.every(n => /Inizio alle 22:00/.test(n.body) && n.at.getHours() < 22), "prima del turno, mai durante");
  const SH2 = { P: { n: "Pomeriggio", s: 840, e: 1260 }, Q: { n: "Presto", s: 360, e: 780 } };
  const rr = buildSchedule({ pattern: "PQRRRRR", anchor: iso(domani), shifts: SH2 }, { days: 7, types: TIPI_ESSENZIALI }).filter(n => n.kind === "rischio");
  assert.equal(rr.length, 1); const min = rr[0].at.getHours() * 60 + rr[0].at.getMinutes();
  assert.ok(/9 ore dopo/.test(rr[0].body) && min >= 840 && min < 1260, "durante il turno di ieri, prima della fine: " + rr[0].body + " " + rr[0].at);
  const normale = buildSchedule({ pattern: "MPNSR", anchor: iso(domani), shifts: SH }, { days: 10, types: TIPI_ESSENZIALI });
  assert.equal(normale.filter(n => n.kind === "rischio").length, 0, "un ciclo normale non ha avvisi in più");
  assert.ok(new Set(notti.map(n => n.id)).size === notti.length, "id unici");
});

test("rientro dopo la notte: 10 minuti prima della fine del turno", () => {
  const domani = new Date(); domani.setDate(domani.getDate() + 1);
  const L = buildSchedule({ pattern: "NRRRRRR", anchor: iso(domani), shifts: SH }, { days: 7, types: TIPI_ESSENZIALI });
  const ret = L.find(n => n.kind === "ret");
  assert.ok(ret && ret.at.getHours() === 6 && ret.at.getMinutes() === 50, String(ret && ret.at));
});

test("cambio dell'ora: notifiche e testi all'ora giusta anche nei giorni di 23 e 25 ore", () => {
  const tzPrima = process.env.TZ; process.env.TZ = "Europe/Rome";
  try {
    // Il prossimo cambio d'ora (ultima domenica di marzo o di ottobre) almeno fra due giorni.
    const ultimaDomenica = (y, m) => { const d = new Date(y, m + 1, 0, 12); d.setDate(d.getDate() - d.getDay()); return d; };
    const limite = Date.now() + 2 * 864e5;
    let cambio = null;
    for (let y = new Date().getFullYear(); !cambio; y++) for (const m of [2, 9]) { const d = ultimaDomenica(y, m); if (!cambio && d.getTime() > limite) cambio = d; }
    const vigilia = new Date(cambio); vigilia.setDate(vigilia.getDate() - 1);
    const L = buildSchedule({ pattern: "NNNNNNN", anchor: iso(vigilia), shifts: SH, focus: vigilia }, { days: 3, types: TIPI_ESSENZIALI });
    // Notte 22:00 → 07:00: il rientro alle 06:50 ogni mattina, anche quella del cambio
    const ret = L.filter(n => n.kind === "ret");
    assert.ok(ret.length >= 2 && ret.every(n => n.at.getHours() === 6 && n.at.getMinutes() === 50), ret.map(n => n.at.toString()).join(" | "));
    assert.ok(L.filter(n => /Inizio alle/.test(n.body)).every(n => /Inizio alle 22:00/.test(n.body)), "i testi dicono l'ora vera del turno");
  } finally { if (tzPrima === undefined) delete process.env.TZ; else process.env.TZ = tzPrima; }
});

test("momenti buoni: solo per le finestre accese nel piano, al loro inizio, mai nel sonno", () => {
  const cfg = { pattern: "MPNSR", anchor: iso(new Date()), shifts: SH, piano: { intensa: true, testa: true } };
  const L = buildSchedule(cfg, { days: 14, types: ["momenti"] });
  assert.ok(L.length > 0, "ce ne sono");
  assert.ok(L.every(n => n.kind === "momenti"), "solo il tipo acceso");
  assert.ok(L.every(n => /Buon momento per (pensare|allenarti)/.test(n.title)), "solo testa e allenamento, non il movimento");
  assert.equal(new Set(L.map(n => n.id)).size, L.length, "id unici");
  assert.ok(L.every(n => n.id >= 970000 && n.id < 980000), "nella loro fascia di id");
  const e = createEngine(cfg); const sonni = [];
  for (let o = -1; o < 15; o++) { const d = new Date(); d.setDate(d.getDate() + o); e.state.focus = d; let P = null; if (e.codeAt(0) !== "?") { try { P = e.plan(); } catch (_) {} }
    if (P) { const m = new Date(d.getFullYear(), d.getMonth(), d.getDate()); sonni.push([new Date(m.getFullYear(), m.getMonth(), m.getDate(), 0, P.s.onset).getTime(), new Date(m.getFullYear(), m.getMonth(), m.getDate(), 0, P.s.onset + P.s.dur).getTime()]); } }
  for (const n of L) assert.ok(!sonni.some(([a, z]) => n.at.getTime() > a + 60000 && n.at.getTime() < z - 60000), "dentro il sonno: " + n.at);
});

test("momenti buoni: senza interruttore nel piano non parte nulla, anche con il tipo acceso", () => {
  const base = { pattern: "MPNSR", anchor: iso(new Date()), shifts: SH };
  assert.equal(buildSchedule(base, { days: 14, types: ["momenti"] }).length, 0, "nessun piano");
  assert.equal(buildSchedule({ ...base, piano: { testa: false, intensa: false } }, { days: 14, types: ["momenti"] }).length, 0, "tutti spenti");
  assert.equal(buildSchedule({ ...base, piano: { testa: true } }, { days: 14, types: ["cambio"] }).filter(n => n.kind === "momenti").length, 0, "tipo spento");
  assert.ok(!TIPI_ESSENZIALI.includes("momenti"), "non è fra gli essenziali");
});
