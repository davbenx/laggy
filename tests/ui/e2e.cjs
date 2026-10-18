const { chromium } = require(require("child_process").execSync("npm root -g").toString().trim()+"/playwright");
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext();
  await ctx.grantPermissions(["notifications"], { origin: "http://localhost:8765" });
  await ctx.addInitScript(() => { try { Object.defineProperty(Notification, "permission", { get: () => "granted" }); } catch (e) {} });
  const p = await ctx.newPage();
  const errs = [], posts = [];
  // Le finestre di prova sono "in incognito": lì Chrome rifiuta le push e lo
  // scrive da sé in console (non si può rilevare prima). Non è un errore dell'app.
  p.on("console", m => { if (m.type() === "error" && !/Push API in incognito/.test(m.text())) errs.push(m.text()); });
  p.on("pageerror", e => errs.push("PAGEERROR " + e.message));
  // API delle push (server vero solo in produzione): qui una finta, il resto del flusso è vero.
  await ctx.route("**/push/key", r => r.fulfill({ contentType: "application/json", body: JSON.stringify({ key: "BFbDN3WLhHfuy9WzTiEnlBomE0rIAr9URfx7Jow-g1u5gk_eRZ9rEWB2TEMsJWK6ZlkIqrg83WDoVWHj2xa4B6I" }) }));
  await ctx.route("**/push/sync", r => r.fulfill({ contentType: "application/json", body: "{\"ok\":true}" }));
  await ctx.route("**/collect", async r => { const buf = r.request().postDataBuffer(); posts.push(buf ? buf.toString() : null); await r.fulfill({ status: 204 }); });
  await p.goto("http://localhost:8765/index.html");
  await p.waitForTimeout(2500);
  await p.reload(); await p.waitForTimeout(3000); // ora il SW controlla la pagina
  const info = await p.evaluate(async () => ({
    platform: window.NTPlatform && window.NTPlatform.name,
    days: window.NTPlatform && window.NTPlatform.notify.days,
    perm: await window.NTPlatform.notify.permission(), rawPerm: Notification.permission,
    ctrl: !!navigator.serviceWorker.controller,
    stats: document.querySelector("#optStats") && document.querySelector("#optStats").checked,
    jsoff: !!document.querySelector("#jsoff"),
  }));
  // intercetta l'ACK del SW per verificare che il piano notifiche arrivi
  const ack = await p.evaluate(() => new Promise(res => {
    navigator.serviceWorker.addEventListener("message", e => { if (e.data && e.data.type === "NT_SCHEDULE_ACK") res(e.data.count); });
    window.dispatchEvent(new Event("nt:config-changed"));
    setTimeout(() => res("timeout"), 3000);
  }));
  const before = posts.length;
  const optout = await p.evaluate(() => { const cb = document.querySelector("#optStats"); cb.checked = false; cb.dispatchEvent(new Event("change")); window.NTAnalytics.track("today_viewed"); return window.NTAnalytics.isEnabled(); });
  await p.waitForTimeout(500);
  console.log("optout enabled=", optout, "nuovi post dopo opt-out:", posts.length - before);
  console.log((ack>0?"✔ ":"✘ ")+"notifiche web: il service worker ha armato "+ack+" promemoria"); console.log((errs.length===0?"✔ ":"✘ ")+"nessun errore nella pagina"+(errs.length?": "+errs.join(" | "):""));
  console.log(JSON.stringify({ info, ack, errs, posts: posts.slice(0, 5) }, null, 1));
  await b.close();
})();
