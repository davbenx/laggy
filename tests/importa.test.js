// Importazione dei turni (importa.js): file .ics, .csv, .xlsx ed eventi del
// calendario → giorni → etichette riconosciute → modifiche da applicare.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { leggiIcs, eventiInGiorni, leggiCsv, leggiXlsx, leggiData, tabellaInGiorni, indovina, gruppi, piano } from "../importa.js";

const SH = { M:{n:"Mattino",s:420,e:840}, P:{n:"Pomeriggio",s:840,e:1260}, N:{n:"Notte",s:1260,e:1860} };

test("ICS: eventi con orari, tutto il giorno, righe piegate e caratteri protetti", () => {
  const ics = ["BEGIN:VCALENDAR","BEGIN:VEVENT","DTSTART:20261103T210000","DTEND:20261104T070000","SUMMARY:Notte","END:VEVENT",
    "BEGIN:VEVENT","DTSTART;VALUE=DATE:20261105","DTEND;VALUE=DATE:20261107","SUMMARY:Fe","\trie","END:VEVENT",
    "BEGIN:VEVENT","DTSTART:20261108T070000","DTEND:20261108T150000","SUMMARY:Mattino\\, reparto","END:VEVENT","END:VCALENDAR"].join("\r\n");
  const g = eventiInGiorni(leggiIcs(ics));
  assert.deepEqual(g, [
    {data:"2026-11-03", etichetta:"Notte", s:1260, e:1860},
    {data:"2026-11-05", etichetta:"Ferie"}, {data:"2026-11-06", etichetta:"Ferie"},
    {data:"2026-11-08", etichetta:"Mattino, reparto", s:420, e:900}]);
});

test("date all'italiana, ore che non diventano date", () => {
  assert.equal(leggiData("03/11/2026").getDate(), 3);
  assert.equal(leggiData("3/11/26").getMonth(), 10);
  assert.equal(leggiData("2026-11-03").getDate(), 3);
  assert.equal(leggiData("lun 3/11", 2026).getMonth(), 10);
  assert.equal(leggiData("07.30", 2026), null);
  assert.equal(leggiData("12.10", 2026), null);
  assert.equal(leggiData("46330").getFullYear(), 2026);   // numero di serie di Excel
  assert.equal(leggiData("31/02/2026"), null);
});

test("CSV con colonna di date, turno e orari", () => {
  const r = leggiCsv("Data;Turno;Inizio;Fine\n01/11/2026;Notte;21:00;07:00\n02/11/2026;Smonto;;\n03/11/2026;Riposo;;\n04/11/2026;\"Mattino\";07:00;14:00\n");
  const t = tabellaInGiorni(r);
  assert.equal(t.tipo, "date");
  assert.deepEqual(t.giorni[0], {data:"2026-11-01", etichetta:"Notte", s:1260, e:1860});
  assert.equal(t.giorni.length, 4);
  assert.deepEqual(t.giorni[3], {data:"2026-11-04", etichetta:"Mattino", s:420, e:840});
});

test("XLSX di reparto: giorni in riga, una riga per persona, mese dal titolo", async () => {
  const buf = readFileSync(new URL("./dati/turni-reparto.xlsx", import.meta.url));
  const righe = await leggiXlsx(buf);
  let t = tabellaInGiorni(righe);
  assert.equal(t.tipo, "griglia");
  assert.deepEqual(t.persone.map(p => p.nome), ["Rossi Anna", "Benesso Davide"]);
  assert.equal(t.mese, 11); assert.equal(t.anno, 2026); assert.ok(t.meseNoto);
  assert.equal(t.giorni.length, 0, "con più persone si aspetta la scelta");
  t = tabellaInGiorni(righe, {riga: t.persone[1].indice});
  assert.equal(t.giorni.length, 30);
  assert.deepEqual(t.giorni.slice(0, 4).map(x => x.data + " " + x.etichetta), ["2026-11-01 N", "2026-11-02 S", "2026-11-03 R", "2026-11-04 FE"]);
});

