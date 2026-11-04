// GET /go/<codice> — conta un passaggio dai social e rimanda all'app (vedi _go.js).
import { codiceGo, eBot, destinazioneGo, registraGo } from "../_go.js";

export async function onRequestGet({ env, request, params, waitUntil }) {
  const ua = request.headers.get("user-agent") || "";
  const code = codiceGo(params && params.code);
  if (!eBot(ua)) {
    const p = registraGo(env, code).catch(() => {});   // una statistica non deve mai bloccare il rimando
    if (typeof waitUntil === "function") waitUntil(p); else await p;
  }
  return new Response(null, { status: 302, headers: {
    location: destinazioneGo(env, ua, code),
    "cache-control": "no-store",          // ogni passaggio arriva al Worker, non a una copia in cache
    "referrer-policy": "no-referrer",
    "x-robots-tag": "noindex"
  } });
}
