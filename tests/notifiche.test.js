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
    try { const P = e.plan(); const m = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); sonni.push([m + P.s.onset * 6e4, m + (P.s.onset + P.s.dur) * 6e4]); } catch (_) {} }
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
