// Il calendario del ciclo ha le stesse regole del widget Android: stessi casi di CalendarioModelTest.java
// (20 settimane da lunedì 21 settembre 2026: riga 4 = 19 ottobre = oggi, 6 = 2 novembre, 10 = 30 novembre, 15 = 4 gennaio).
import { test } from "node:test";
import assert from "node:assert/strict";
import { dataDi, indiceDi, meseDellaRiga, titolo, inizioMese, primaRiga, paginaDopo } from "../calendario.js";

const DA = "2026-09-21", SETT = 20;

test("date e giorni: il cambio d'ora non sposta il giorno", () => {
  assert.deepEqual(dataDi("2026-10-19", 0), { anno: 2026, mese: 10, giorno: 19, iso: "2026-10-19" });
  assert.equal(dataDi("2026-10-19", 7).iso, "2026-10-26", "dopo il cambio d'ora del 25");
  assert.equal(dataDi("2026-10-19", 13).iso, "2026-11-01", "cambio di mese");
  assert.equal(dataDi("2026-12-28", 4).iso, "2027-01-01", "cambio d'anno");
  assert.equal(indiceDi("2026-10-19", 42, "2026-10-24"), 5);
  assert.equal(indiceDi("2026-10-19", 42, "2026-10-25"), 6);
  assert.equal(indiceDi("2026-10-19", 42, "2026-10-18"), -1);
  assert.equal(indiceDi("2026-10-19", 42, "2027-01-01"), -1);
});

test("titolo e inizio dei mesi: ogni settimana è del mese del suo giovedì", () => {
  for (const r of [1, 6, 10, 15, 19]) assert.ok(inizioMese(DA, r), "riga " + r);
  for (const r of [0, 2, 3, 4, 5, 7, 8, 9, 11, 12, 13, 14, 16, 17, 18]) assert.ok(!inizioMese(DA, r), "riga " + r);
  assert.equal(titolo(DA, 4, 2026), "Ottobre");
  assert.equal(titolo(DA, 5, 2026), "Ottobre", "26 ott – 1 nov: il giovedì è il 29");
  assert.equal(titolo(DA, 8, 2026), "Novembre");
  assert.equal(titolo(DA, 10, 2026), "Dicembre", "30 nov – 6 dic: il giovedì è il 3");
  assert.equal(titolo(DA, 14, 2026), "Dicembre", "28 dic – 3 gen: il giovedì è il 31");
  assert.equal(titolo(DA, 15, 2026), "Gennaio 2027", "un altro anno lo dice");
  assert.deepEqual(meseDellaRiga(DA, 1), [2026, 10]);
});

test("prima riga ferma ai bordi dei dati", () => {
  const oggi = 4, righe = 4;
  assert.equal(primaRiga(oggi, 0, righe, SETT), 4);
  assert.equal(primaRiga(oggi, -2, righe, SETT), 2);
  assert.equal(primaRiga(oggi, -9, righe, SETT), 0, "non prima dei dati");
  assert.equal(primaRiga(oggi, 99, righe, SETT), 16, "l'ultima pagina piena");
  assert.equal(primaRiga(-1, 0, righe, SETT), 0, "dati che non contengono oggi: dalla prima");
  assert.equal(primaRiga(0, 3, 5, 3), 0, "pochi dati: mai negativa");
});

test("le frecce si agganciano al mese o fanno una pagina", () => {
  const oggi = 4, righe = 4, vai = (sp, v) => paginaDopo(DA, SETT, oggi, sp, righe, v), riga = sp => primaRiga(oggi, sp, righe, SETT);
  let sp = 0;
  sp = vai(sp, 1); assert.equal(riga(sp), 6, "novembre è a 2 righe: ci si aggancia");
  sp = vai(sp, 1); assert.equal(riga(sp), 10, "dicembre è a 4 righe: una pagina intera");
  sp = vai(sp, 1); assert.equal(riga(sp), 14, "gennaio è a 5 righe: pagina intera");
  sp = vai(sp, 1); assert.equal(riga(sp), 15, "poi gennaio è a 1 riga: ci si aggancia");
  sp = vai(sp, 1); assert.equal(riga(sp), 16, "in fondo ai dati si ferma");
  sp = vai(sp, 1); assert.equal(riga(sp), 16, "e resta lì");
  sp = vai(sp, -1); assert.equal(riga(sp), 15);
  sp = vai(sp, -1); assert.equal(riga(sp), 11, "dicembre è a 5 righe: pagina intera");
  sp = vai(sp, -1); assert.equal(riga(sp), 10, "inizio di dicembre");
  sp = vai(0, -1); assert.equal(riga(sp), 1, "da oggi indietro: l'inizio di ottobre è a 3 righe");
  sp = vai(sp, -1); assert.equal(riga(sp), 0);
  sp = vai(sp, -1); assert.equal(riga(sp), 0, "in cima resta in cima");
});

test("nessuna settimana saltata, per 1-5 righe in vista e ogni posizione", () => {
  for (let righe = 1; righe <= 5; righe++) for (let sp = -4; sp <= 15; sp++) for (const verso of [-1, 1]) {
    const da = primaRiga(4, sp, righe, SETT), a = primaRiga(4, paginaDopo(DA, SETT, 4, sp, righe, verso), righe, SETT);
    const qui = ` righe ${righe}, da ${da}, verso ${verso} → ${a}`;
    if (verso > 0) assert.ok(a >= da && a <= da + righe, "avanti" + qui); else assert.ok(a <= da && a >= da - righe, "indietro" + qui);
    if (verso > 0 && da < SETT - righe) assert.ok(a > da, "avanti si muove" + qui);
    if (verso < 0 && da > 0) assert.ok(a < da, "indietro si muove" + qui);
  }
});
