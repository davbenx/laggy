// Ogni "indietro", "annulla", "chiudi" porta dove ci si aspetta: il bottone a
// schermo e il tasto indietro di Android finiscono nello stesso posto.
import pw from "./_pw.mjs";
const ok=(c,m)=>{ console.log((c?"✔ ":"✘ ")+m); };
const b=await pw.chromium.launch(); const errs=[];
const nativo=()=>{ window.__L={}; const on=(n,cb)=>{ window.__L[n]=cb; return Promise.resolve({remove(){}}); };
  window.Capacitor={isNativePlatform:()=>true,getPlatform:()=>"android",Plugins:{
    LocalNotifications:{checkPermissions:async()=>({display:"granted"}),requestPermissions:async()=>({display:"granted"}),checkExactNotificationSetting:async()=>({exact_alarm:"granted"}),getPending:async()=>({notifications:[]}),schedule:async()=>({}),cancel:async()=>({}),createChannel:async()=>({}),listChannels:async()=>({channels:[]}),addListener:on},
    App:{getLaunchUrl:async()=>({}),addListener:on,minimizeApp:async()=>{ window.__min=(window.__min||0)+1; }}, SystemBars:{setStyle:async()=>{}}, Share:{share:async()=>({})},
    NTWidget:{publish:async()=>({widgets:0}),count:async()=>({widgets:0})}, NTReview:{request:async()=>({})},
    CapacitorCalendar:{checkAllPermissions:async()=>({result:{readCalendar:"granted",writeCalendar:"granted"}}),listCalendars:async()=>({result:[]}),listEventsInRange:async()=>({result:[]})}}}; };
const ctx=await b.newContext({locale:"it-IT"}); await ctx.addInitScript(nativo);
const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
const back=async()=>{ await p.evaluate(()=>window.__L.backButton({canGoBack:false})); await p.waitForTimeout(250); };
const h2=()=>p.evaluate(()=>{ const e=document.querySelector("#demoEsempio .qh-h"); return e && !document.querySelector("#demoEsempio").hidden ? e.textContent : ""; });
const dove=()=>p.evaluate(()=>{ const c=document.body.classList; return ["andamenti-aperta","vederci-aperta","scambio-aperta","tab-opzioni","tab-turni","tab-oggi"].find(x=>c.contains(x)); });
await p.goto("http://localhost:8766/index.html"); await p.waitForTimeout(900);
// ── primo avvio: schema → posizione → orari, indietro a ritroso ──
const home=await h2();
await p.click("text=Conosco già il mio schema"); await p.waitForTimeout(200);
const schema=await h2();
await p.click("[data-preset-ob='0']"); await p.waitForTimeout(200);
const pos=await h2();
await p.click("[data-pos='0']"); await p.waitForTimeout(200);
ok(/orari/i.test(await h2()), "si arriva agli orari");
ok(await p.evaluate(()=>!!document.querySelector('#demoEsempio [data-subflow="posizione"]')), "orari: c'è il bottone Indietro");
await p.click('#demoEsempio [data-subflow="posizione"]'); await p.waitForTimeout(200);
ok(await h2()===pos, "orari → Indietro → 'dove sei nel ciclo'");
await p.click("[data-pos='0']"); await p.waitForTimeout(200); await back();
ok(await h2()===pos, "orari → tasto indietro → stesso posto del bottone");
await back(); ok(await h2()===schema, "posizione → indietro → scelta dello schema");
await back(); ok(await h2()===home, "schema → indietro → prima schermata");
await back(); ok(await p.evaluate(()=>window.__min===1), "prima schermata → indietro → app in secondo piano");
// ── configurato: le pagine di Turni e Impostazioni ──
await p.click("text=Conosco già il mio schema"); await p.click("[data-preset-ob='0']"); await p.click("[data-pos='0']"); await p.click("#qhConfermaOrari"); await p.waitForTimeout(500);
await p.evaluate(()=>document.querySelector("#doChiudiPrimoPiano")?.click());
await p.evaluate(()=>document.querySelector('[data-tab="turni"]').click()); await p.waitForTimeout(200);
for(const [apri,chiudi,cls] of [["#doScambioTurno","#chiudiScambio","scambio-aperta"],["#doPartner","#chiudiVederci","vederci-aperta"],["#doAndamenti","#chiudiAndamenti","andamenti-aperta"]]){
  await p.evaluate(s=>document.querySelector(s).click(), apri); await p.waitForTimeout(150);
  const aperta=await dove();
  await p.evaluate(s=>document.querySelector(s).click(), chiudi); await p.waitForTimeout(150);
  const d1=await dove();
  await p.evaluate(s=>document.querySelector(s).click(), apri); await p.waitForTimeout(150); await back();
  ok(aperta===cls && d1==="tab-turni" && await dove()==="tab-turni", apri+": freccia e tasto indietro tornano a Turni");
}
await back(); ok(await dove()==="tab-oggi", "Turni → indietro → Oggi");
// Impostazioni aperte da Turni tornano a Turni, da Oggi a Oggi
await p.evaluate(()=>document.querySelector('[data-tab="turni"]').click()); await p.waitForTimeout(150);
await p.evaluate(()=>document.querySelector("#doOpzioni").click()); await p.waitForTimeout(150); await back();
ok(await dove()==="tab-turni", "Impostazioni aperte da Turni → indietro → Turni");
await p.evaluate(()=>document.querySelector('[data-tab="oggi"]').click()); await p.waitForTimeout(150);
await p.evaluate(()=>document.querySelector("#doOpzioni").click()); await p.waitForTimeout(150);
await p.evaluate(()=>document.querySelector("#chiudiOpzioni").click()); await p.waitForTimeout(150);
ok(await dove()==="tab-oggi", "Impostazioni aperte da Oggi → freccia → Oggi");
// Modifica del ciclo da configurato: Annulla torna dov'era, senza cambiare nulla
const prima=await p.evaluate(()=>localStorage.getItem("nt:state"));
await p.evaluate(()=>document.querySelector('[data-tab="turni"]').click()); await p.waitForTimeout(150);
await p.evaluate(()=>{ const m=[...document.querySelectorAll("button,a")].find(x=>/^Modifica/.test(x.textContent.trim()) && x.offsetParent); m && m.click(); }); await p.waitForTimeout(300);
const inScelta=await h2();
await p.evaluate(()=>document.querySelector("[data-chiudi-schema]")?.click()); await p.waitForTimeout(250);
ok(inScelta && !(await h2()) && await p.evaluate(()=>localStorage.getItem("nt:state"))===prima, "Modifica ciclo → Annulla: si torna al piano, niente cambiato ("+inScelta+")");
// pannello del turno: chiudi e indietro
await p.evaluate(()=>document.querySelector('[data-tab="oggi"]').click()); await p.waitForTimeout(150);
await p.click("#shiftPill"); await p.waitForTimeout(250); await back();
ok(await p.evaluate(()=>document.querySelector("#quickShiftModal").hidden) && await dove()==="tab-oggi", "pannello del turno → indietro → resta su Oggi, pannello chiuso");
console.log("errori", errs); await b.close();
