import pw from "./_pw.mjs";
const ok=(c,m)=>{ console.log((c?"✔ ":"✘ ")+m); if(!c) process.exitCode=1; };
const b=await pw.chromium.launch(); const errs=[];
const voci=p=>p.evaluate(()=>[...document.querySelectorAll("#setupChecklist .attiva-voce")].map(v=>(v.classList.contains("ok")?"✓":"·")+v.querySelector("b").textContent));
const visibile=(p,id)=>p.evaluate(id=>{ const e=document.getElementById(id); return !!(e && !e.hidden && e.offsetParent!==null); }, id);

// WEB
let ctx=await b.newContext({viewport:{width:390,height:844},locale:"it-IT",colorScheme:"dark"});
await ctx.addInitScript(()=>{ let perm="default"; try{ Object.defineProperty(Notification,"permission",{get:()=>perm}); Notification.requestPermission=async()=>{ perm="granted"; return "granted"; }; }catch(e){} });
let p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(800);
await p.click("[data-pick=N]"); await p.click("#qhConfermaOrario"); await p.waitForTimeout(400);
ok(!(await visibile(p,"setupChecklist")), "web: con il banner del primo piano aperto, la lista aspetta");
await p.click("#doChiudiPrimoPiano"); await p.waitForTimeout(300);
ok(await visibile(p,"setupChecklist"), "web: chiuso il banner compare la lista: "+(await voci(p)).join(" | "));
await p.screenshot({path:"/tmp/a-1-web.png"});
ok(!(await visibile(p,"shareNudge")) && !(await visibile(p,"statsNudge")), "web: mentre c'è la lista, gli altri inviti tacciono");
await p.click('[data-attiva="notifiche"]'); await p.waitForTimeout(500); await p.evaluate(()=>{ const x=document.querySelector('#sceltaNotif [data-scelta=\"essenziali\"]'); x&&x.click(); }); await p.waitForTimeout(200);
ok((await voci(p)).includes("✓Promemoria sul telefono"), "web: 'Promemoria' attivato con un tocco");
await p.click('[data-attiva="turni"]'); await p.waitForTimeout(300);
ok(await p.evaluate(()=>document.querySelector("#demoEsempio .qh-h").textContent==="E nei prossimi giorni?"), "web: 'I turni dei prossimi giorni' apre il flusso lineare");
await p.click('[data-subflow="schema"]'); await p.click("[data-preset-ob='0']"); await p.click("[data-pos='2']"); await p.click("#qhConfermaOrari"); await p.waitForTimeout(500);
ok((await voci(p)).includes("✓I turni dei prossimi giorni"), "web: dopo aver impostato il ciclo la voce risulta fatta: "+(await voci(p)).join(" | "));
// Opzioni
await p.click("#doOpzioni"); await p.waitForTimeout(300);
const gruppi=await p.evaluate(()=>[...document.querySelectorAll("#opzioni > .eyebrow")].map(e=>e.textContent));
ok(gruppi.slice(0,4).join(",")==="Funziona da solo,Il tuo piano,Salva,Informazioni e privacy", "Opzioni per argomento: "+gruppi.join(" · "));
const opzV=await p.evaluate(()=>[...document.querySelectorAll("#opzFunzioni .attiva-voce[data-gestisci]")].map(v=>(v.classList.contains("ok")?"✓":"·")+v.querySelector("b").textContent));
ok(opzV.length===2, "Opzioni → 'Funziona da solo' con promemoria e calendario (i turni stanno in 'Il tuo piano'): "+opzV.join(" | "));
await p.screenshot({path:"/tmp/a-2-opzioni.png", fullPage:true});
await p.evaluate(()=>document.querySelector("#chiudiOpzioni").click());
await p.click("#nascondiAttivazione").catch(()=>{}); await p.waitForTimeout(200);
ok(!(await visibile(p,"setupChecklist")), "'Nascondi' toglie la lista da Oggi (resta in Opzioni)");

