// «Come hai dormito?» su Android con il suo canale (non quello silenzioso) e
// «Vedi i prossimi promemoria» in Impostazioni.
import pw from "./_pw.mjs";
const ok=(c,m)=>{ console.log((c?"✔ ":"✘ ")+m); };
const b=await pw.chromium.launch(); const errs=[];
const nativo=()=>{ const on=(n,cb)=>{ (window.__L=window.__L||{})[n]=cb; return Promise.resolve({remove(){}}); };
  window.__sched=[]; window.__canali=[];
  window.Capacitor={isNativePlatform:()=>true,getPlatform:()=>"android",Plugins:{
    LocalNotifications:{checkPermissions:async()=>({display:"granted"}),requestPermissions:async()=>({display:"granted"}),checkExactNotificationSetting:async()=>({exact_alarm:"granted"}),getPending:async()=>({notifications:[]}),
      schedule:async(x)=>{ window.__sched.push(...x.notifications); return {}; },cancel:async()=>({}),createChannel:async(c)=>{ window.__canali.push(c); return {}; },listChannels:async()=>({channels:[]}),registerActionTypes:async()=>({}),addListener:on},
    App:{getLaunchUrl:async()=>({}),addListener:()=>Promise.resolve({remove(){}}),minimizeApp:async()=>{}}, SystemBars:{setStyle:async()=>{}}, Share:{share:async()=>({})},
    NTWidget:{publish:async()=>({widgets:0}),count:async()=>({widgets:0})}, NTReview:{request:async()=>({})},
    CapacitorCalendar:{checkAllPermissions:async()=>({result:{readCalendar:"granted",writeCalendar:"granted"}}),listCalendars:async()=>({result:[]}),listEventsInRange:async()=>({result:[]})}}}; };
const ds=n=>{ const d=new Date(); d.setDate(d.getDate()-n); return d.toISOString().slice(0,10); };
const ctx=await b.newContext({locale:"it-IT",viewport:{width:390,height:844}}); await ctx.addInitScript(nativo);
const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
await p.goto("http://localhost:8766/index.html"); await p.waitForTimeout(800);
await p.click("text=Conosco già il mio schema"); await p.click("[data-preset-ob='0']"); await p.click("[data-pos='0']"); await p.click("#qhConfermaOrari"); await p.waitForTimeout(400);
await p.evaluate(f=>{ const st=JSON.parse(localStorage.getItem("nt:state")); st.firstSeenAt=f; localStorage.setItem("nt:state",JSON.stringify(st)); localStorage.setItem("nt:firstPlanBannerChiuso","true"); }, ds(10));
await p.reload(); await p.waitForTimeout(3000);
const r=await p.evaluate(()=>({ dia:window.__sched.filter(n=>n.extra&&n.extra.kind==="diario").map(n=>n.channelId), can:window.__canali.find(c=>c.id==="diario") }));
ok(r.dia.length>0 && r.dia.every(c=>c==="diario") && r.can && r.can.importance===3, "«Come hai dormito?» in coda sul canale «diario», importanza normale → "+JSON.stringify(r));
await p.click("#doOpzioni"); await p.waitForTimeout(400);
await p.click('[data-opzg-vai="promemoria"]'); await p.waitForTimeout(200);
await p.click("[data-prossimi-promemoria]"); await p.waitForTimeout(300);
const t=await p.evaluate(()=>{ const e=document.querySelector("#opzProssimi"); return e && !e.hidden ? e.innerText : ""; });
ok(/I prossimi/.test(t) && t.split("\n").filter(l=>/·/.test(l)).length>=3 && !/NaN|undefined/.test(t), "«Vedi i prossimi promemoria»: elenco con giorno, ora e titolo → "+t.split("\n").slice(1,4).join(" | "));
// Installazione nuova, schema uguale a quello d'esempio: prima mancava il
// riarmo dopo l'onboarding (la configurazione "non cambiava"), e restava la
// coda dell'avvio, senza diario. E prima dei turni: nessun promemoria.
{ const c2=await b.newContext({locale:"it-IT",viewport:{width:390,height:844}}); await c2.addInitScript(nativo);
  const q=await c2.newPage(); q.on("pageerror",e=>errs.push(e.message));
  await q.goto("http://localhost:8766/index.html"); await q.waitForTimeout(1500);
  const prima=await q.evaluate(()=>window.__sched.length);
  ok(prima===0, "prima di mettere i turni nessun promemoria del piano d'esempio ("+prima+")");
  await q.click("text=Conosco già il mio schema"); await q.click("[data-preset-ob='0']"); await q.click("[data-pos='0']"); await q.click("#qhConfermaOrari");
  await q.waitForTimeout(6000);
  const k=await q.evaluate(()=>window.__sched.filter(n=>n.extra&&n.extra.kind==="diario").length);
  ok(k>0, "subito dopo l'onboarding, senza riaprire l'app: «Come hai dormito?» in coda ("+k+")");
  await c2.close(); }
console.log("errori", errs); await b.close();
