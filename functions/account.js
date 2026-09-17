// POST /account — crea l'accesso gratuito al calendario che si aggiorna da
// solo. Prima ci si arrivava solo dopo un pagamento verificato (via /pending
// + webhook Lemon Squeezy + /claim); ora l'app è gratis per chiunque, quindi
// l'accesso si crea qui, subito, senza intermediari: il client manda la
// configurazione turni e riceve le credenziali nella stessa risposta.
import { cfgEnv, sanitizeConfig, genId, genKey, writeSub, json, err, cors, rateLimit, nowSec } from "./_lib.js";

export async function onRequestOptions({ env }) {
  return new Response(null, { status: 204, headers: cors(cfgEnv(env).origin) });
}

export async function onRequestPost({ env, request }) {
  const o = cfgEnv(env).origin;
  if (!env.SUBS) return err(503, "servizio non configurato", o);
  // Senza un pagamento a fare da freno naturale, un limite più stretto qui:
  // un utente reale ne crea uno solo per dispositivo, mai a raffica.
  if (!(await rateLimit(env, request, "account", 8, 600))) return err(429, "troppe richieste, riprova tra poco", o);

  let body; try { body = await request.json(); } catch (_) { return err(400, "JSON non valido", o); }
  const cfg = sanitizeConfig(body.cfg || {});
  if (!cfg) return err(400, "configurazione turni non valida", o);

  const id = genId(), writeKey = genKey(), t = nowSec();
  // "paid"/"expiry" restano dal vecchio modello (isActive() li legge ancora
  // per /feed e /couple) — qui significano solo "accesso attivo", non più
  // "ha pagato": ogni accesso gratuito nasce già attivo, per sempre.
  const sub = { paid: true, plan: "free", expiry: null, cfg, avviso: 30, writeKey, source: "free", created: t, updated: t };
  await writeSub(env, id, sub);

  const feedUrl = new URL(request.url).origin.replace(/^https?/, "webcal") + "/feed/" + id;
  return json({ id, writeKey, feedUrl }, 200, o);
}
