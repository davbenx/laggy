import pw from "./_pw.mjs";
const SP=(process.env.OUT||"/tmp");
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const ctx=await b.newContext({viewport:{width:360,height:800},locale:"it-IT"});
await ctx.addInitScript(()=>{ const L={}; const on=n=>(ev,cb)=>{ (L[n+":"+ev]=L[n+":"+ev]||[]).push(cb); return Promise.resolve({remove(){}}); }; window.__pend=[]; window.__pub=null; window.__ch=[];
  window.Capacitor={isNativePlatform:()=>true,getPlatform:()=>"android",Plugins:{
    LocalNotifications:{checkPermissions:async()=>({display:window.__perm||"prompt"}),requestPermissions:async()=>{ window.__perm="granted"; return {display:"granted"}; },checkExactNotificationSetting:async()=>({exact_alarm:"granted"}),getPending:async()=>({notifications:window.__pend}),schedule:async(o)=>{ window.__pend=window.__pend.concat(o.notifications); return {}; },cancel:async(o)=>{ const ids=o.notifications.map(n=>n.id); window.__pend=window.__pend.filter(n=>!ids.includes(n.id)); return {}; },createChannel:async(c)=>{ window.__ch.push(c.id); return {}; },listChannels:async()=>({channels:window.__ch.map(id=>({id,importance:id==="caffe"?0:3}))}),addListener:on("LN")},
    App:{getLaunchUrl:async()=>({}),addListener:on("App"),minimizeApp:async()=>{}}, SystemBars:{setStyle:async()=>{}}, Share:{share:async()=>({})},
    NTWidget:{publish:async(o)=>{ window.__pub=JSON.parse(o.json); return {widgets:1}; },count:async()=>({widgets:1})}}};
  window.__fire=(k,v)=>(L[k]||[]).forEach(f=>f(v)); });
const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
await p.goto("http://localhost:8766/index.html"); await p.waitForTimeout(900);
await p.evaluate(()=>{ const d=document.querySelector("body > [role=dialog] [data-x]"); d&&d.click(); });
await p.click("text=Conosco già il mio schema"); await p.click("[data-preset-ob='0']"); await p.click("[data-pos='0']"); await p.click("#qhConfermaOrari"); await p.waitForTimeout(400);
await p.click("#doChiudiPrimoPiano").catch(()=>{});
await p.click('[data-attiva="notifiche"]'); await p.waitForTimeout(1200);
ok(await p.evaluate(()=>!!document.querySelector("#sceltaNotif")), "prima accensione: compare la scelta Essenziali / Tutti / Scelgo io");
await p.locator("#sceltaNotif .card").screenshot({path:SP+"/n-scelta.png"});
await p.click('[data-scelta="essenziali"]'); await p.waitForTimeout(800);
const k1=await p.evaluate(()=>[...new Set(window.__pend.map(n=>n.extra.kind))].sort());
ok(!k1.includes("coffee") && !k1.includes("wake") && k1.includes("bedtime"), "essenziali: in coda solo i tipi essenziali "+JSON.stringify(k1));
const canali=await p.evaluate(()=>[...new Set(window.__pend.map(n=>n.channelId))]);
ok(canali.every(c=>c!=="promemoria"), "ogni tipo sul suo canale Android "+JSON.stringify(canali));
ok((await p.evaluate(()=>window.__ch)).length>=8, "canali creati: "+(await p.evaluate(()=>window.__ch.join(","))));
// Impostazioni: interruttori per tipo
await p.evaluate(()=>document.querySelector("#doOpzioni").click()); await p.waitForTimeout(400);
await p.click("#opzNotifTipi"); await p.waitForTimeout(200);
const n=await p.evaluate(()=>document.querySelectorAll("[data-ntipo]").length);
ok(n>=9, "Impostazioni → Quali promemoria: un interruttore per tipo ("+n+")");
ok(await p.evaluate(()=>/spento dalle impostazioni del telefono/.test(document.querySelector('[data-ntipo="coffee"]').innerText)), "un canale spento dal telefono si vede accanto al tipo");
await p.click('[data-ntipo="coffee"]'); await p.waitForTimeout(600);
ok(await p.evaluate(()=>window.__pend.some(n=>n.extra.kind==="coffee")), "accendo 'Ultimo caffè' → entra in coda");
await p.locator("#opzFunzioni").screenshot({path:SP+"/n-opz.png"});
// widget: settimana nel payload
const pub=await p.evaluate(()=>window.__pub);
ok(pub && pub.v===2 && pub.giorni.length===7 && pub.giorni[0].g==="oggi", "widget: 7 giorni nel payload "+JSON.stringify(pub&&pub.giorni.slice(0,3)));
// tocco su "Che turno fai domani?" → pannello di domani
await p.evaluate(()=>window.__fire("LN:localNotificationActionPerformed",{notification:{extra:{tab:"domani"}}})); await p.waitForTimeout(800);
ok(await p.evaluate(()=>!document.querySelector("#quickShiftModal").hidden && /Domani/i.test(document.querySelector("#qsDateTitle").innerText)), "tocco su 'Che turno fai domani?' apre il pannello di domani");
await p.evaluate(()=>document.querySelector("#qsClose").click());
// link dal widget su un giorno
const d3=await p.evaluate(()=>{ const d=new Date(); d.setDate(d.getDate()+3); return d.toISOString().slice(0,10); });
await p.evaluate(u=>window.__fire("App:appUrlOpen",{url:u}), "notturnisti://giorno/"+d3); await p.waitForTimeout(500);
ok(await p.evaluate(()=>!/^Oggi/.test(document.querySelector("#dateLabel").innerText) && document.body.classList.contains("tab-oggi")), "tocco su un giorno del widget apre l'app su quel giorno → "+await p.evaluate(()=>document.querySelector("#dateLabel").innerText));
console.log("errori", errs); await b.close();
