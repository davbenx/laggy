// POST /webhook-ls — riceve gli eventi di Lemon Squeezy. Fonte di verità per
// "chi ha pagato davvero": il client non decide mai da solo di sbloccarsi,
// aspetta che questo endpoint (dopo aver verificato la firma) crei l'accesso.
//
// Da impostare nella dashboard Lemon Squeezy (Settings → Webhooks):
// URL: https://TUO-DOMINIO/webhook-ls — evento: order_created — con lo
// stesso secret messo nella variabile d'ambiente LEMONSQUEEZY_WEBHOOK_SECRET.
import { cfgEnv, lemonSqueezyVerify, genId, genKey, writeSub, sha256hex, json, err, cors, nowSec } from "./_lib.js";

export async function onRequestOptions({ env }) {
  return new Response(null, { status: 204, headers: cors(cfgEnv(env).origin) });
}

export async function onRequestPost({ env, request }) {
  const e = cfgEnv(env);
  const o = e.origin;
  if (!env.SUBS) return err(503, "servizio non configurato", o);

  // La firma va verificata sul corpo GREZZO, prima di qualunque parsing.
  const raw = await request.text();
  const sig = request.headers.get("x-signature") || "";
  const okSig = await lemonSqueezyVerify(e, raw, sig);
  if (!okSig) return err(401, "firma non valida", o);

  let payload; try { payload = JSON.parse(raw); } catch (_) { return err(400, "JSON non valido", o); }
  const eventName = (payload.meta && payload.meta.event_name) || "";
  // Altri eventi (rimborsi, dispute, ecc.) arriveranno qui in futuro — per ora
  // rispondiamo 200 e li ignoriamo, così Lemon Squeezy non li ripete all'infinito.
  if (eventName !== "order_created") return json({ ok: true, skipped: eventName }, 200, o);

  const attrs = (payload.data && payload.data.attributes) || {};
  if (attrs.status !== "paid") return json({ ok: true, skipped: "non pagato" }, 200, o);

  const orderId = String((payload.data && payload.data.id) || "");
  if (!orderId) return err(400, "id ordine mancante", o);

  const token = String((payload.meta && payload.meta.custom_data && payload.meta.custom_data.token) || "").trim();
  if (!token) return err(400, "token personalizzato mancante nell'ordine", o);

  // Idempotenza: un webhook può arrivare più di una volta per lo stesso ordine
  // (Lemon Squeezy ripete in caso di mancata risposta) — rilanciarlo non deve
  // creare un secondo abbonamento.
  const seenKey = "order:" + orderId;
  const already = await env.SUBS.get(seenKey);
  if (already) return json({ ok: true, already: true }, 200, o);

  const pendingRaw = await env.SUBS.get("pending:" + token);
  if (!pendingRaw) return err(404, "nessuna configurazione in attesa per questo token — checkout scaduto o già usato", o);
  const cfg = JSON.parse(pendingRaw);

  const id = genId(), writeKey = genKey(), t = nowSec();
  let emailHash = null;
  if (attrs.user_email) { try { emailHash = await sha256hex(attrs.user_email); } catch (_) {} }
  const sub = {
    paid: true,
    plan: "lifetime",       // a vita: expiry null
    expiry: null,
    cfg,
    avviso: 30,
    writeKey,
    orderID: orderId,
    source: "lemonsqueezy",  // per distinguere, in futuro, da un eventuale acquisto nativo Play Store
    emailHash,
    created: t,
    updated: t
  };
  await writeSub(env, id, sub);
  await env.SUBS.put(seenKey, id);
  if (emailHash) await env.SUBS.put("email:" + emailHash, id);
  await env.SUBS.delete("pending:" + token);

  const feedUrl = new URL(request.url).origin.replace(/^https?/, "webcal") + "/feed/" + id;
  // Il client, tornato dal checkout, interroga /claim/<token>: qui gli lasciamo
  // le credenziali pronte, per un solo prelievo (cancellate da claim/[token].js
  // non appena lette).
  await env.SUBS.put("claim:" + token, JSON.stringify({ id, writeKey, feedUrl }), { expirationTtl: 3600 });

  return json({ ok: true }, 200, o);
}
