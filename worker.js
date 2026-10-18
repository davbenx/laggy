// Ingresso del Worker: le rotte di sempre (functions/, compilate in
// dist/worker/ dal build di Cloudflare) più il giro di ogni minuto che manda
// le push dei promemoria della web app (vedi functions/_push.js). Le Pages
// Functions da sole non hanno i "cron": servono qui, accanto a fetch.
import app from "./dist/worker/index.js";
import { inviaDovute } from "./functions/_push.js";

export default {
  fetch: (request, env, ctx) => app.fetch(request, env, ctx),
  scheduled: (event, env, ctx) => ctx.waitUntil(inviaDovute(env).catch(() => {}))
};
