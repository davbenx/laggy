// GET /stats/data?days=30 — i contatori aggregati per la pagina /stats.
// Protetto da un codice passato come "Authorization: Bearer …", mai nell'URL
// (finirebbe nei log). Il Worker conosce solo la sua impronta SHA-256
// (STATS_TOKEN_SHA256, in wrangler.jsonc) oppure, in alternativa, il codice
// stesso come secret (STATS_TOKEN).
import { readStats } from "../_analytics.js";
import { statsAutorizzato } from "../_lib.js";

const H = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" };
const out = (status, data) => new Response(JSON.stringify(data), { status, headers: H });

export async function onRequestGet({ env, request }) {
  const a = await statsAutorizzato(env, request);
  if (a) return out(a.status, { error: a.error });
  if (!env.DB) return out(503, { error: "database D1 (binding DB) non collegato" });

  const days = Math.min(Math.max(parseInt(new URL(request.url).searchParams.get("days"), 10) || 30, 1), 400);
  try {
    return out(200, { days, ...(await readStats(env, days)) });
  } catch (e) {
    return out(500, { error: "lettura non riuscita" });
  }
}
