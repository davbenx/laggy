// /go/<codice>: rimando all'app e contatore per giorno e codice, senza dati sulle persone.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { codiceGo, eBot, destinazioneGo, registraGo, leggiGo, settimanaDi, _resetSchemaGo, GO_MAX_CODICI } from "../functions/_go.js";
import { onRequestGet as go } from "../functions/go/[code].js";
import { onRequestGet as statsGo } from "../functions/stats/go.js";

// D1 su SQLite vero: stesse istruzioni, stessi parametri ?1 ?2.
function d1() {
  const db = new DatabaseSync(":memory:");
  const st = (sql, args = []) => ({
    bind: (...a) => st(sql, a),
    run: async () => { db.prepare(sql).run(...args); return { success: true }; },
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) })
  });
  return { _db: db, prepare: sql => st(sql), batch: async l => Promise.all(l.map(s => s.all())) };
}
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36";
const req = (path, ua = ANDROID, auth) => new Request("https://app.notturnisti.club" + path, { headers: { "user-agent": ua, ...(auth ? { authorization: auth } : {}) } });
const tabella = DB => DB._db.prepare("SELECT * FROM go_counts ORDER BY code").all().map(r => ({ ...r }));

test("codice: minuscolo e corto, il resto diventa «altro»", () => {
  assert.equal(codiceGo("IG-Reel-1103"), "ig-reel-1103");
  assert.equal(codiceGo("tt_0411"), "tt_0411");
  for (const x of ["", "a".repeat(33), "ciao mondo", "<script>", "%E0%A4%A", "-x", "mario.rossi@mail.it"]) assert.equal(codiceGo(x), "altro", x);
});

test("le anteprime dei link non contano, le persone sì", () => {
  for (const ua of ["", "WhatsApp/2.23.20.0", "facebookexternalhit/1.1", "TelegramBot (like TwitterBot)", "Googlebot/2.1", "Slackbot-LinkExpanding 1.0"]) assert.ok(eBot(ua), ua);
  assert.ok(!eBot(ANDROID));
  assert.ok(!eBot("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1"));
});

test("destinazione: l'app, e Play per Android solo con GO_PLAY=1", () => {
  assert.equal(destinazioneGo({}, ANDROID, "x"), "https://app.notturnisti.club/");
  assert.equal(destinazioneGo({ GO_PLAY: "1" }, "iPhone", "x"), "https://app.notturnisti.club/");
  assert.equal(destinazioneGo({ GO_PLAY: "1" }, ANDROID, "ig-1"),
    "https://play.google.com/store/apps/details?id=club.notturnisti.app&referrer=utm_source%3Dig-1%26utm_medium%3Dsocial");
});

test("la rotta rimanda con 302 e salva solo giorno, codice e conteggio", async () => {
  _resetSchemaGo(); const DB = d1(); const env = { DB };
  let r = await go({ env, request: req("/go/IG-1"), params: { code: "IG-1" } });
  assert.equal(r.status, 302);
  assert.equal(r.headers.get("location"), "https://app.notturnisti.club/");
  assert.equal(r.headers.get("cache-control"), "no-store");
  await go({ env, request: req("/go/ig-1"), params: { code: "ig-1" } });
  await go({ env, request: req("/go/ig-1", "WhatsApp/2.23"), params: { code: "ig-1" } });   // anteprima: non conta
  const t = tabella(DB);
  assert.deepEqual(t, [{ day: new Date().toISOString().slice(0, 10), code: "ig-1", n: 2 }]);
  assert.deepEqual(Object.keys(t[0]).sort(), ["code", "day", "n"]);   // nessun'altra colonna
  r = await go({ env: {}, request: req("/go/x"), params: { code: "x" } });                // senza database: rimanda lo stesso
  assert.equal(r.status, 302);
});

test("oltre il tetto di codici al giorno, i nuovi finiscono in «altro»", async () => {
  _resetSchemaGo(); const env = { DB: d1() };
  for (let i = 0; i < GO_MAX_CODICI + 3; i++) await registraGo(env, "c" + i);
  await registraGo(env, "c0");
  const t = tabella(env.DB);
  assert.equal(t.length, GO_MAX_CODICI + 1);
  assert.equal(t.find(r => r.code === "altro").n, 3);
  assert.equal(t.find(r => r.code === "c0").n, 2);
});

test("lettura: i giorni sotto 5 compaiono solo nella settimana", async () => {
  _resetSchemaGo(); const env = { DB: d1() };
  const now = Date.parse("2026-11-04T12:00:00Z");   // mercoledì
  const lun = Date.parse("2026-11-02T09:00:00Z");
  for (let i = 0; i < 6; i++) await registraGo(env, "ig-1", now);
  for (let i = 0; i < 2; i++) await registraGo(env, "ig-1", lun);
  await registraGo(env, "tt-1", now);
  const g = await leggiGo(env, 30, now);
  assert.deepEqual(g.giorni, [{ day: "2026-11-04", code: "ig-1", n: 6 }]);
  assert.deepEqual(g.settimane.sort((a, b) => a.code.localeCompare(b.code)),
    [{ week: "2026-11-02", code: "ig-1", n: 8 }, { week: "2026-11-02", code: "tt-1", n: 1 }]);
  assert.deepEqual(g.totali, { "ig-1": 8, "tt-1": 1 });
  assert.equal(settimanaDi("2026-11-08"), "2026-11-02");   // domenica → lunedì prima
  assert.equal(settimanaDi("2026-11-09"), "2026-11-09");
});

test("/stats/go chiede lo stesso codice di /stats", async () => {
  _resetSchemaGo();
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("segreto"));
  const env = { DB: d1(), STATS_TOKEN_SHA256: [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("") };
  assert.equal((await statsGo({ env, request: req("/stats/go") })).status, 401);
  assert.equal((await statsGo({ env, request: req("/stats/go", ANDROID, "Bearer sbagliato") })).status, 401);
  assert.equal((await statsGo({ env: {}, request: req("/stats/go") })).status, 503);
  const r = await statsGo({ env, request: req("/stats/go?days=7", ANDROID, "Bearer segreto") });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.days, 7); assert.equal(j.min_giorno, 5); assert.deepEqual(j.giorni, []);
});
