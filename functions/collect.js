// POST /collect — riceve un evento da analytics.js e incrementa un contatore
// giornaliero (vedi _analytics.js per cosa si salva e cosa no). Non salva la
// richiesta, non legge IP né user-agent. Risponde sempre 204: il client non ha
// niente da fare con la risposta, e un errore qui non deve diventare un
// messaggio in app.
import { sanitizeEvent, eventDay, increment } from "./_analytics.js";

const MAX_BODY = 2048;
const NO_CONTENT = () => new Response(null, { status: 204, headers: { "cache-control": "no-store" } });

export async function onRequestPost({ env, request, waitUntil }) {
  let body;
  try {
    const text = await request.text();          // arriva come text/plain (vedi analytics.js)
    if (text.length > MAX_BODY) return NO_CONTENT();
    body = JSON.parse(text);
  } catch (_) { return NO_CONTENT(); }

  const ev = sanitizeEvent(body);
  if (!ev) return NO_CONTENT();
  const p = increment(env, eventDay(body.t), ev.event, ev.prop).catch(() => {});
  if (typeof waitUntil === "function") waitUntil(p); else await p;
  return NO_CONTENT();
}
