// Festivi a riposo per chi ha un orario fisso: il motore chiede alla pagina
// se una data è festiva e, se il tuo contratto lo dice, quel giorno è riposo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "../engine.js";

// lunedì–venerdì mattina (7 giorni, un solo turno), ancorato a lunedì 2026-10-26
const fisso = extra => createEngine({ pattern: "MMMMMRR", anchor: "2026-10-26", focus: "2026-10-26T12:00:00",
  shifts: { M: { n: "Mattino", s: 420, e: 840 } }, ...extra });
const patrono = d => d.getMonth() === 11 && d.getDate() === 7;   // 7 dicembre

test("senza l'opzione i festivi si lavorano come gli altri giorni", () => {
  const e = fisso({}); e.setFestivo(d => d.getMonth() === 9 && d.getDate() === 28);
  assert.equal(e.codeAt(2), "M");   // mercoledì 28 ottobre
});
test("con «nei festivi non lavoro» il festivo è riposo, gli altri giorni no", () => {
  const e = fisso({ festiviRiposo: true }); e.setFestivo(d => d.getMonth() === 9 && d.getDate() === 28);
  assert.equal(e.codeAt(2), "R"); assert.equal(e.block(2).rest, true);
  assert.equal(e.codeAt(1), "M"); assert.equal(e.codeAt(3), "M");
});
test("un'eccezione scritta a mano vince sul festivo", () => {
  const e = fisso({ festiviRiposo: true, ecc: { "2026-10-28": "M" } }); e.setFestivo(d => d.getMonth() === 9 && d.getDate() === 28);
  assert.equal(e.codeAt(2), "M");
});
test("il patrono si ripete ogni anno e la cache segue il cambio di funzione", () => {
  const e = fisso({ festiviRiposo: true }); e.setFestivo(patrono);
  assert.equal(e.codeAt(42), "R");   // lunedì 7 dicembre 2026
  e.setFestivo(() => false);
  assert.equal(e.codeAt(42), "M");
});
test("niente funzione, niente festivi: nessun effetto", () => {
  const e = fisso({ festiviRiposo: true });
  assert.equal(e.codeAt(2), "M");
});

// I festivi nazionali vivono nella pagina (festivoIT in index.html): la funzione si legge da lì, così il test segue il codice vero.
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const corpo = /function festivoIT\(d\)\{[\s\S]*?\n\}\n/.exec(src)[0];
const festivoIT = new Function(corpo + "return festivoIT;")();
test("festivi nazionali: fissi, Pasquetta e il 4 ottobre dal 2026", () => {
  for (const [y, m, g] of [[2026, 1, 1], [2026, 4, 25], [2026, 6, 2], [2026, 12, 26], [2026, 4, 6], [2027, 3, 29]])
    assert.equal(festivoIT(new Date(y, m - 1, g)), true, `${g}/${m}/${y}`);
  assert.equal(festivoIT(new Date(2026, 9, 4)), true);    // San Francesco, legge 151/2025
  assert.equal(festivoIT(new Date(2027, 9, 4)), true);
  assert.equal(festivoIT(new Date(2025, 9, 4)), false);   // prima della legge no
  assert.equal(festivoIT(new Date(2027, 9, 5)), false);
});
