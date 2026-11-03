// Il calendario del ciclo a mese (calendario.js, le stesse regole di CalendarioModel.java nel widget).
import { test } from "node:test";
import assert from "node:assert/strict";
import { dataDi, indiceDi, meseSpostato, righeMese, meseIntero, primaRigaMese, titoloMese } from "../calendario.js";

const DA = "2026-09-21", GIORNI = 140, SETT = 20;   // 20 settimane da lunedì 21 settembre, come le pubblica la pagina

test("date e posizioni nei dati", () => {
  assert.deepEqual(dataDi(DA, 0), { anno: 2026, mese: 9, giorno: 21, iso: "2026-09-21" });
  assert.equal(dataDi(DA, 41).iso, "2026-11-01");
  assert.equal(indiceDi(DA, GIORNI, "2026-11-01"), 41);
  assert.equal(indiceDi(DA, GIORNI, "2026-09-20"), -1, "prima dei dati");
});
test("mese spostato, anche fra un anno e l'altro", () => {
  assert.deepEqual(meseSpostato(2026, 11, 0), [2026, 11]);
  assert.deepEqual(meseSpostato(2026, 11, 2), [2027, 1]);
  assert.deepEqual(meseSpostato(2026, 1, -1), [2025, 12]);
  assert.deepEqual(meseSpostato(2026, 11, -14), [2025, 9]);
});
test("le settimane di un mese: dalla settimana del 1° a quella dell'ultimo", () => {
  assert.deepEqual(righeMese(DA, GIORNI, 2026, 11), [5, 10], "novembre 2026: dal lunedì 26 ottobre al lunedì 30 novembre (6 righe)");
  assert.deepEqual(righeMese(DA, GIORNI, 2026, 12), [10, 14]);
  assert.deepEqual(righeMese(DA, GIORNI, 2026, 9), [0, 1], "settembre comincia prima dei dati: dalla prima riga");
  assert.equal(righeMese(DA, GIORNI, 2027, 6), null, "fuori dai dati");
});
test("prima riga: il mese intero se entra, altrimenti dalla settimana di oggi (solo nel mese di oggi)", () => {
  const nov = righeMese(DA, GIORNI, 2026, 11), oggi = 7;   // martedì 10 novembre
  assert.equal(primaRigaMese(nov, oggi, true, 6, SETT), 5, "6 righe: novembre intero");
  assert.equal(primaRigaMese(nov, oggi, true, 3, SETT), 7, "3 righe: dalla settimana di oggi");
  assert.equal(primaRigaMese(nov, 10, true, 3, SETT), 8, "a fine mese: le ultime 3 settimane, non oltre");
  assert.equal(primaRigaMese(nov, oggi, false, 3, SETT), 5, "un altro mese: dal giorno 1");
  assert.equal(primaRigaMese([18, 19], -1, false, 6, SETT), 14, "in fondo ai dati non si esce");
});
test("titolo del mese", () => {
  assert.equal(titoloMese(2026, 11, 2026), "Novembre");
  assert.equal(titoloMese(2027, 1, 2026), "Gennaio 2027");
});

test("‹ › solo sui mesi interi: un mese a metà nei dati non si raggiunge", () => {
  // 140 giorni da lunedì 21 settembre 2026: fino a domenica 7 febbraio 2027
  assert.equal(meseIntero(DA, GIORNI, 2026, 10), true, "ottobre è tutto dentro");
  assert.equal(meseIntero(DA, GIORNI, 2026, 9), false, "settembre comincia prima dei dati");
  assert.equal(meseIntero(DA, GIORNI, 2027, 2), false, "febbraio 2027 finisce dopo i dati");
  assert.equal(meseIntero(DA, GIORNI, 2027, 6), false, "fuori dai dati");
});
