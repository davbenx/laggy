import { test } from "node:test";
import assert from "node:assert/strict";
import { createEngine, resolveNextAction } from "../engine.js";
import { buildSchedule } from "../notifications.js";

test("resolveNextAction: turno di notte prima dell'ultimo caffè", () => {
  const e = createEngine({ pattern: "N", anchor: "2026-09-17", focus: "2026-09-17" });
  const P = e.plan();
  const res = resolveNextAction({ nowMins: 1410, P, b: P.b });
  assert.ok(res.status.includes("turno"), "status deve indicare turno");
  assert.ok(res.next, "next action deve essere presente");
});

test("resolveNextAction: sonno in corso segnala sveglia programmata", () => {
  const e = createEngine({ pattern: "N", anchor: "2026-09-17", focus: "2026-09-17" });
  const P = e.plan();
  const midSleep = Math.round((P.s.onset + P.end) / 2);
  const res = resolveNextAction({ nowMins: midSleep, P, b: P.b });
  assert.equal(res.next.type, "wake");
  assert.equal(res.next.urgency, "sleep");
});

test("resolveNextAction: giorno di riposo", () => {
  const e = createEngine({ pattern: "R", anchor: "2026-09-17", focus: "2026-09-17" });
  const P = e.plan();
  const res = resolveNextAction({ nowMins: 600, P, b: P.b });
  assert.equal(res.status, "Giorno di riposo");
  assert.ok(res.next);
});

test("buildSchedule: genera notifiche per i giorni futuri senza errori", () => {
  const cfg = { pattern: "MPNSR", anchor: "2026-09-17" };
  const items = buildSchedule(cfg, { days: 7 });
  assert.ok(Array.isArray(items), "deve restituire un array");
  for (const item of items) {
    assert.ok(item.id, "ogni notifica deve avere un id");
    assert.ok(item.title, "ogni notifica deve avere un titolo");
    assert.ok(item.at instanceof Date, "at deve essere una data");
    assert.ok(item.at.getTime() >= Date.now(), "le notifiche devono essere future");
  }
});

test("resolveNextAction: turno non inserito (c === '?')", () => {
  const e = createEngine({ pattern: "N", anchor: "2026-09-17", focus: "2026-09-25", repeat: false });
  const P = e.plan();
  assert.equal(P.b.c, "?");
  const res = resolveNextAction({ nowMins: 600, P, b: P.b });
  assert.equal(res.status, "Turno non impostato");
  assert.equal(res.next.type, "missing_shift");
});

test("navigazione: turnazione ciclica infinita supporta offset arbitrari positivi e negativi", () => {
  const e = createEngine({ pattern: "MMPNR", anchor: "2026-09-17", focus: "2026-09-17", repeat: true });
  assert.notEqual(e.codeAt(100), "?");
  assert.notEqual(e.codeAt(-500), "?");
  assert.notEqual(e.codeAt(1000), "?");
  // Con CFG.H esteso dinamicamente, la simulazione include giorni arbitrariamente lontani
  e.CFG.H = 150;
  const P = e.plan();
  assert.ok(e.at(P.S, 100), "giorno +100 deve avere dati di simulazione");
  assert.ok(e.at(P.S, -100), "giorno -100 deve avere dati di simulazione");
});

// Due pisolini nello stesso giorno avevano lo stesso id (giorno*10+tipo): su
// Android il secondo cancellava il primo, sul web restava un timer orfano.
test("buildSchedule: id unici anche con più pisolini nello stesso giorno", () => {
  const items = buildSchedule({ pattern: "NNNRR", anchor: "2026-10-01", napTurno: "si" }, { days: 21 });
  const ids = items.map(n => n.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every(x => Number.isInteger(x) && x >= 0 && x < 999999), "999999 è riservato all'avviso di fine coda su iOS");
});

// "Solo oggi" dal primo avvio: un ciclo di un giorno che non si ripete. Gli
// altri giorni non devono ricevere promemoria inventati.
test("buildSchedule: con un solo giorno impostato, promemoria solo per quel giorno", () => {
  const oggi = new Date(); const iso = d => d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  const items = buildSchedule({ pattern: "N", anchor: iso(oggi), repeat: false, ecc: { [iso(oggi)]: "N" } }, { days: 14 });
  const dopodomani = new Date(oggi); dopodomani.setDate(dopodomani.getDate() + 2); dopodomani.setHours(12, 0, 0, 0);
  assert.ok(items.every(n => n.at < dopodomani), "nessun promemoria oltre il turno di oggi");
});
