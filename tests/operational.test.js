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
