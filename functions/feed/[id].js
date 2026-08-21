// GET /feed/<id> — il calendario "vivo", protetto: esce solo se l'id è di un
// abbonamento attivo. L'id è la capacità di lettura (lungo e non indovinabile),
// come l'indirizzo ICS privato di Google. La config vive in KV, quindi il
// calendario segue le modifiche dei turni senza ri-iscriversi.
import { buildFeed, readSub, isActive } from "../_lib.js";

// suggerisce ai calendari ogni quanto ripollare
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

  let ics;
  try {
    ics = withRefresh(buildFeed(sub.cfg, {
      days: 42,
      ics: { turni: true, sonno: true, pisolini: true, caffe: true, luce: true, rientro: true, pasti: false, avviso: sub.avviso ?? 30 }
    }));
  } catch (e) {
    return new Response("Configurazione non valida.", { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } });
  }

  return new Response(ics, {
    status: 200,
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="notturnisti.ics"',
      "cache-control": "public, max-age=3600",
      "x-robots-tag": "noindex, nofollow",
      "referrer-policy": "no-referrer"
    }
  });
}
