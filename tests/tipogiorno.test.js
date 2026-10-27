// tipoDelGiorno (il calendario del widget lo chiama per centinaia di giorni) classifica riposo, notte o lavoro dal solo blocco
// del giorno. «Riposo» deve coincidere col piano completo; «notte» è la regola delle tre ore fra le 22 e le 6 (eNotte), la stessa
// del conteggio delle notti nel Carico, e NON la notte circadiana del piano (spansNight), che dipende dagli orari di sonno.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "../engine.js";

const ore = b => { const ov = (a, z) => Math.max(0, Math.min(b.end, z) - Math.max(b.start, a)); return ov(-120, 360) + ov(1320, 1800); };

test("tipoDelGiorno coincide con il piano completo, su cicli e giorni speciali diversi", () => {
  const giorni = { "2026-10-21": { t: "ferie" }, "2026-10-23": { t: "formazione" }, "2026-10-26": { s: 1320, e: 1800 }, "2026-10-28": { t: "malattia" } };
  let visti = { r: 0, n: 0, l: 0 };
  for (const pattern of ["MPNSR", "NNRR", "MMNNRRR", "PPRR", "R"]) for (const g of [{}, giorni]) {
    const e = createEngine({ pattern, anchor: "2026-10-19", focus: "2026-10-19T12:00:00", giorni: g });
    for (let o = -3; o < 40; o++) {
      const d = new Date(2026, 9, 19 + o, 12, 0); e.state.focus = d;
      const t = e.tipoDelGiorno(0);
      const b = e.block(0), atteso = b.rest ? "r" : ore(b) >= 180 ? "n" : "l", P = e.plan();
      assert.equal(t, atteso, pattern + " " + d.toDateString() + (g === giorni ? " (con giorni speciali)" : ""));
      assert.equal(t === "r", P.b.rest, "riposo: come il piano completo");
      visti[t]++;
    }
  }
  assert.ok(visti.r > 0 && visti.n > 0 && visti.l > 0, "il test deve incontrare tutti e tre i tipi: " + JSON.stringify(visti));
});

test("un turno corto di notte (22:00-02:15) è una notte, anche se non tocca il minimo corporeo", () => {
  // con letto alle 00:30 il minimo corporeo cade tardi: per il piano del sonno quel turno non «attraversa la notte»,
  // ma sono 4h15 di lavoro fra le 22 e le 6 e per i colori e i conti è una notte (era arancione nel widget)
  const e = createEngine({ pattern: "N", anchor: "2026-10-19", focus: "2026-10-19T12:00:00", repeat: true, freeBed: "00:30", freeWake: "08:30", shifts: { N: { n: "Notte", s: 1320, e: 1575 } } });
  assert.equal(e.tipoDelGiorno(0), "n");
  assert.equal(e.oreNotturne(e.block(0)), 255);
  assert.equal(e.plan().night, false, "la notte circadiana del piano resta un'altra cosa");
  const l = createEngine({ pattern: "M", anchor: "2026-10-19", focus: "2026-10-19T12:00:00", repeat: true, shifts: { M: { n: "Mattino", s: 420, e: 840 } } });
  assert.equal(l.tipoDelGiorno(0), "l"); assert.equal(l.oreNotturne(l.block(0)), 0);
});

test("fasciaDelGiorno: mattina, pomeriggio, sera, notte e riposo, dall'orario in cui comincia il turno", () => {
  const e = createEngine({ pattern: "MPSNR", anchor: "2026-10-19", focus: "2026-10-19T12:00:00", repeat: true,
    shifts: { M: { n: "Mattina", s: 360, e: 840 }, P: { n: "Pomeriggio", s: 840, e: 1320 }, S: { n: "Sera", s: 1080, e: 1380 }, N: { n: "Notte", s: 1320, e: 1800 } } });
  const f = o => { e.state.focus = new Date(2026, 9, 19 + o, 12, 0); return e.fasciaDelGiorno(0); };
  assert.deepEqual([0, 1, 2, 3, 4].map(f), ["m", "p", "s", "n", "r"]);
  // un turno 7-19 è di mattina, uno 19-07 di notte: vale per qualunque ciclo
  const lungo = createEngine({ pattern: "DN", anchor: "2026-10-19", focus: "2026-10-19T12:00:00", repeat: true, shifts: { D: { n: "Giorno", s: 420, e: 1140 }, N: { n: "Notte", s: 1140, e: 1860 } } });
  assert.equal(lungo.fasciaDelGiorno(0), "m"); assert.equal(lungo.fasciaDelGiorno(1), "n");
});
