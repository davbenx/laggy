import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b = await pw.chromium.launch();
const ctx = await b.newContext({ viewport:{width:390,height:844}, colorScheme:"dark" });
await ctx.addInitScript(() => {
  const L = {}; const log = window.__log = [];
  const on = (n) => (ev, cb) => { L[n+":"+ev] = cb; return Promise.resolve({ remove(){} }); };
  const cal = window.__cal = { cals: {}, ev: {}, next: 1 };
  window.Capacitor = { isNativePlatform: () => true, getPlatform: () => "android", Plugins: {
    LocalNotifications: { checkPermissions: async()=>({display:"granted"}), requestPermissions: async()=>({display:"granted"}),
      checkExactNotificationSetting: async()=>({exact_alarm:"granted"}), getPending: async()=>({notifications:[]}),
      schedule: async(o)=>{ log.push(["LN.schedule", o.notifications.length]); return {}; }, cancel: async()=>({}), createChannel: async()=>({}), addListener: on("LN") },
    App: { getLaunchUrl: async()=>({}), addListener: on("App"), minimizeApp: async()=>{ log.push(["App.minimizeApp"]); } },
    SystemBars: { setStyle: async(o)=>{ log.push(["SystemBars.setStyle", o.style]); } },
    Share: { share: async(o)=>{ log.push(["Share.share", o.url]); return {}; } },
    NTWidget: { publish: async(o)=>{ const d=JSON.parse(o.json); log.push(["NTWidget.publish", d.voci.length, d.voci[0] && d.voci[0].t]); return {widgets:1}; } },
    CapacitorCalendar: {
      checkAllPermissions: async()=>({result:{readCalendar:"granted",writeCalendar:"granted"}}),
      requestAllPermissions: async()=>({result:{readCalendar:"granted",writeCalendar:"granted"}}),
      listCalendars: async()=>({result:Object.keys(cal.cals).map(id=>({id, title:cal.cals[id]}))}),
      createCalendar: async(o)=>{ const id=String(cal.next++); cal.cals[id]=o.title; log.push(["Cal.createCalendar", o.title]); return {id}; },
      deleteCalendar: async(o)=>{ delete cal.cals[o.id]; log.push(["Cal.deleteCalendar", o.id]); },
      createEvent: async(o)=>{ const id=String(cal.next++); cal.ev[id]=o; return {id}; },
      deleteEventsById: async(o)=>{ o.ids.forEach(i=>delete cal.ev[i]); log.push(["Cal.deleteEventsById", o.ids.length]); return {result:{deleted:o.ids,failed:[]}}; },
      openCalendar: async()=>{ log.push(["Cal.openCalendar"]); }
    } } };
  window.__fire = (k, v) => L[k] && L[k](v);
});
const p = await ctx.newPage(); const errs=[]; p.on("pageerror",e=>errs.push(e.message));
await p.goto("http://localhost:8766/index.html"); await p.waitForTimeout(1500);
const lg = () => p.evaluate(()=>window.__log.map(x=>x.join(" ")));
// chiudi il dialogo di recupero e scegli un turno
await p.evaluate(()=>{ const d=document.querySelector("body > [role=dialog] [data-x]"); d&&d.click(); });
await p.click("[data-pick=N]"); await p.click("#qhConfermaOrario"); await p.waitForTimeout(2500);
let l = await lg();
ok(l.some(x=>x.startsWith("SystemBars.setStyle DARK")), "barre di sistema: icone chiare su tema scuro");
ok(l.some(x=>/^NTWidget.publish [1-9]/.test(x)), "widget aggiornato: "+l.filter(x=>x.startsWith("NTWidget")).pop());
// safe area
await p.evaluate(()=>document.documentElement.style.setProperty("--safe-area-inset-top","32px"));
const padTop = await p.evaluate(()=>getComputedStyle(document.querySelector(".apphead")||document.querySelector("header")).paddingTop);
ok(parseFloat(padTop)>=44, "margine barra di stato applicato all'intestazione: "+padTop);
// font locali
const fonts = await p.evaluate(async()=>{ await document.fonts.ready; return [...document.fonts].filter(f=>f.status==="loaded").map(f=>f.family).join(","); });
ok(/Inter/.test(fonts), "font caricati in locale: "+fonts);
// calendario nativo
await p.evaluate(()=>document.querySelector("#doOpzioni").click());
await p.waitForTimeout(400);
await p.evaluate(()=>document.querySelector('#opzFunzioni [data-gestisci="calendario"]').click());
await p.waitForTimeout(2500);
let cal = await p.evaluate(()=>({ cals:Object.values(window.__cal.cals), n:Object.keys(window.__cal.ev).length, ui:document.querySelector('#opzFunzioni [data-gestisci="calendario"]').innerText.slice(0,90), turno:Object.values(window.__cal.ev).find(e=>/Turno/.test(e.title)) }));
ok(cal.cals.includes("Notturnisti") && cal.n>0 && /telefono/.test(cal.ui), "calendario creato sul telefono: "+JSON.stringify(cal.cals)+", "+cal.n+" eventi, UI "+JSON.stringify(cal.ui));
ok(cal.turno && cal.turno.availability===0 && !cal.turno.alerts, "turno = occupato, nessun promemoria doppio");
// cambio turno → riscrittura
await p.evaluate(()=>{ [...document.querySelectorAll("#tabbar button")].find(b=>/Oggi/.test(b.textContent)).click(); });
await p.click("#shiftPill"); await p.waitForTimeout(300); await p.click("#qsGrid [data-qs=M]"); await p.waitForTimeout(3500);
l = await lg(); const cal2 = await p.evaluate(()=>Object.values(window.__cal.ev).filter(e=>/Turno/.test(e.title)).map(e=>e.title));
ok(l.some(x=>x.startsWith("Cal.deleteEventsById")) && cal2[0]==="Turno Mattino", "cambio turno → calendario riscritto: "+cal2.slice(0,2).join(", "));
// tasto indietro
await p.click("#shiftPill"); await p.waitForTimeout(300);
await p.evaluate(()=>window.__fire("App:backButton", {canGoBack:false})); await p.waitForTimeout(200);
ok(await p.evaluate(()=>document.querySelector("#quickShiftModal").hidden), "indietro chiude il pannello del turno");
await p.evaluate(()=>{ [...document.querySelectorAll("#tabbar button")].find(b=>/Turni/.test(b.textContent)).click(); });
await p.evaluate(()=>window.__fire("App:backButton", {canGoBack:false})); await p.waitForTimeout(200);
ok(await p.evaluate(()=>document.body.classList.contains("tab-oggi")), "indietro da Turni torna a Oggi");
await p.evaluate(()=>window.__fire("App:backButton", {canGoBack:false})); await p.waitForTimeout(200);
ok((await lg()).includes("App.minimizeApp"), "indietro da Oggi manda l'app in secondo piano");
// condivisione
await p.evaluate(()=>document.querySelector("#doCycShare").click()); await p.waitForTimeout(500);
ok((await lg()).some(x=>/^Share\.share https:\/\/app\.notturnisti\.club\/#/.test(x)), "«Invita un collega» (Turni) apre il pannello nativo con il link all'app e il proprio ciclo: "+(await lg()).filter(x=>x.startsWith("Share")).pop());
await p.evaluate(()=>document.querySelector("#doShare").click()); await p.waitForTimeout(500);
ok(/^Share\.share https:\/\/app\.notturnisti\.club\/(\s|$)/.test((await lg()).filter(x=>x.startsWith("Share")).pop()||""), "«Consiglia Notturnisti» (Impostazioni) manda il link all'app, senza i propri turni: "+(await lg()).filter(x=>x.startsWith("Share")).pop());
// disattiva calendario
await p.evaluate(()=>document.querySelector("#doOpzioni").click()); await p.waitForTimeout(300);
p.once("dialog", d=>d.accept());
await p.evaluate(()=>document.querySelector('#opzFunzioni [data-gestisci="calendario"]').click()); await p.waitForTimeout(800);
ok(await p.evaluate(()=>Object.keys(window.__cal.cals).length===0), "spegnendo, il calendario viene rimosso dal telefono");
console.log("errori pagina:", errs);
await b.close();
