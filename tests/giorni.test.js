// Giorni speciali nel motore: ferie e malattia sono riposo, formazione e
// orari veri cambiano il turno, la reperibilità aggiunge un pisolino
// preventivo; nei link e nel calendario automatico niente ferie né malattia.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createEngine, encGiorni, decGiorni, parseConfig } from "../engine.js";
import { buildSchedule } from "../notifications.js";

const base = g => createEngine({ pattern: "MPNSR", anchor: "2026-10-19", focus: "2026-10-19T12:00:00", giorni: g });

test("ferie e malattia: riposo, anche su una notte", () => {
  const e = base({ "2026-10-21": { t: "ferie" }, "2026-10-22": { t: "malattia" } });
  assert.equal(e.block(2).rest, true); assert.equal(e.block(2).tipo, "ferie");
  assert.equal(e.etichetta(2), "Ferie"); assert.equal(e.etichetta(3), "Malattia");
  assert.equal(e.etichetta(0), "Mattino"); assert.equal(e.etichetta(4), "Riposo");
});

test("orari veri e formazione sostituiscono quelli del turno", () => {
  const e = base({ "2026-10-19": { s: 420, e: 960 }, "2026-10-23": { t: "formazione" } });
  const b = e.block(0); assert.deepEqual([b.start, b.end, b.oreVere, b.previsto], [420, 960, true, 420]);
  const f = e.block(4); assert.deepEqual([f.name, f.start, f.end, f.rest], ["Formazione", 540, 1020, false]);
  assert.ok(e.buildEvents(5).some(x => x.title === "Formazione"));
});

test("reperibilità: pisolino preventivo nel pomeriggio, mai sul turno", () => {
  for (const off of [0, 4]) {   // dopo un mattino; in un giorno di riposo
    const d = new Date("2026-10-19T12:00:00"); d.setDate(d.getDate() + off);
    const e = createEngine({ pattern: "MPNSR", anchor: "2026-10-19", focus: d, giorni: { [d.toISOString().slice(0, 10)]: { t: "reperibile" } } });
    const P = e.plan(), n = P.naps.find(x => x.rep);
    assert.ok(n, "c'è il pisolino preventivo");
    assert.ok(n.a >= 780 && n.b <= P.s.onset - 300, "nel pomeriggio, lontano dalla sera");
    if (!P.b.rest) assert.ok(n.a >= P.b.end, "dopo il turno");
  }
});

test("dati rotti: si scartano senza far cadere il piano", () => {
  const e = base({ "x": { t: "ferie" }, "2026-10-19": { t: "boh", s: "a" }, "2026-10-20": null, "2026-10-21": { t: "ferie", s: 1, e: 9 } });
  assert.deepEqual(e.state.giorni, { "2026-10-21": { t: "ferie" } });
  assert.doesNotThrow(() => e.plan());
});

test("link e calendario automatico: ferie e malattia restano sul telefono", () => {
  const g = { "2026-10-19": { t: "reperibile" }, "2026-10-20": { s: 840, e: 1320 }, "2026-10-21": { t: "malattia" }, "2026-10-23": { t: "formazione", s: 540, e: 1020 } };
  const tutto = encGiorni(g, { oggi: new Date("2026-10-19") });
  assert.deepEqual(decGiorni(tutto), g);
  const server = encGiorni(g, { oggi: new Date("2026-10-19"), senzaAssenze: true });
  assert.ok(!/M/.test(server.replace(/\d|_|-|\./g, "").replace(/[PC]/g, "")), server);
  assert.deepEqual(parseConfig(new URLSearchParams("p=MPNSR&a=2026-10-19&g=" + server)).giorni["2026-10-21"], undefined);
});

test("notifiche: pisolino preventivo e settimana con i nomi dei giorni speciali", () => {
  const iso = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const f = new Date(); f.setHours(12, 0, 0, 0);
  const tra = n => { const d = new Date(f); d.setDate(d.getDate() + n); return d; };
  // la prossima domenica porta il riepilogo della settimana
  const dom = (7 - f.getDay()) % 7 || 7;
  const cfg = { turniConfigurati: true, pattern: "R", repeat: true, anchor: iso(f), focus: f, shifts: { M: { n: "Mattino", s: 420, e: 840 } },
    giorni: { [iso(tra(1))]: { t: "reperibile" }, [iso(tra(dom + 1))]: { t: "ferie" } } };   // dom ≥ 1: mai lo stesso giorno
  const L = buildSchedule(cfg, { days: 10, types: ["nap", "settimana"] });
  assert.ok(L.some(n => n.title === "Pisolino preventivo"), JSON.stringify(L.map(n => n.title)));
  const sett = L.find(n => n.title === "La tua settimana");
  assert.ok(sett, "c'è il riepilogo della domenica");
  assert.match(sett.body, /Ferie/);
});

test("tanti giorni segnati non rallentano il piano", () => {
  // centinaia di eccezioni e giorni speciali (un anno importato dal foglio
  // turni) devono costare quanto nessuna: prima ogni domanda al motore
  // rielencava tutte le date e creava una Date, e Turni bloccava i telefoni medi
  const ecc = {}, giorni = {};
  for (let i = -300; i < 300; i++) { const d = new Date("2026-10-19T12:00:00"); d.setDate(d.getDate() + i);
    const k = d.toISOString().slice(0, 10); if (i % 2) ecc[k] = "N"; if (i % 3 === 0) giorni[k] = { t: "reperibile" }; }
  const tempo = cfg => { const e = createEngine(Object.assign({ pattern: "MPNSR", anchor: "2026-10-19", focus: "2026-10-19T12:00:00" }, cfg));
    e.buildEvents(14); const t0 = performance.now(); for (let k = 0; k < 3; k++) e.buildEvents(28); return performance.now() - t0; };
  const vuoto = Math.min(tempo({}), tempo({})), pieno = Math.min(tempo({ ecc, giorni }), tempo({ ecc, giorni }));
  assert.ok(pieno < vuoto * 2 + 20, "vuoto " + vuoto.toFixed(0) + " ms, pieno " + pieno.toFixed(0) + " ms");
});
