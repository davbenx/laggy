// _lib.js — utilità condivise dalle Pages Functions (il prefisso _ = non è una rotta).
// Una sola sorgente di verità per il motore: qui si importa e si ri-espone engine.js.
import { buildFeed, buildCoupleFeed, parseConfig } from "../engine.js";
export { buildFeed, buildCoupleFeed, parseConfig };

// ── SEGNAPOSTO: impostalo come variabile d'ambiente sul progetto Pages ──
// SITE_ORIGIN (il dominio dell'app, es. "https://app.notturnisti.club" — NON
// il sito notturnisti.club, che è un dominio diverso e non chiama questi
// endpoint), e il binding KV: SUBS.
export function cfgEnv(env) {
  return {
    // Se SITE_ORIGIN non è impostata su Cloudflare Pages, NON aprire a "*":
    // /config/<id> accetta PUT/DELETE, quindi un CORS aperto a qualunque
    // origine è una configurazione che non deve poter capitare per errore.
    // Il fallback resta ristretto al dominio dell'app stessa.
    origin: env.SITE_ORIGIN || "https://app.notturnisti.club"
  };
}

// ── id e chiavi (base64url da byte casuali) ──
function b64url(bytes) {
  let s = ""; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function genId()  { return b64url(crypto.getRandomValues(new Uint8Array(16))); } // ~22 char, pubblico (sola lettura)
export function genKey() { return b64url(crypto.getRandomValues(new Uint8Array(32))); } // ~43 char, segreto (scrittura)

// confronto a tempo costante (per la writeKey)
export function ctEqual(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export const nowSec = () => Math.floor(Date.now() / 1000);
export const isActive = sub => !!(sub && sub.paid && (!sub.expiry || sub.expiry > nowSec()));

// ── rate limiting best-effort (finestra fissa, per IP, su KV) ──
// KV non ha un incremento atomico: sotto raffiche concorrenti dalla stessa IP
// il conteggio può sottostimare di qualche richiesta. Non è una difesa da sola
// (Cloudflare fa già mitigazione DDoS a livello di edge), ma alza il costo di
// abuso applicativo su endpoint pubblici senza altra protezione — riempire il
// KV di accessi gratuiti creando "/account" a raffica, ad esempio.
export async function rateLimit(env, request, bucket, limit, windowSec) {
  if (!env.SUBS) return true; // fail-open: se il KV manca, non è compito del rate limiter bloccare
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const key = "rl:" + bucket + ":" + ip;
  const raw = await env.SUBS.get(key);
  const count = raw ? parseInt(raw, 10) || 0 : 0;
  if (count >= limit) return false;
  await env.SUBS.put(key, String(count + 1), { expirationTtl: windowSec });
  return true;
}

// ── KV ──
export async function readSub(env, id) {
  if (!env.SUBS) throw new Error("KV binding SUBS mancante");
  const raw = await env.SUBS.get("sub:" + id);
  return raw ? JSON.parse(raw) : null;
}
export async function writeSub(env, id, sub) {
  await env.SUBS.put("sub:" + id, JSON.stringify(sub));
}

// config: accetta l'oggetto-parametri del planner (p,a,s,w,wb,cs,...), lo valida
// con lo STESSO parseConfig del browser/feed, e restituisce la config del motore.
export function sanitizeConfig(obj) {
  const params = new URLSearchParams();
  for (const k of ["p","a","s","w","wb","cs","n","ct","cf","pr","adv","rep","pp","pa","ps","pw","pwb"]) {
    if (obj && obj[k] != null && obj[k] !== "") params.set(k, String(obj[k]));
  }
  if (!params.get("p")) return null;             // senza pattern non c'è piano
  const cfg = parseConfig(params);
  return cfg && cfg.pattern ? cfg : null;
}

// ── risposte JSON + CORS ──
export function cors(origin) {
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400"
  };
}
export function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...cors(origin || "*") }
  });
}
export const err = (status, msg, origin) => json({ error: msg }, status, origin);
