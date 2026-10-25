// tipoDelGiorno (il calendario del widget lo chiama per centinaia di giorni) deve dire quello che dice il piano
// completo: riposo, notte o lavoro. Se un giorno il piano cambiasse il suo criterio, questo test lo segnala.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "../engine.js";

const dalPiano = P => P.b.rest ? "r" : P.night ? "n" : "l";

test("tipoDelGiorno coincide con il piano completo, su cicli e giorni speciali diversi", () => {
  const giorni = { "2026-10-21": { t: "ferie" }, "2026-10-23": { t: "formazione" }, "2026-10-26": { s: 1320, e: 1800 }, "2026-10-28": { t: "malattia" } };
  let visti = { r: 0, n: 0, l: 0 };
  for (const pattern of ["MPNSR", "NNRR", "MMNNRRR", "PPRR", "R"]) for (const g of [{}, giorni]) {
    const e = createEngine({ pattern, anchor: "2026-10-19", focus: "2026-10-19T12:00:00", giorni: g });
    for (let o = -3; o < 40; o++) {
      const d = new Date(2026, 9, 19 + o, 12, 0); e.state.focus = d;
      const t = e.tipoDelGiorno(0);
      assert.equal(t, dalPiano(e.plan()), pattern + " " + d.toDateString() + (g === giorni ? " (con giorni speciali)" : ""));
      visti[t]++;
    }
  }
  assert.ok(visti.r > 0 && visti.n > 0 && visti.l > 0, "il test deve incontrare tutti e tre i tipi: " + JSON.stringify(visti));
});
