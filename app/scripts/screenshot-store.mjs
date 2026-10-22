// Screenshot del Play Store (1080×1920): l'app vera, a tema scuro, dentro una
// cornice di telefono con il titolo sopra. Da rilanciare quando l'interfaccia
// cambia:  node app/scripts/screenshot-store.mjs   (scrive in docs/play/img/)
// Serve Playwright con Chromium (come tests/ui).
import http from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, extname } from "node:path";
import pw from "../../tests/ui/_pw.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(ROOT, "docs", "play", "img");
const TIPI = { ".html":"text/html", ".js":"text/javascript", ".mjs":"text/javascript", ".css":"text/css", ".png":"image/png",
  ".woff2":"font/woff2", ".json":"application/json", ".webmanifest":"application/manifest+json", ".svg":"image/svg+xml" };
const server = http.createServer(async (req, res) => {
  try {
    const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const f = join(ROOT, p.endsWith("/") ? p + "index.html" : p);
    if (!f.startsWith(ROOT)) throw 0;
    const dati = await readFile(f);
    res.writeHead(200, { "content-type": TIPI[extname(f)] || "application/octet-stream", "access-control-allow-origin": "*" });
    res.end(dati);
  } catch (e) { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const URL0 = "http://127.0.0.1:" + server.address().port + "/index.html";

const iso = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const fa = n => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return iso(d); };
const SAN = { M:{n:"Mattino",s:420,e:840}, P:{n:"Pomeriggio",s:840,e:1260}, N:{n:"Notte",s:1260,e:1860} };
const BASE = { turniConfigurati:true, pattern:"MPNSR", anchor:fa(0), shifts:SAN, repeat:true, firstSeenAt:fa(40) };
const QUIETI = { "nt:firstPlanBannerChiuso":"true", "nt:attivazioneNascosta":"true", "nt:analytics-consent":"false",
  "nt:backupDone":"true", "nt:invitoVisto":JSON.stringify(iso(new Date())), "nt:loSapevi":JSON.stringify({chiuso:iso(new Date())}) };

const b = await pw.chromium.launch();
async function app(stato, extra = {}) {
  const ctx = await b.newContext({ locale:"it-IT", viewport:{ width:390, height:693 }, deviceScaleFactor:2, colorScheme:"dark" });
  await ctx.addInitScript(([st, ex]) => {
    if (sessionStorage.getItem("x")) return; sessionStorage.setItem("x", "1");
    if (st) { localStorage.setItem("nt:state", JSON.stringify(st)); localStorage.setItem("nt:turniConfigurati", "true"); }
    for (const k in ex) localStorage.setItem(k, ex[k]);
  }, [stato, extra]);
  const p = await ctx.newPage();
  // Orologio fermo alle 10 del mattino: un piano tipico, non quello dell'ora in cui si lancia lo script.
  const dieci = new Date(); dieci.setHours(10, 0, 0, 0);
  await p.clock.setFixedTime(dieci);
  await p.goto(URL0); await p.waitForTimeout(1200);
  return p;
}
const clic = (p, s) => p.evaluate(s => document.querySelector(s).click(), s);
const SCATTI = [
  ["01-oggi", "Il tuo piano di oggi,", "sul tuo turno", async () => app(BASE, QUIETI)],
  ["02-turni", "Tutta la settimana", "a colpo d'occhio", async () => { const p = await app(BASE, QUIETI); await clic(p, '[data-tab="turni"]'); return p; }],
  ["03-onboarding", "Che turno fai oggi?", "Un tocco e hai il piano", async () => app(null, {})],
  ["04-perche", "Ogni consiglio", "spiegato, senza misteri", async () => {
    const p = await app(BASE, QUIETI);
    await p.evaluate(() => { const d = document.querySelector('#essenziale details[data-row="luce"]'); d.open = true;
      window.scrollTo(0, d.getBoundingClientRect().top + scrollY - 70); });
    return p; }],
  ["05-orologio", "Il tuo orologio,", "calcolato su di te", async () => {
    const p = await app({ ...BASE, freeBed:"00:30", freeWake:"09:00" }, QUIETI);
    await clic(p, '[data-tab="turni"]'); await clic(p, "#doAndamenti");
    await p.evaluate(() => { const o = document.querySelector("#orologio"); window.scrollTo(0, o.getBoundingClientRect().top + scrollY - 70); });
    return p; }],
  ["06-liberi", "Il tuo tempo libero,", "per chi ti aspetta", async () => {
    const p = await app(BASE, QUIETI); await clic(p, '[data-tab="turni"]'); await clic(p, "#doPartner"); return p; }],
  ["07-scambio", "Cambio turno:", "ti conviene?", async () => {
    const p = await app(BASE, QUIETI); await clic(p, '[data-tab="turni"]'); await clic(p, "#doScambioTurno"); return p; }],
  ["08-mese", "Turni che cambiano?", "Li segni in un minuto", async () => {
    const ecc = {}, seq = ["M","M","P","R","N","N","R","P","M","R","R","P","P","N"];
    for (let i = -24; i <= 12; i++) ecc[fa(-i)] = seq[(i + 24) % seq.length];
    const p = await app({ ...BASE, pattern:"R", anchor:"2000-01-01", repeat:false, ecc }, QUIETI);
    await clic(p, '[data-tab="turni"]'); await clic(p, "#tEdit");
    return p; }],
];

const cornice = (img, riga1, riga2) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:S;src:url(${URL0.replace("index.html","fonts/noto-serif-latin.woff2")}) format("woff2");font-weight:100 900}
html,body{margin:0;width:1080px;height:1920px;overflow:hidden}
body{background:radial-gradient(ellipse 90% 60% at 50% 0%,#233246 0%,#181b21 55%,#121418 100%);font-family:S,serif;color:#ECEDEF}
h1{margin:0;position:absolute;top:118px;left:0;right:0;text-align:center;font-size:86px;font-weight:600;line-height:1.02;letter-spacing:-.5px}
h1 span{display:block;color:#FF8A5B}
h1,h1 span{white-space:nowrap}
.tel{position:absolute;left:150px;top:375px;width:780px;height:1386px;border:10px solid #2a2f37;border-radius:64px;overflow:hidden;
box-shadow:0 40px 90px rgba(0,0,0,.55);background:#14161A}
.tel img{display:block;width:780px;height:1386px}
</style></head><body><h1>${riga1}<span>${riga2}</span></h1><div class="tel"><img src="data:image/png;base64,${img}"></div>
<script>/* Titolo sempre su due righe: se una riga sfora, carattere più piccolo. */
const h=document.querySelector("h1"); let f=86; while(h.scrollWidth>1000 && f>50){ f-=2; h.style.fontSize=f+"px"; }</script></body></html>`;

for (const [nome, r1, r2, fai] of SCATTI) {
  const p = await fai(); await p.waitForTimeout(500);
  const png = (await p.screenshot()).toString("base64");
  await p.context().close();
  const q = await b.newPage({ viewport:{ width:1080, height:1920 } });
  await q.setContent(cornice(png, r1, r2)); await q.waitForTimeout(400);
  await writeFile(join(OUT, nome + ".png"), await q.screenshot());
  await q.close();
  console.log("✔ " + nome);
}
await b.close(); server.close();
