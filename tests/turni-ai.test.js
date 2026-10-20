// /turni-ai: senza chiave la voce non esiste; con la chiave la richiesta a
// Claude ha la forma giusta e la risposta è ripulita prima di tornare all'app.
import { test } from "node:test";
import assert from "node:assert/strict";
import { onRequestGet, onRequestPost } from "../functions/turni-ai.js";

const req = (body, ip = "1.2.3.4") => new Request("https://app.notturnisti.club/turni-ai", {
  method: body ? "POST" : "GET", headers: { "content-type": "application/json", "CF-Connecting-IP": ip, origin: "https://localhost" },
  body: body ? JSON.stringify(body) : undefined });

test("GET dice se la lettura è disponibile", async () => {
  assert.deepEqual(await (await onRequestGet({ env: {}, request: req() })).json(), { on: false });
  assert.deepEqual(await (await onRequestGet({ env: { ANTHROPIC_API_KEY: "k" }, request: req() })).json(), { on: true });
});

test("POST senza chiave: 503; file non valido: 400", async () => {
  assert.equal((await onRequestPost({ env: {}, request: req({ tipo: "image/jpeg", dati: "AAAA" }) })).status, 503);
  assert.equal((await onRequestPost({ env: { ANTHROPIC_API_KEY: "k" }, request: req({ tipo: "text/html", dati: "AAAA" }) })).status, 400);
  assert.equal((await onRequestPost({ env: { ANTHROPIC_API_KEY: "k" }, request: req({ tipo: "image/jpeg", dati: "<script>" }) })).status, 400);
});

test("POST: richiesta a Claude e risposta ripulita", async (t) => {
  let inviata;
  t.mock.method(globalThis, "fetch", async (url, opt) => {
    inviata = { url, opt, body: JSON.parse(opt.body) };
    return new Response(JSON.stringify({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ leggibile: true, nota: "",
      giorni: [{ data: "2026-11-03", etichetta: "N", inizio: "21:00", fine: "07:00" }, { data: "2026-11-04", etichetta: "S", inizio: "", fine: "" },
        { data: "bad", etichetta: "X", inizio: "", fine: "" }, { data: "2026-11-05", etichetta: " ", inizio: "", fine: "" }] }) }] }), { status: 200 });
  });
  const r = await onRequestPost({ env: { ANTHROPIC_API_KEY: "k" }, request: req({ tipo: "image/jpeg", dati: "AAAA", nome: "Davide <b>", mese: 11, anno: 2026 }) });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("access-control-allow-origin"), "https://localhost");
  assert.deepEqual(await r.json(), { leggibile: true, nota: "", giorni: [{ data: "2026-11-03", etichetta: "N", s: 1260, e: 1860 }, { data: "2026-11-04", etichetta: "S" }] });
  assert.equal(inviata.url, "https://api.anthropic.com/v1/messages");
  assert.equal(inviata.opt.headers["x-api-key"], "k");
  assert.equal(inviata.body.output_config.format.type, "json_schema");
  assert.equal(inviata.body.content, undefined);
  const [img, testo] = inviata.body.messages[0].content;
  assert.deepEqual(img, { type: "image", source: { type: "base64", media_type: "image/jpeg", data: "AAAA" } });
  assert.match(testo.text, /«Davide b»/);
  assert.match(testo.text, /11\/2026/);
});

test("POST: un rifiuto o un errore dell'API non passa come turni", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ stop_reason: "refusal", content: [] }), { status: 200 }));
  assert.equal((await onRequestPost({ env: { ANTHROPIC_API_KEY: "k" }, request: req({ tipo: "application/pdf", dati: "AAAA" }) })).status, 422);
  t.mock.method(globalThis, "fetch", async () => new Response("{}", { status: 529 }));
  assert.equal((await onRequestPost({ env: { ANTHROPIC_API_KEY: "k" }, request: req({ tipo: "application/pdf", dati: "AAAA" }) })).status, 503);
});
