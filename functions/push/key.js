// GET /push/key — la chiave pubblica VAPID, per iscriversi alle push.
import { vapid } from "../_push.js";
export async function onRequestGet({ env }) {
  const v = await vapid(env);
  return new Response(JSON.stringify({ key: v.pub }), { headers: { "content-type": "application/json", "cache-control": "public, max-age=3600" } });
}
