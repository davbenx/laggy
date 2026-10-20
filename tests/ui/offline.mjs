// Senza rete (sotterraneo dell'ospedale, aereo): l'app si apre lo stesso,
// anche dopo che il telefono ha fermato il service worker. E dopo un rilascio
// pagina e script arrivano nella stessa versione (rete prima, non cache).
// Senza questa variabile Playwright non intercetta le richieste fatte dal service worker.
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = "1";
import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const ctx=await b.newContext({locale:"it-IT",viewport:{width:360,height:740}});
const p=await ctx.newPage(); const errs=[]; p.on("pageerror",e=>errs.push(e.message));
await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(2500);
await p.click("text=Conosco già il mio schema"); await p.click("[data-preset-ob='0']"); await p.click("[data-pos='0']"); await p.click("#qhConfermaOrari"); await p.waitForTimeout(800);
await p.reload(); await p.waitForTimeout(2500);
const ctrl=await p.evaluate(()=>!!navigator.serviceWorker.controller);
const cdp=await ctx.newCDPSession(p);
await ctx.setOffline(true);
await cdp.send("ServiceWorker.enable"); await cdp.send("ServiceWorker.stopAllWorkers");   // il telefono ferma il SW
await p.reload().catch(e=>errs.push("reload: "+e.message.split("\n")[0])); await p.waitForTimeout(3000);
const r=await p.evaluate(()=>({ partita:!document.querySelector("#jsoff"), piano:!!document.querySelector("#doOpzioni") && document.body.innerText.length>300, t:document.body.innerText.slice(0,80) })).catch(e=>({err:e.message}));
ok(ctrl && r.partita && r.piano, "offline, service worker riavviato: l'app si apre con il piano → "+JSON.stringify(r).slice(0,120));
await p.click('[data-tab="turni"]').catch(()=>{}); await p.waitForTimeout(500);
ok(await p.evaluate(()=>document.querySelectorAll("#cyc .crow, .crow").length>0).catch(()=>false), "offline: anche Turni funziona");
await ctx.setOffline(false);
// rilascio simulato: lo script cambia sul server, la pagina deve riceverlo al primo avvio
await ctx.route("**/lingua.js", async r=>{ const res=await r.fetch(); await r.fulfill({response:res, body:(await res.text())+"\nwindow.__versioneNuova=1;"}); });
await p.reload(); await p.waitForTimeout(2500);
ok(await p.evaluate(()=>window.__versioneNuova===1), "dopo un rilascio, il primo avvio usa già gli script nuovi (non quelli in cache)");
ok(errs.length===0, "nessun errore"+(errs.length?": "+errs.slice(0,2).join(" | "):""));
await b.close();