test("foglio girato: giorni in colonna, persone in intestazione", () => {
  const righe = [["Giorno", "Anna", "Io"]].concat(Array.from({length: 10}, (_, i) => [String(i + 1), "M", i % 2 ? "N" : "R"]));
  const t = tabellaInGiorni(righe, {mese: 12, anno: 2026});
  assert.equal(t.tipo, "griglia");
  assert.equal(t.persone.length, 2);
  const mio = tabellaInGiorni(righe, {mese: 12, anno: 2026, riga: t.persone[1].indice});
  assert.equal(mio.giorni[1].data, "2026-12-02"); assert.equal(mio.giorni[1].etichetta, "N");
});

test("indovina: lettere, nomi, sigle italiane, orari", () => {
  const casi = { N:"N", m:"M", Notte:"N", "Pomeriggio":"P", R:"R", Riposo:"R", L:"R", S:"R", Smonto:"R", FE:"ferie", Ferie:"ferie",
    MAL:"malattia", PD:"reperibile", "Pronta disponibilità":"reperibile", Corso:"formazione", ECM:"formazione", "Gita":null };
  for (const [et, v] of Object.entries(casi)) assert.equal(indovina(et, null, null, SH), v, et);
  assert.equal(indovina("Turno", 1255, 1865, SH), "N");
  assert.equal(indovina("Lavoro", 420, 960, SH), "M", "straordinario: il turno più vicino");
  assert.equal(indovina("Dentista", 600, 660, SH), null, "un appuntamento di un'ora non è un turno");
  assert.equal(indovina("S", null, null, Object.assign({S:{n:"Sera",s:1080,e:1380}}, SH)), "S");
});

test("piano: un turno vince sulla reperibilità, gli orari veri restano", () => {
  const giorni = [{data:"2026-11-01", etichetta:"Turno", s:420, e:960}, {data:"2026-11-01", etichetta:"PD"},
    {data:"2026-11-02", etichetta:"FE"}, {data:"2026-11-03", etichetta:"Gita"}, {data:"2026-11-04", etichetta:"N"}];
  const G = gruppi(giorni, SH), scelte = Object.fromEntries(G.map(g => [g.chiave, g.v]));
  assert.deepEqual(piano(giorni, scelte, SH), [
    {data:"2026-11-01", rep:true, v:"M", s:420, e:960},
    {data:"2026-11-02", v:"ferie"},
    {data:"2026-11-04", v:"N"}]);
});

// ── riconoscere il ciclo dai giorni importati ──
import { rilevaCiclo } from "../importa.js";
const turniM = { M: {}, P: {}, N: {} };
const seq = (inizio, codici) => codici.map((v, i) => ({ data: new Date(Date.UTC(2026, 9, 1 + i) ).toISOString().slice(0, 10), v })).map((x, i) => (i === 0 ? { ...x, data: inizio } : x));
test("rilevaCiclo: MPNSR ripetuto due volte è un ciclo di 5 giorni", () => {
  const g = seq("2026-10-01", "MPNRRMPNRR".split(""));
  const c = rilevaCiclo(g, turniM);
  assert.deepEqual(c, { periodo: 5, pattern: "MPNRR", inizio: "2026-10-01" });
});
test("rilevaCiclo: un giro solo non basta", () => {
  assert.equal(rilevaCiclo(seq("2026-10-01", "MPNRR".split("")), turniM), null);
});
test("rilevaCiclo: turni diversi ogni settimana non sono un ciclo", () => {
  assert.equal(rilevaCiclo(seq("2026-10-01", "MMPNRRPPNMRRNNM".split("")), turniM), null);
});
test("rilevaCiclo: un solo valore, o i soli riposi, non sono un ciclo", () => {
  assert.equal(rilevaCiclo(seq("2026-10-01", "MMMMMMMM".split("")), turniM), null);
  assert.equal(rilevaCiclo(seq("2026-10-01", "RRRRRRRR".split("")), turniM), null);
});
test("rilevaCiclo: un buco nelle date spezza la fila", () => {
  const g = seq("2026-10-01", "MPNRRMPNRR".split("")); g.splice(5, 1);
  assert.equal(rilevaCiclo(g, turniM), null);
});
test("rilevaCiclo: orari veri diversi dal solito non contano come turno del ciclo", () => {
  const g = seq("2026-10-01", "MPNRRMPNRR".split("")).map((x, i) => i === 2 ? { ...x, s: 100, e: 200 } : x);
  assert.equal(rilevaCiclo(g, turniM), null);
});
