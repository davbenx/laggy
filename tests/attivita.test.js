// Le finestre migliori per pensare, muoversi piano e allenarsi: rispettano le regole del buon senso
// (non appena svegli, non a ridosso del sonno, non nel turno né dopo i pasti) e cadono nelle ore giuste.
import test from "node:test";
import assert from "node:assert/strict";
import { finestreAttivita } from "../alertness.js";

const REGOLE = { testa:{ lungo:90, dopoSveglia:90, primaSonno:120 }, leggera:{ lungo:45, dopoSveglia:45, primaSonno:60 }, intensa:{ lungo:60, dopoSveglia:120, primaSonno:180 } };
const hh = m => ((m % 1440) + 1440) % 1440 / 60;

function controlla(inp, f, nome) {
  for (const t of ["testa", "leggera", "intensa"]) {
    const w = f[t]; if (!w) continue; const R = REGOLE[t];
    assert.equal(w.z - w.a, R.lungo, nome + " " + t + ": durata");
    assert.ok(w.a >= inp.wake + R.dopoSveglia, nome + " " + t + ": non appena svegli");
    assert.ok(w.z <= inp.sleepOnset - R.primaSonno, nome + " " + t + ": non a ridosso del sonno");
    for (const x of inp.occupato || []) assert.ok(!(w.a < x[1] && w.z > x[0]), nome + " " + t + ": non nel turno/sonno");
    for (const p of inp.pasti || []) {
      const dopo = p.lt ? 20 : 30;   // minimo dopo un pasto, per ogni tipo
      assert.ok(!(w.a < p.at + dopo && w.z > p.at), nome + " " + t + ": non subito dopo un pasto");
    }
  }
}

test("giornata senza turno: ci sono le tre finestre, nelle ore giuste", () => {
  const inp = { wake: 420, sleepOnset: 1410, freeWake: "07:00", occupato: [], pasti: [{ at: 450, lt: true }, { at: 750, main: true }, { at: 1230, lt: true }] };
  const f = finestreAttivita(inp); controlla(inp, f, "libero");
  assert.ok(f.testa && f.leggera && f.intensa, "tre finestre");
  assert.ok(hh(f.testa.a) >= 9 && hh(f.testa.z) <= 21.5, "testa: mattina avanzata o pomeriggio: " + hh(f.testa.a));
  assert.ok(hh(f.intensa.a) >= 14 && hh(f.intensa.z) <= 20.5, "allenamento: dal pomeriggio a prima di sera: " + hh(f.intensa.a));
});

test("giorno di turno: le finestre stanno fuori dal turno e dal viaggio", () => {
  const inp = { wake: 360, sleepOnset: 1380, freeWake: "07:00", occupato: [[840 - 70, 1320 + 25]], pasti: [{ at: 390, lt: true }, { at: 750, main: true }] };
  const f = finestreAttivita(inp); controlla(inp, f, "turno");
  assert.ok(f.testa && f.testa.z <= 770, "testa prima del turno delle 14");
});

test("dopo una notte, con poco tempo sveglio: nessuna finestra impegnativa, niente di impossibile", () => {
  const inp = { wake: 940, sleepOnset: 1300, freeWake: "07:00", fase: 270, occupato: [], pasti: [] };   // sveglio 15:40, a letto 21:40
  const f = finestreAttivita(inp); controlla(inp, f, "post-notte");
  assert.equal(f.intensa, null, "a 6 ore dal sonno e con 3 ore di margine non c'è posto per un allenamento");
});

test("ingressi sbagliati: niente finestre, niente errori", () => {
  for (const inp of [{}, { wake: NaN, sleepOnset: 100 }, { wake: 500, sleepOnset: 400 }, { wake: 500, sleepOnset: 500 }]) {
    const f = finestreAttivita(inp); assert.deepEqual(f, { testa: null, leggera: null, intensa: null });
  }
});

test("a caso: mai una finestra che rompe le regole (3000 giornate)", () => {
  let seed = 7; const r = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  let con = 0;
  for (let i = 0; i < 3000; i++) {
    const wake = Math.floor(r() * 18) * 60 + Math.floor(r() * 4) * 15, dur = 8 * 60 + Math.floor(r() * 12) * 60;
    const occ = []; if (r() < 0.7) { const a = wake + Math.floor(r() * 12) * 60; occ.push([a, a + 240 + Math.floor(r() * 8) * 60]); }
    if (r() < 0.3) { const a = wake + 300 + Math.floor(r() * 8) * 60; occ.push([a, a + 60]); }
    const pasti = [{ at: wake + 30, lt: true }, { at: wake + 330 + Math.floor(r() * 4) * 30, main: true }, { at: wake + dur - 180, lt: true }];
    const inp = { wake, sleepOnset: wake + dur, freeWake: "07:30", fase: r() < 0.5 ? Math.floor(r() * 1440) : undefined, occupato: occ, pasti };
    const f = finestreAttivita(inp); controlla(inp, f, "caso" + i); if (f.testa || f.intensa || f.leggera) con++;
  }
  assert.ok(con > 1500, "la maggior parte delle giornate ha almeno una finestra: " + con);
});

test("«Quando preferisci»: la fascia scelta vince sul momento migliore, e se non c'è posto vale il migliore", () => {
  const inp = { wake: 420, sleepOnset: 1410, freeWake: "07:00", occupato: [], pasti: [{ at: 450, lt: true }, { at: 750, main: true }, { at: 1230, lt: true }] };
  const auto = finestreAttivita(inp);
  assert.ok(hh(auto.intensa.a) >= 12, "da solo l'allenamento cade nel pomeriggio-sera");
  const mat = finestreAttivita({ ...inp, quando: { intensa: "mattina" } });
  assert.ok(hh(mat.intensa.a) >= 5 && hh(mat.intensa.a) < 12, "con «mattina» comincia in mattinata: " + hh(mat.intensa.a));
  controlla(inp, mat, "mattina");
  assert.deepEqual(mat.testa, auto.testa, "le altre voci non cambiano");
  const sera = finestreAttivita({ ...inp, quando: { leggera: "sera" } });
  assert.ok(hh(sera.leggera.a) >= 18 && hh(sera.leggera.a) < 23, "«sera»");
  const nessuna = finestreAttivita({ wake: 420, sleepOnset: 1410, occupato: [[400, 800]], quando: { intensa: "mattina" } });
  assert.ok(nessuna.intensa && hh(nessuna.intensa.a) >= 13, "mattina occupata: torna al migliore");
});
