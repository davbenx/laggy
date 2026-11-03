// Nappuccino: un caffè subito prima di un pisolino breve, solo quando è la scelta giusta (pisolino ≤ 30 minuti, caffè
// entro la soglia dell'ultimo caffè, dopo serve essere vigili). Reyner & Horne 1997; Hayashi, Masuda & Hori 2003.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "../engine.js";

const SH = { M: { n: "Mattino", s: 360, e: 840 }, P: { n: "Pomeriggio", s: 840, e: 1320 }, N: { n: "Notte", s: 1320, e: 1800 } };
const beds = {}, wakes = {};
for (let g = 1; g <= 10; g++) { const k = "2026-11-" + String(g).padStart(2, "0"); beds[k] = "01:30"; wakes[k] = "06:30"; }
const piano = (extra) => createEngine({ pattern: "PPPPPRR", anchor: "2026-11-02", shifts: SH, repeat: true, focus: "2026-11-10T12:00:00", beds, wakes, ...extra }).plan();

test("pisolino breve prima del turno, entro la soglia del caffè: nappuccino", () => {
  const P = piano({ pisolini: { "2026-11-10": { skipRecupero: 1 } } }), n = P.naps[0];
  assert.ok(n && n.b - n.a <= 30, "pisolino breve");
  assert.equal(n.caffe, true);
  assert.ok(n.a <= P.cut && P.naps[0].b <= P.b.start, "caffè prima della soglia, pisolino prima del turno");
});

test("pisolino lungo (un ciclo intero): niente caffè, arriverebbe a metà sonno", () => {
  const n = piano({}).naps[0];
  assert.ok(n.b - n.a > 30); assert.ok(!n.caffe);
});

test("pisolino in turno dopo la soglia del caffè: niente caffè, e si dice perché", () => {
  const P = createEngine({ pattern: "NNNNNSR", anchor: "2026-11-02", shifts: SH, repeat: true, focus: "2026-11-04T12:00:00", napTurno: "breve" }).plan();
  const n = P.naps.find(x => x.turno);
  assert.ok(n, "c'è il pisolino in turno"); assert.ok(!n.caffe); assert.equal(n.caffeNo, "soglia");
});

test("con una soglia del caffè più lunga (pillola) lo stesso pisolino resta senza caffè se va oltre", () => {
  const P = piano({ pisolini: { "2026-11-10": { skipRecupero: 1 } }, caffFattori: { pillola: true } }), n = P.naps[0];
  assert.equal(!!n.caffe, n.a <= P.cut, "il nappuccino segue la soglia personale");
});
