// Telemetria: il server deve accettare esattamente gli stessi eventi del
// client, e scartare tutto ciò che potrebbe portare dati personali.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { ALLOWED, sanitizeEvent, eventDay } from "../functions/_analytics.js";
import { onRequestPost } from "../functions/collect.js";

function loadClient(initial = {}) {
  // Esegue analytics.js in una sandbox minima: localStorage finto, rete finta.
  const store = new Map(Object.entries(initial));
  const sent = [];
  const window = { dispatchEvent() {} };
  const ctx = {
    window, navigator: { sendBeacon: (url, blob) => { sent.push(blob.body); return true; } },
    location: { protocol: "https:" },
    document: { readyState: "complete", addEventListener() {} },
    localStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    Blob: class { constructor(parts) { this.body = parts.join(""); } }, fetch: () => Promise.resolve(), Event: class {}
  };
  ctx.window.matchMedia = () => ({ matches: false });
  vm.runInNewContext(readFileSync(new URL("../analytics.js", import.meta.url), "utf8"), ctx);
  return { A: window.NTAnalytics, store, sent };
}
function clientAllowed() {
  return JSON.parse(JSON.stringify(loadClient().A.ALLOWED));
}

test("opt-in: senza consenso non parte niente e non si scrive niente", () => {
  const { A, store, sent } = loadClient({ "nt:analytics-optout": "false", "nt:analytics-firstseen": '"2026-01-01"' });
  A.track("today_viewed");
  assert.equal(A.isEnabled(), false);
  assert.equal(A.answered(), false);
  assert.equal(sent.length, 0);
  assert.deepEqual([...store.keys()], [], "le chiavi scritte dal vecchio modello opt-out vanno ripulite");
});

test("opt-in: dopo il sì gli eventi partono, dopo il no si cancella tutto", () => {
  const { A, store, sent } = loadClient();
  A.setEnabled(true);
  A.track("today_viewed");
  assert.ok(sent.some(b => JSON.parse(b).event === "today_viewed"));
  assert.ok(sent.some(b => JSON.parse(b).event === "active_day"));
  A.setEnabled(false);
  const n = sent.length;
  A.track("today_viewed");
  assert.equal(sent.length, n);
  assert.deepEqual([...store.keys()], ["nt:analytics-consent"]);
  assert.equal(A.answered(), true);
});

test("ALLOWED lato server coincide con quello di analytics.js", () => {
  assert.deepEqual(ALLOWED, clientAllowed());
});

test("sanitizeEvent: evento sconosciuto scartato", () => {
  assert.equal(sanitizeEvent({ event: "qualcosa_di_nuovo" }), null);
  assert.equal(sanitizeEvent({ event: "__proto__" }), null);
  assert.equal(sanitizeEvent(null), null);
});

test("sanitizeEvent: proprietà non ammesse o valori liberi non passano", () => {
  assert.deepEqual(sanitizeEvent({ event: "today_viewed", props: { email: "a@b.it" } }), { event: "today_viewed", prop: "" });
  assert.deepEqual(sanitizeEvent({ event: "plan_generated", props: { pattern_type: "Mario Rossi 21:00" } }), { event: "plan_generated", prop: "" });
  assert.deepEqual(sanitizeEvent({ event: "plan_generated", props: { pattern_type: "fisso_N" } }), { event: "plan_generated", prop: "pattern_type=fisso_n" });
  assert.deepEqual(sanitizeEvent({ event: "active_day", props: { platform: "windows" } }), { event: "active_day", prop: "" });
  assert.deepEqual(sanitizeEvent({ event: "active_day", props: { platform: "android" } }), { event: "active_day", prop: "platform=android" });
  assert.deepEqual(sanitizeEvent({ event: "onboarding_step_completed", props: { step: 3 } }), { event: "onboarding_step_completed", prop: "step=3" });
});

test("eventDay: accetta il giorno del client solo se plausibile", () => {
  const now = Date.parse("2026-09-23T12:00:00Z");
  assert.equal(eventDay(Date.parse("2026-09-20T10:00:00Z"), now), "2026-09-20");
  assert.equal(eventDay(Date.parse("2027-01-01T00:00:00Z"), now), "2026-09-23");   // futuro
  assert.equal(eventDay(Date.parse("2025-01-01T00:00:00Z"), now), "2026-09-23");   // troppo vecchio
  assert.equal(eventDay("spazzatura", now), "2026-09-23");
});

function fakeD1() {
  const rows = new Map();
  const db = {
    rows,
    prepare(sql) {
      const st = { sql, args: [], bind(...a) { st.args = a; return st; },
        async run() {
          if (/INSERT INTO counts/.test(sql)) {
            const [day, event, prop] = st.args; const k = [day, event, prop ?? ""].join("|");
            rows.set(k, (rows.get(k) || 0) + 1);
          }
          return { success: true };
        } };
      return st;
    },
    async batch(sts) { return Promise.all(sts.map(s => s.run())); }
  };
  return db;
}

test("POST /collect: incrementa il contatore giusto e risponde sempre 204", async () => {
  const DB = fakeD1();
  const req = body => new Request("https://x/collect", { method: "POST", body, headers: { "content-type": "text/plain" } });
  const t = Date.now();
  let r = await onRequestPost({ env: { DB }, request: req(JSON.stringify({ event: "plan_generated", props: { pattern_type: "notte" }, t })) });
  assert.equal(r.status, 204);
  await onRequestPost({ env: { DB }, request: req(JSON.stringify({ event: "plan_generated", props: { pattern_type: "notte" }, t })) });
  r = await onRequestPost({ env: { DB }, request: req("non è json") });
  assert.equal(r.status, 204);
  r = await onRequestPost({ env: { DB }, request: req(JSON.stringify({ event: "inventato" })) });
  assert.equal(r.status, 204);
  r = await onRequestPost({ env: {}, request: req(JSON.stringify({ event: "today_viewed" })) }); // senza DB: no-op
  assert.equal(r.status, 204);
  const day = new Date(t).toISOString().slice(0, 10);
  assert.deepEqual([...DB.rows], [[day + "|plan_generated|pattern_type=notte", 2]]);
});
