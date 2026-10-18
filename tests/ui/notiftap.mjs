// Tocco su una notifica: l'app si apre sulla sezione che serve per fare la
// cosa che la notifica chiede, sul giorno di adesso. App nativa simulata.
import pw from "./_pw.mjs";
const ok=(c,m)=>{ console.log((c?"✔ ":"✘ ")+m); };
const b=await pw.chromium.launch(); const errs=[];
const nativo=()=>{ const on=(n,cb)=>{ (window.__L=window.__L||{})[n]=cb; return Promise.resolve({remove(){}}); };
  window.Capacitor={isNativePlatform:()=>true,getPlatform:()=>"android",Plugins:{
    LocalNotifications:{checkPermissions:async()=>({display:"granted"}),requestPermissions:async()=>({display:"granted"}),checkExactNotificationSetting:async()=>({exact_alarm:"granted"}),getPending:async()=>({notifications:[]}),schedule:async()=>({}),cancel:async()=>({}),createChannel:async()=>({}),listChannels:async()=>({channels:[]}),addListener:on},
    App:{getLaunchUrl:async()=>({}),addListener:()=>Promise.resolve({remove(){}}),minimizeApp:async()=>{}}, SystemBars:{setStyle:async()=>{}}, Share:{share:async()=>({})},
    NTWidget:{publish:async()=>({widgets:0}),count:async()=>({widgets:0})}, NTReview:{request:async()=>({})},
    CapacitorCalendar:{checkAllPermissions:async()=>({result:{readCalendar:"granted",writeCalendar:"granted"}}),listCalendars:async()=>({result:[]}),listEventsInRange:async()=>({result:[]})}}}; };
const ds=n=>{ const d=new Date(); d.setDate(d.getDate()-n); return d.toISOString().slice(0,10); };
const ctx=await b.newContext({locale:"it-IT",viewport:{width:360,height:740}}); await ctx.addInitScript(nativo);
const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
await p.goto("http://localhost:8766/index.html"); await p.waitForTimeout(800);
await p.click("text=Conosco già il mio schema"); await p.click("[data-preset-ob='0']"); await p.click("[data-pos='0']"); await p.click("#qhConfermaOrari"); await p.waitForTimeout(400);
await p.evaluate(f=>{ const st=JSON.parse(localStorage.getItem("nt:state")); st.firstSeenAt=f; st.turniConfigurati=true; localStorage.setItem("nt:state",JSON.stringify(st));
  localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:firstPlanBannerChiuso","true"); }, ds(10));
await p.reload(); await p.waitForTimeout(2500);
const tocca=async(tab,kind)=>{ await p.evaluate(([t,k])=>window.__L.localNotificationActionPerformed({notification:{extra:{tab:t,kind:k}}}),[tab,kind]); await p.waitForTimeout(process.env.SHOT?500:1200); };
const stato=()=>p.evaluate(()=>{ const vis=el=>{ if(!el) return false; const r=el.getBoundingClientRect(); return r.bottom>0 && r.top<innerHeight && r.height>0; };
  const drem=document.querySelector("#essenziale .drem");
  return { cls:[...document.body.classList].join(" "), drem:vis(drem), ev:!!document.querySelector(".evidenzia"),
    evNap:!!(document.querySelector(".evidenzia [data-nap]")), qs:!!document.querySelector(".qs-sheet:not([hidden]), #quickShift:not([hidden])"),
    oggiIn:/oggi/i.test((document.querySelector("#goToday,.giorno-h,header")||{}).innerText||"") }; });

// parto da un'altra schermata e da un altro giorno, come capita davvero
await p.click('[data-tab="turni"]'); await p.waitForTimeout(400);
await tocca("diario","wake"); let s=await stato();
if(process.env.SHOT) await p.screenshot({path:process.env.SHOT+"/tap-diario.png"});
ok(/tab-oggi/.test(s.cls) && s.drem && s.ev, "«Ora di alzarti» / «Come hai dormito?» → Oggi, modulo del sonno a schermo ed evidenziato");
await p.click("#doOpzioni"); await p.waitForTimeout(400);
await tocca("oggi","coffee"); s=await stato();
ok(/tab-oggi/.test(s.cls) && !/tab-opzioni/.test(s.cls), "«Ultimo caffè» dalle Impostazioni → torna su Oggi");
await tocca("turni","settimana"); s=await stato();
ok(/tab-turni/.test(s.cls), "«La tua settimana» → Turni");
await tocca("domani","domani"); s=await stato();
const qsAperto=await p.evaluate(()=>{ const e=document.querySelector("#quickShiftModal"); return !!e && getComputedStyle(e).display!=="none" && !e.hidden; });
ok(qsAperto, "«Che turno fai domani?» → si apre la scelta del turno");
await p.keyboard.press("Escape"); await p.evaluate(()=>{ const c=document.querySelector("#qsClose,[data-qs-close]"); if(c) c.click(); }); await p.waitForTimeout(400);
await tocca("pisolino","nap"); s=await stato();
ok(/tab-oggi/.test(s.cls) && (s.ev), "«Pisolino» → Oggi, scheda del sonno/pisolino evidenziata"+(s.evNap?" (sul pisolino)":" (nessun pisolino oggi: scheda del sonno)"));
// web: scorciatoia ?t=diario all'avvio
await p.goto("http://localhost:8766/index.html?t=diario"); await p.waitForTimeout(2500); s=await stato();
ok(/tab-oggi/.test(s.cls) && s.drem, "avvio con ?t=diario (notifica web a app chiusa) → modulo del sonno a schermo");
console.log("errori", errs); await b.close();
