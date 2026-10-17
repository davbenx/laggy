// "Cancella tutti i dati": due conferme, poi l'app riparte da zero e
// nel telefono non resta niente (promemoria, widget). Versione mostrata.
import pw from "./_pw.mjs";
const ok=(c,m)=>{ console.log((c?"✔ ":"✘ ")+m); };
const b=await pw.chromium.launch(); const errs=[];
const ctx=await b.newContext({locale:"it-IT"});
await ctx.addInitScript(()=>{ const on=()=>Promise.resolve({remove(){}}); window.__log=[];
  window.Capacitor={isNativePlatform:()=>true,getPlatform:()=>"android",Plugins:{
    LocalNotifications:{checkPermissions:async()=>({display:"granted"}),requestPermissions:async()=>({display:"granted"}),checkExactNotificationSetting:async()=>({exact_alarm:"granted"}),getPending:async()=>({notifications:[]}),schedule:async(x)=>{ window.__log.push("sched:"+x.notifications.length); return {}; },cancel:async()=>({}),createChannel:async()=>({}),listChannels:async()=>({channels:[]}),addListener:on},
    App:{getLaunchUrl:async()=>({}),addListener:on,minimizeApp:async()=>{},getInfo:async()=>({version:"1.0.0",build:"7"})}, SystemBars:{setStyle:async()=>{}}, Share:{share:async()=>({})},
    NTWidget:{publish:async(x)=>{ window.__log.push("widget:"+JSON.parse(x.json).voci.length); return {widgets:1}; },count:async()=>({widgets:1})}, NTReview:{request:async()=>({})},
    CapacitorCalendar:{checkAllPermissions:async()=>({result:{readCalendar:"granted",writeCalendar:"granted"}}),listCalendars:async()=>({result:[]}),listEventsInRange:async()=>({result:[]})}}}; });
const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
await p.goto("http://localhost:8766/index.html"); await p.waitForTimeout(800);
await p.click("text=Conosco già il mio schema"); await p.click("[data-preset-ob='0']"); await p.click("[data-pos='0']"); await p.click("#qhConfermaOrari"); await p.waitForTimeout(500);
await p.evaluate(()=>document.querySelector("#doOpzioni").click()); await p.waitForTimeout(300);
ok(await p.evaluate(()=>document.querySelector("#versioneApp").textContent)==="Versione 1.0.0 (7)", "versione dell'app in Impostazioni");
ok(await p.evaluate(()=>getComputedStyle(document.querySelector("#doIcs")).display==="none"), "nell'app il file per il calendario non c'è");
let n=0; p.on("dialog", d=>{ n++; d.accept(); });
await p.evaluate(()=>{ window.__log=[]; document.querySelector("#doCancellaTutto").click(); }); await p.waitForTimeout(1500);
ok(n===2, "due conferme prima di cancellare");
// dopo il riavvio l'app scrive di nuovo il suo stato vuoto: conta che i
// turni non siano configurati e che diario e scelte non ci siano più
ok(await p.evaluate(()=>{ const k=Object.keys(localStorage).filter(k=>k.startsWith("nt:")); return k.every(x=>["nt:state","nt:turniConfigurati","nt:widgetN","nt:calNativo"].includes(x)) && localStorage.getItem("nt:turniConfigurati")!=="true"; }), "niente dati rimasti: "+await p.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith("nt:")).join(",")));
ok(await p.evaluate(()=>/Che turno fai oggi/.test(document.body.innerText)), "l'app riparte dalla prima schermata");
console.log("errori", errs); await b.close();
