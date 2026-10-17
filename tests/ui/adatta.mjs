import pw from "./_pw.mjs";
const SP=(process.env.OUT||"/tmp");
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const nat=()=>{ const on=n=>(ev,cb)=>Promise.resolve({remove(){}}); window.__pend=[]; window.__cal={cals:{},ev:{},next:1}; const cal=window.__cal;
  window.Capacitor={isNativePlatform:()=>true,getPlatform:()=>"android",Plugins:{
    LocalNotifications:{checkPermissions:async()=>({display:"granted"}),requestPermissions:async()=>({display:"granted"}),checkExactNotificationSetting:async()=>({exact_alarm:"granted"}),getPending:async()=>({notifications:window.__pend}),schedule:async(o)=>{ window.__pend=window.__pend.concat(o.notifications); return {}; },cancel:async(o)=>{ const ids=o.notifications.map(n=>n.id); window.__pend=window.__pend.filter(n=>!ids.includes(n.id)); return {}; },createChannel:async()=>({}),addListener:on("LN")},
    App:{getLaunchUrl:async()=>({}),addListener:on("App"),minimizeApp:async()=>{}}, SystemBars:{setStyle:async()=>{}}, Share:{share:async()=>({})},
    NTWidget:{publish:async()=>({widgets:1}),count:async()=>({widgets:1})},
    CapacitorCalendar:{checkAllPermissions:async()=>({result:{readCalendar:"granted",writeCalendar:"granted"}}),requestAllPermissions:async()=>({result:{readCalendar:"granted",writeCalendar:"granted"}}),
      listCalendars:async()=>({result:Object.keys(cal.cals).map(id=>({id}))}),createCalendar:async(o)=>{ const id=String(cal.next++); cal.cals[id]=o.title; return {id}; },deleteCalendar:async(o)=>{ delete cal.cals[o.id]; },
      createEvent:async(o)=>{ const id=String(cal.next++); cal.ev[id]=o; return {id}; },deleteEventsById:async(o)=>{ (o.ids||[]).forEach(i=>delete cal.ev[i]); return {result:{}}; },openCalendar:async()=>{},
      listEventsInRange:async(o)=>({result:Object.entries(cal.ev).filter(([i,e])=>e.startDate>=o.from && e.startDate<=o.to).map(([i,e])=>({id:i,calendarId:Number(e.calendarId)}))})}}}; };
