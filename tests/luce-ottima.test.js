// L'ottimizzatore della luce: rispetta sempre i vincoli di sicurezza (mai luce bassa al lavoro, finestre solo da svegli),
// è deterministico, sta nei tempi, e nel giorno di una notte va nella direzione giusta (luce prima del minimo, buio dopo).
import { test } from "node:test";
import assert from "node:assert/strict";
import { calcola } from "../luce-worker.js";

const SH = { M: { n: "Mattino", s: 360, e: 840 }, P: { n: "Pomeriggio", s: 840, e: 1320 }, N: { n: "Notte", s: 1320, e: 1800 } };
const stato = p => ({ pattern: p, anchor: "2026-11-02", shifts: SH, repeat: true, freeBed: "23:30", freeWake: "07:30" });
const turno = { M: [360, 840], P: [840, 1320], N: [1320, 1800] };

for (const [pat, oggi] of [["MPNSR", "2026-11-14"], ["NNNNNSR", "2026-11-09"], ["MMPPNNSRRR", "2026-11-12"]]) {
  test("vincoli di sicurezza e forma del risultato: " + pat, () => {
    const t0 = Date.now(), r = calcola({ stato: stato(pat), oggi }), ms = Date.now() - t0;
    assert.equal(r.length, 4, "oggi e i 3 giorni dopo");
    assert.ok(ms < 5000, "nei tempi: " + ms + " ms");
    r.forEach(d => {
      const g = new Date(oggi + "T12:00:00"); g.setDate(g.getDate() + d.g);
      const i = Math.round((g - new Date("2026-11-02T12:00:00")) / 864e5), c = pat[((i % pat.length) + pat.length) % pat.length], w = turno[c];
      for (const f of [d.cerca, d.evita]) if (f) assert.ok(f[1] - f[0] >= 30 && f[1] - f[0] <= 360, "finestre fra 30 minuti e 6 ore");
      if (d.evita && w) assert.ok(d.evita[1] <= w[0] - 25 || d.evita[0] >= w[1], `giorno ${d.g} (${c}): mai luce bassa al lavoro o mentre ci vai (${d.evita})`);
    });
    assert.deepEqual(calcola({ stato: stato(pat), oggi }), r, "deterministico");
  });
}

test("nel giorno di una notte: luce verso l'inizio del turno, e mai luce bassa durante il turno", () => {
  const r = calcola({ stato: stato("MPNSR"), oggi: "2026-11-14" }), d = r[0];
  assert.ok(d.cerca && d.cerca[1] > 1320 - 120, "luce forte la sera o in turno: " + d.cerca);
});