// NATIVO simulato
ctx=await b.newContext({viewport:{width:390,height:844},locale:"it-IT",colorScheme:"dark"});
await ctx.addInitScript(()=>{ const L={}; const on=n=>(ev,cb)=>{ (L[n+":"+ev]=L[n+":"+ev]||[]).push(cb); return Promise.resolve({remove(){}}); }; window.__w=0; window.__cal={cals:{},ev:{},next:1}; const cal=window.__cal;
  window.Capacitor={isNativePlatform:()=>true,getPlatform:()=>"android",Plugins:{
    LocalNotifications:{checkPermissions:async()=>({display:window.__perm||"prompt"}),requestPermissions:async()=>{ window.__perm="granted"; return {display:"granted"}; },checkExactNotificationSetting:async()=>({exact_alarm:"granted"}),getPending:async()=>({notifications:[]}),schedule:async()=>({}),cancel:async()=>({}),createChannel:async()=>({}),addListener:on("LN")},
    App:{getLaunchUrl:async()=>({}),addListener:on("App"),minimizeApp:async()=>{}}, SystemBars:{setStyle:async()=>{}}, Share:{share:async()=>({})},
    NTWidget:{publish:async()=>({widgets:window.__w}),count:async()=>({widgets:window.__w}),pin:async()=>{ window.__w=1; return {supported:true}; }},
    CapacitorCalendar:{checkAllPermissions:async()=>({result:{readCalendar:window.__cp||"prompt",writeCalendar:window.__cp||"prompt"}}),requestAllPermissions:async()=>{ window.__cp="granted"; return {result:{readCalendar:"granted",writeCalendar:"granted"}}; },
      listCalendars:async()=>({result:Object.keys(cal.cals).map(id=>({id}))}),createCalendar:async(o)=>{ const id=String(cal.next++); cal.cals[id]=o.title; return {id}; },deleteCalendar:async()=>{},
      createEvent:async(o)=>{ const id=String(cal.next++); cal.ev[id]=o; return {id}; },deleteEventsById:async()=>({result:{}}),openCalendar:async()=>{}}}};
  window.__fire=(k,v)=>(L[k]||[]).forEach(f=>f(v)); });
p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
await p.goto("http://localhost:8766/index.html"); await p.waitForTimeout(1200);
await p.evaluate(()=>{ const d=document.querySelector("body > [role=dialog] [data-x]"); d&&d.click(); });
await p.click("text=Conosco già il mio schema"); await p.click("[data-preset-ob='0']"); await p.click("[data-pos='0']"); await p.click("#qhConfermaOrari"); await p.waitForTimeout(500);
await p.click("#doChiudiPrimoPiano"); await p.waitForTimeout(300);
ok((await voci(p)).length===4, "nativo: quattro voci, compreso il widget: "+(await voci(p)).join(" | "));
await p.screenshot({path:"/tmp/a-3-nativo.png"});
await p.click('[data-attiva="notifiche"]'); await p.waitForTimeout(400); await p.evaluate(()=>{ const x=document.querySelector('#sceltaNotif [data-scelta=\"essenziali\"]'); x&&x.click(); }); await p.waitForTimeout(200);
await p.click('[data-attiva="calendario"]'); await p.waitForTimeout(2500);
await p.click('[data-attiva="widget"]'); await p.waitForTimeout(300);
await p.evaluate(()=>window.__fire("App:resume")); await p.waitForTimeout(800);
console.log("voci dopo:", (await voci(p)).join(" | "));
const fine=await p.evaluate(()=>({nascosta: document.querySelector("#setupChecklist").hidden, eventi:Object.keys(window.__cal.ev).length}));
ok(fine.nascosta && fine.eventi>0, "nativo: notifiche, calendario ("+fine.eventi+" eventi) e widget attivati con un tocco ciascuno → la lista sparisce");
console.log("errori:", errs); await b.close();
