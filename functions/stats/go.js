// GET /stats/go?days=30 — i passaggi /go/<codice>, con lo stesso codice di /stats/data
// (Authorization: Bearer …). Giorni sotto la soglia: solo nei totali settimanali.
import { leggiGo } from "../_go.js";
import { statsAutorizzato } from "../_lib.js";

const H = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" };
const out = (status, data) => new Response(JSON.stringify(data), { status, headers: H });

export async function onRequestGet({ env, request }) {
  const a = await statsAutorizzato(env, request);
  if (a) return out(a.status, { error: a.error });
  if (!env.DB) return out(503, { error: "database D1 (binding DB) non collegato" });
  const days = Math.min(Math.max(parseInt(new URL(request.url).searchParams.get("days"), 10) || 30, 1), 400);
  try { return out(200, { days, ...(await leggiGo(env, days)) }); }
  catch (e) { return out(500, { error: "lettura non riuscita" }); }
}
