// GET /couple/<id> — il calendario "insieme": eventi tutto-il-giorno sui riposi in
// comune con il partner. Stesso gate del feed personale. Richiede che nella config
// dell'abbonamento sia impostato il partner (pPattern/pAnchor).
import { buildCoupleFeed, readSub, isActive } from "../_lib.js";

function withRefresh(ics) {
  return ics.replace("VERSION:2.0\r\n",
    "VERSION:2.0\r\nREFRESH-INTERVAL;VALUE=DURATION:PT12H\r\nX-PUBLISHED-TTL:PT12H\r\n");
}

export async function onRequestGet({ params, env }) {
  let sub;
  try { sub = await readSub(env, params.id); }
  catch (e) { return new Response("Servizio non configurato.", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } }); }

  if (!sub) return new Response("Calendario non trovato.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  if (!isActive(sub)) return new Response("Abbonamento non attivo o scaduto.", { status: 402, headers: { "content-type": "text/plain; charset=utf-8" } });
  if (!sub.cfg || !sub.cfg.pPattern) return new Response("Partner non configurato.", { status: 409, headers: { "content-type": "text/plain; charset=utf-8" } });

  let ics;
  try { ics = withRefresh(buildCoupleFeed(sub.cfg, { days: 60 })); }
  catch (e) { return new Response("Configurazione non valida.", { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } }); }

  return new Response(ics, {
    status: 200,
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="notturnisti-insieme.ics"',
      "cache-control": "public, max-age=3600",
      "x-robots-tag": "noindex, nofollow",
      "referrer-policy": "no-referrer"
    }
  });
}
