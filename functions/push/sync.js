// POST /push/sync {endpoint, orari:[ms…]} — gli orari dei prossimi promemoria
// (solo orari: niente testi né turni), sostituiti in blocco. Vedi _push.js.
// POST /push/sync {endpoint, stop:true} — spegne: iscrizione e orari via.
import { sincronizza, cancella, MAX_ORARI } from "../_push.js";

const R = (s, o) => new Response(o ? JSON.stringify(o) : null, { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export async function onRequestPost({ env, request }) {
  let b;
  try { const t = await request.text(); if (t.length > 8192) return R(413); b = JSON.parse(t); } catch (e) { return R(400); }
  if (!b || typeof b.endpoint !== "string") return R(400);
  if (b.stop) { await cancella(env, b.endpoint); return R(200, { ok: true }); }
  if (!Array.isArray(b.orari) || b.orari.length > MAX_ORARI * 2) return R(400);
  const n = await sincronizza(env, b.endpoint, b.orari);
  return n === false ? R(400) : R(200, { ok: true, orari: n });
}
