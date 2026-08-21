// POST /pending — prima di aprire il checkout Lemon Squeezy, il client registra
// qui la configurazione turni insieme a un token generato da lui. Il webhook,
// quando arriva, sa solo il token (passato come dato personalizzato nel
// checkout) — questo è il ponte fra "che turni aveva" e "chi ha pagato".
// Scade da solo dopo 30 minuti: un checkout abbandonato non lascia residui.
import { cfgEnv, sanitizeConfig, json, err, cors } from "./_lib.js";

export async function onRequestOptions({ env }) {
  return new Response(null, { status: 204, headers: cors(cfgEnv(env).origin) });
}

export async function onRequestPost({ env, request }) {
  const o = cfgEnv(env).origin;
  if (!env.SUBS) return err(503, "servizio non configurato", o);

  let body; try { body = await request.json(); } catch (_) { return err(400, "JSON non valido", o); }
  const token = String(body.token || "").trim();
  if (!token || token.length < 16) return err(400, "token mancante o troppo corto", o);
  const cfg = sanitizeConfig(body.cfg || {});
  if (!cfg) return err(400, "configurazione turni non valida", o);

  await env.SUBS.put("pending:" + token, JSON.stringify(cfg), { expirationTtl: 1800 });
  return json({ ok: true }, 200, o);
}
