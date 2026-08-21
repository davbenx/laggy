// GET /claim/<token> — il client lo interroga dopo il checkout, finché il
// webhook non ha fatto il suo lavoro (di solito pochi secondi, mai garantito
// immediato — il client deve riprovare con un piccolo ritardo, non una volta sola).
// 202 = non ancora pronto; 200 = ecco le credenziali, prelevate una sola volta.
import { cfgEnv, json, err, cors } from "../_lib.js";

export async function onRequestOptions({ env }) {
  return new Response(null, { status: 204, headers: cors(cfgEnv(env).origin) });
}

export async function onRequestGet({ params, env }) {
  const o = cfgEnv(env).origin;
  if (!env.SUBS) return err(503, "servizio non configurato", o);

  const raw = await env.SUBS.get("claim:" + params.token);
  if (!raw) return json({ ready: false }, 202, o);

  const data = JSON.parse(raw);
  await env.SUBS.delete("claim:" + params.token);   // un solo prelievo: non deve restare leggibile da chi ha solo il token
  return json({ ready: true, ...data }, 200, o);
}
