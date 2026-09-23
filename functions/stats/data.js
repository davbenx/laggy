// GET /stats/data?days=30 — i contatori aggregati per la pagina /stats.
// Protetto da STATS_TOKEN (secret del Worker: `wrangler secret put STATS_TOKEN`),
// passato come "Authorization: Bearer …", mai nell'URL (finirebbe nei log).
import { readStats } from "../_analytics.js";
import { ctEqual } from "../_lib.js";

const H = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" };
const out = (status, data) => new Response(JSON.stringify(data), { status, headers: H });

export async function onRequestGet({ env, request }) {
  if (!env.STATS_TOKEN) return out(503, { error: "STATS_TOKEN non impostato sul Worker" });
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || !ctEqual(token, env.STATS_TOKEN)) return out(401, { error: "token mancante o errato" });
  if (!env.DB) return out(503, { error: "database D1 (binding DB) non collegato" });

  const days = Math.min(Math.max(parseInt(new URL(request.url).searchParams.get("days"), 10) || 30, 1), 400);
  try {
    return out(200, { days, ...(await readStats(env, days)) });
  } catch (e) {
    return out(500, { error: "lettura non riuscita" });
  }
}
