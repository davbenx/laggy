// Robustezza: configurazioni casuali (orari strani, inizio dopo mezzanotte,
// cicli lunghi o senza riposi, eccezioni, partner) non devono mai far
// lanciare il motore né produrre orari impossibili. Seed fisso: se fallisce,
// fallisce sempre allo stesso modo e si può riprodurre.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createEngine, buildFeed, buildCoupleFeed } from "../engine.js";
import { buildSchedule } from "../notifications.js";

let seed = 20261016;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = a => a[ri(0, a.length - 1)];
const hm = m => String(Math.floor(m / 60) % 24).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
const iso = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

function configCasuale() {
  const letters = pick([["M"], ["N"], ["M", "P"], ["M", "P", "N"], ["D", "N"], ["S"]]);
  const shifts = {};
  for (const L of letters) {
    let s = ri(0, 23) * 60 + pick([0, 15, 30, 45]);
    if (rnd() < 0.15) s += 1440;
    shifts[L] = { n: L, s, e: s + pick([60, 240, 420, 480, 600, 720, 840, 960]) };
  }
  // anche cicli senza nessun riposo (es. "sempre pomeriggio")
  const pattern = Array.from({ length: ri(1, 28) }, () => rnd() < 0.25 ? "R" : pick(letters)).join("");
  const oggi = new Date(), anchor = new Date(oggi); anchor.setDate(anchor.getDate() - ri(-10, 40));
  const ecc = {};
  for (let k = 0; k < ri(0, 8); k++) { const d = new Date(oggi); d.setDate(d.getDate() + ri(-5, 30)); ecc[iso(d)] = pick(letters.concat(["R"])); }
  return {
    pattern, anchor: iso(anchor), shifts, repeat: rnd() < 0.7, ecc,
    freeBed: hm(pick([1320, 1380, 0, 60, ri(0, 1439)])), freeWake: hm(pick([420, 480, 540, ri(0, 1439)])),
    cTo: ri(0, 120), cFrom: ri(0, 120), prep: ri(10, 120), maxAdvance: pick([20, 60, 120]),
    caffSens: pick(["bassa", "media", "alta"]), napTurno: pick(["no", "pausa", "libero"]),
    sonnoDiurno: pick(["diviso", "unico", "unicoPisolino"]), mattinoBifasico: rnd() < 0.3,
    pPattern: rnd() < 0.3 ? pattern.split("").reverse().join("") : "", pAnchor: iso(anchor)
  };
}

test("fuzz: 120 configurazioni casuali, nessuna eccezione e nessun orario impossibile", () => {
  for (let i = 0; i < 120; i++) {
    const cfg = configCasuale();
    const ctx = JSON.stringify(cfg);
    const e = createEngine(cfg);
    for (let o = 0; o < 14; o++) {
      e.state.focus = new Date(Date.now() + o * 864e5);
      if (e.codeAt(0) === "?") continue;
      const P = e.plan();
      assert.ok(Number.isFinite(P.s.onset) && P.s.dur > 0 && P.s.dur <= 16 * 60, "sonno impossibile: " + ctx);
    }
    e.state.focus = new Date();
    for (const ev of e.buildEvents(42)) assert.ok(ev.end > ev.start, "evento invertito " + ev.uid + ": " + ctx);
    assert.doesNotThrow(() => buildFeed(cfg, { days: 42 }), ctx);
    if (cfg.pPattern) assert.doesNotThrow(() => buildCoupleFeed(cfg, { days: 60 }), ctx);
    const ids = buildSchedule(cfg, { days: 21 }).map(n => n.id);
    assert.equal(new Set(ids).size, ids.length, "id notifiche duplicati: " + ctx);
  }
});
