// _lib.js — utilità condivise dalle Pages Functions (il prefisso _ = non è una rotta).
// Una sola sorgente di verità per il motore: qui si importa e si ri-espone engine.js.
import { buildFeed, buildCoupleFeed, parseConfig } from "../engine.js";
export { buildFeed, buildCoupleFeed, parseConfig };

// ── SEGNAPOSTO: impostali come variabili d'ambiente sul progetto Pages ──
// LEMONSQUEEZY_WEBHOOK_SECRET (dalla dashboard, sezione Webhooks),
// LEMONSQUEEZY_STORE_ID, LEMONSQUEEZY_VARIANT_ID (l'id del prodotto/variante),
// PRICE (es. "24.99", solo per la vetrina — il prezzo vero vive sul prodotto
// Lemon Squeezy stesso), CURRENCY ("EUR"), SITE_ORIGIN (es. "https://notturnisti.club"),
// e il binding KV: SUBS.
export function cfgEnv(env) {
  return {
    lsSecret: env.LEMONSQUEEZY_WEBHOOK_SECRET || "LEMONSQUEEZY_WEBHOOK_SECRET_PLACEHOLDER",
    lsStoreId: env.LEMONSQUEEZY_STORE_ID || "",
    lsVariantId: env.LEMONSQUEEZY_VARIANT_ID || "",
    price: env.PRICE || "24.99",
    currency: env.CURRENCY || "EUR",
    origin: env.SITE_ORIGIN || "*"
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

// hash SHA-256 esadecimale (per mappare l'email SENZA salvarla in chiaro)
export async function sha256hex(s) {
  const data = new TextEncoder().encode(String(s || "").trim().toLowerCase());
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
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

// ── Lemon Squeezy: verifica lato server che il webhook sia autentico ──
// Lemon Squeezy firma ogni webhook con HMAC-SHA256 sul corpo GREZZO della
// richiesta (prima di qualunque parsing), usando il secret impostato nella
// dashboard (Settings → Webhooks). La firma arriva nell'header
// X-Signature, in esadecimale. Verificare PRIMA di leggere il contenuto:
// un corpo non firmato correttamente non va mai fidato, qualunque cosa dica.
export async function lemonSqueezyVerify(e, rawBody, signatureHeader) {
  if (!signatureHeader) return false;
  if (e.lsSecret.indexOf("PLACEHOLDER") >= 0) return false;   // non ancora configurato: mai accettare
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(e.lsSecret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const hex = [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, "0")).join("");
  return ctEqual(hex, signatureHeader);
}