const ctx=await b.newContext({viewport:{width:360,height:800},locale:"it-IT"}); await ctx.addInitScript(nat);
let p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
await p.goto("http://localhost:8766/index.html"); await p.waitForTimeout(900);
await p.evaluate(()=>{ const d=document.querySelector("body > [role=dialog] [data-x]"); d&&d.click(); });
await p.click("text=Conosco già il mio schema"); await p.click("[data-preset-ob='0']"); await p.click("[data-pos='0']"); await p.click("#qhConfermaOrari"); await p.waitForTimeout(400);
await p.click("#doChiudiPrimoPiano").catch(()=>{});
// lucidità: oggi no, domani sì
ok(await p.evaluate(()=>document.querySelector("#luciditaGiornoWrap").innerText.trim()===""), "lucido: su oggi l'invito non c'è (la notte prima è già passata)");
await p.click("#next"); await p.waitForTimeout(200);
ok(await p.evaluate(()=>/lucid|in forma/i.test(document.querySelector("#luciditaGiornoWrap").innerText)), "lucido: su domani l'invito c'è");
await p.click("#goToday");
// attiva calendario e controlla stato reale
await p.click('[data-attiva="calendario"]'); await p.waitForTimeout(3000);
// lo stato del calendario ora vive solo in Impostazioni (tolto il doppione in Turni)
await p.evaluate(()=>document.querySelector("#doOpzioni").click()); await p.waitForTimeout(300);
await p.click("[data-cal-controlla]"); await p.waitForTimeout(1200);
const st=await p.evaluate(()=>document.querySelector("#opzCalStato")&&document.querySelector("#opzCalStato").innerText);
ok(/Nel telefono: \d+ eventi/.test(st||""), "calendario: Impostazioni dice quanti eventi ci sono davvero nel telefono → "+st);
await p.evaluate(()=>{ window.__cal.ev={}; }); // l'utente/il sistema li cancella
await p.click("[data-cal-controlla]"); await p.waitForTimeout(800);
const st2=await p.evaluate(()=>document.querySelector("#opzCalStato").innerText);
ok(/Non trovo gli eventi/.test(st2), "calendario: se mancano lo dice → "+st2);
await p.click("[data-cal-riscrivi]"); await p.waitForTimeout(4500);
ok(await p.evaluate(()=>Object.keys(window.__cal.ev).length)>0, "calendario: 'Riscrivili ora' li rimette");
// notifica di prova
if(!await p.evaluate(()=>document.body.classList.contains("tab-opzioni"))){ await p.evaluate(()=>document.querySelector("#doOpzioni").click()); await p.waitForTimeout(300); }
await p.click("[data-prova-notifica]"); await p.waitForTimeout(300);
ok(await p.evaluate(()=>window.__pend.some(n=>n.id===999990)), "Impostazioni: 'Prova una notifica' la manda subito");
// diario: 30 notti a letto 00:30 sveglia 09:00
await p.evaluate(()=>{ const w={}, bd={}; for(let i=1;i<=30;i++){ const d=new Date(); d.setDate(d.getDate()-i); const k=d.toISOString().slice(0,10); w[k]="09:00"; bd[k]="00:30"; } localStorage.setItem("nt:wakes",JSON.stringify(w)); localStorage.setItem("nt:beds",JSON.stringify(bd)); localStorage.setItem("nt:invitoVisto","\"2000-01-01\""); });
await p.reload(); await p.waitForTimeout(1500);
await p.evaluate(()=>{ const d=document.querySelector("body > [role=dialog] [data-x]"); d&&d.click(); });
await p.evaluate(()=>{ const n=document.querySelector("#nascondiAttivazione"); n&&n.click(); });
await p.waitForTimeout(300);
const card=await p.evaluate(()=>{ const c=document.querySelector("#adattaCard"); return c && !c.hidden ? c.innerText.replace(/\n+/g," | ") : null; });
ok(!!card && /dormi/.test(card), "Oggi: proposta 'Il piano si adatta a te' → "+card);
await p.locator("#adattaCard").screenshot({path:SP+"/ad-card.png"});
const notif=await p.evaluate(()=>window.__pend.find(n=>n.id===990001));
ok(!!notif, "notifica una tantum programmata: "+(notif? notif.title+" — "+notif.body+" @ "+new Date(notif.schedule.at).toLocaleString("it-IT") : "nessuna"));
await p.click("#adattaSi"); await p.waitForTimeout(300);
const dopo=await p.evaluate(()=>{ const s=JSON.parse(localStorage.getItem("nt:state")||"{}"); return {bed:s.freeBed, wake:s.freeWake, card:document.querySelector("#adattaCard").innerText.split("\n")[0]}; });
ok(dopo.card.startsWith("Fatto"), "un tocco applica, con conferma e Annulla → "+JSON.stringify(dopo));
await p.click("#adattaAnnulla"); await p.waitForTimeout(300);
const ann=await p.evaluate(()=>{ const s=JSON.parse(localStorage.getItem("nt:state")||"{}"); return {bed:s.freeBed, wake:s.freeWake, vis:!document.querySelector("#adattaCard").hidden}; });
ok(ann.bed==="23:30" && ann.wake==="07:30" && !ann.vis, "Annulla torna agli orari di prima e non ripropone lo stesso "+JSON.stringify(ann));
// in Impostazioni il suggerimento resta accanto al campo
await p.evaluate(()=>{ localStorage.removeItem("nt:adattaNo"); });
await p.reload(); await p.waitForTimeout(1500);
await p.evaluate(()=>document.querySelector("#doOpzioni").click()); await p.waitForTimeout(300);
await p.click('[data-opz="3"]'); await p.waitForTimeout(300);
const sl=await p.evaluate(()=>{ const e=document.querySelector("#suggLiberi"); return e && !e.hidden ? e.innerText.replace(/\n/g," | ") : null; });
ok(!!sl, "Impostazioni → Sonno nei giorni liberi: suggerimento con un tocco → "+sl);
await p.locator("#opzBox3").screenshot({path:SP+"/ad-opz.png"});
console.log("errori", errs); await b.close();
