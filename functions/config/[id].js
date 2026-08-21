// /config/<id> — leggere, aggiornare o cancellare la configurazione dei turni.
// Richiede la writeKey (che solo chi ha pagato possiede). È ciò che rende il
// calendario "vivo": la griglia di inserimento rapido dell'app scrive qui, e il
// feed la rilegge. L'id da solo NON basta per scrivere: serve la writeKey.
import { readSub, writeSub, sanitizeConfig, ctEqual, isActive, cfgEnv, json, err, cors, nowSec } from "../_lib.js";

function auth(request, sub) {
  const key = request.headers.get("x-write-key") || "";
  return sub && sub.writeKey && ctEqual(key, sub.writeKey);
}

export async function onRequestOptions({ env }) {
  return new Response(null, { status: 204, headers: cors(cfgEnv(env).origin) });
}

// GET: restituisce la config attuale (per far editare all'app). Serve la writeKey.
export async function onRequestGet({ params, env, request }) {
  const o = cfgEnv(env).origin;
  const sub = await readSub(env, params.id);
  if (!sub) return err(404, "non trovato", o);
  if (!auth(request, sub)) return err(401, "writeKey mancante o errata", o);
  return json({ cfg: sub.cfg, active: isActive(sub), expiry: sub.expiry || null, avviso: sub.avviso ?? 30 }, 200, o);
}

// PUT: aggiorna i turni (e opzionalmente l'anticipo avviso).
export async function onRequestPut({ params, env, request }) {
  const o = cfgEnv(env).origin;
  const sub = await readSub(env, params.id);
  if (!sub) return err(404, "non trovato", o);
  if (!auth(request, sub)) return err(401, "writeKey mancante o errata", o);

  let body; try { body = await request.json(); } catch (e) { return err(400, "JSON non valido", o); }
  const cfg = sanitizeConfig(body.cfg || body);
  if (!cfg) return err(400, "configurazione turni non valida", o);

  sub.cfg = cfg;
  if (Number.isFinite(+body.avviso)) sub.avviso = Math.max(0, Math.min(240, +body.avviso));
  sub.updated = nowSec();
  await writeSub(env, params.id, sub);
  return json({ ok: true, updated: sub.updated }, 200, o);
}

// DELETE: cancella l'abbonamento (pulizia / GDPR).
export async function onRequestDelete({ params, env, request }) {
  const o = cfgEnv(env).origin;
  const sub = await readSub(env, params.id);
  if (!sub) return json({ ok: true }, 200, o);          // idempotente
  if (!auth(request, sub)) return err(401, "writeKey mancante o errata", o);
  await env.SUBS.delete("sub:" + params.id);
  return json({ ok: true, deleted: true }, 200, o);
}
