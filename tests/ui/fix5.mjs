import pw from "./_pw.mjs";
const SP=(process.env.OUT||"/tmp");
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
async function setup(ctx, url="http://localhost:8765/index.html"){
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.goto(url); await p.waitForTimeout(900);
  await p.evaluate(()=>{ const d=document.querySelector("body > [role=dialog] [data-x]"); d&&d.click(); });
  await p.click("text=Conosco già il mio schema"); await p.click("[data-preset-ob='0']"); await p.click("[data-pos='0']"); await p.click("#qhConfermaOrari"); await p.waitForTimeout(400);
  await p.click("#doChiudiPrimoPiano").catch(()=>{}); return p;
}
const bg=p=>p.evaluate(()=>getComputedStyle(document.body).backgroundColor);
// 1. TEMA: telefono in chiaro → lo scuro si raggiunge, e resta dopo il riavvio
{ const ctx=await b.newContext({viewport:{width:390,height:800},locale:"it-IT",colorScheme:"light"}); const p=await setup(ctx);
  const a=await bg(p); await p.click("#themeToggle"); const c=await bg(p);
  ok(a==="rgb(255, 255, 255)" && c==="rgb(20, 22, 26)", "tema: telefono chiaro → tocco → scuro ("+a+" → "+c+")");
  await p.reload(); await p.waitForTimeout(800); ok(await bg(p)==="rgb(20, 22, 26)", "tema: lo scuro scelto resta dopo la riapertura");
  await p.click("#themeToggle"); ok(await bg(p)==="rgb(255, 255, 255)", "tema: nuovo tocco → chiaro");
  await ctx.close(); }
{ const ctx=await b.newContext({viewport:{width:390,height:800},locale:"it-IT",colorScheme:"dark"}); const p=await setup(ctx);
  const a=await bg(p); await p.click("#themeToggle"); const c=await bg(p); await p.click("#themeToggle"); const d=await bg(p);
  ok(a==="rgb(20, 22, 26)"&&c==="rgb(255, 255, 255)"&&d==="rgb(20, 22, 26)", "tema: telefono scuro → chiaro → scuro");
  await ctx.close(); }
// 2. SONNO GIORNI LIBERI a 320/360/412 px, anche con orario fuori griglia
for (const w of [320,360,412]) {
  const ctx=await b.newContext({viewport:{width:w,height:800},locale:"it-IT"}); const p=await setup(ctx);
  const st=await p.evaluate(()=>localStorage.getItem("nt:state"));
  const p2=await ctx.newPage(); await p.close();
  await ctx.addInitScript(s=>{ if(!sessionStorage.getItem("x")){ sessionStorage.setItem("x",1); const o=JSON.parse(s); o.freeBed="00:10"; o.freeWake="08:50"; localStorage.setItem("nt:state",JSON.stringify(o)); } }, st);
  await p2.goto("http://localhost:8765/index.html"); await p2.waitForTimeout(900);
  const pp=p2;
  await pp.evaluate(()=>document.querySelector("#doOpzioni").click()); await pp.waitForTimeout(200);
  await pp.click('[data-opz="3"]'); await pp.waitForTimeout(300);
  const r=await pp.evaluate(()=>[...document.querySelectorAll("#oBed,#oWake")].map(s=>{ const c=document.createElement("canvas").getContext("2d"); const cs=getComputedStyle(s); c.font=cs.fontWeight+" "+cs.fontSize+" "+cs.fontFamily; return {v:s.value, w:s.clientWidth, testo:Math.ceil(c.measureText(s.value).width)+parseFloat(cs.paddingLeft)+parseFloat(cs.paddingRight)}; }));
  ok(r[0].v==="00:10" && r[1].v==="08:50" && r.every(x=>x.w>=x.testo+16), w+"px: tendine mostrano l'orario salvato per intero "+JSON.stringify(r));
  await pp.locator("#opzBox3").screenshot({path:`${SP}/f-sonno-${w}.png`});
  await ctx.close();
}
// 3. STAMPA: il foglio si vede davvero in stampa (web)
{ const ctx=await b.newContext({viewport:{width:390,height:800},locale:"it-IT"}); const p=await setup(ctx);
  await p.evaluate(()=>{ window.__pr=0; window.print=()=>window.__pr++; document.querySelector("#doPrint").click(); });
  await p.emulateMedia({media:"print"});
  const h=await p.evaluate(()=>({h:document.querySelector("#printSheet").offsetHeight, pr:window.__pr, par:document.querySelector("#printSheet").parentElement.tagName}));
  ok(h.h>300 && h.pr===1 && h.par==="BODY", "stampa ciclo: foglio visibile in stampa "+JSON.stringify(h));
  await p.screenshot({path:SP+"/f-print-ciclo.png"}); await p.emulateMedia({media:"screen"});
  await p.click('[data-tab="turni"]'); await p.evaluate(()=>document.querySelector("#doPartner").click()); await p.waitForTimeout(300);
  await p.click("[data-partner-sheet]"); await p.emulateMedia({media:"print"});
  const h2=await p.evaluate(()=>({h:document.querySelector("#printSheet").offsetHeight, pr:window.__pr, t:document.querySelector("#printSheet h1").textContent}));
  ok(h2.h>200 && h2.pr===2 && /libero/.test(h2.t), "foglio orari liberi: visibile in stampa "+JSON.stringify(h2));
  await p.screenshot({path:SP+"/f-print-liberi.png"});
  await ctx.close(); }
// 4. INTERRUTTORI (web, permesso concesso)
{ const ctx=await b.newContext({viewport:{width:390,height:800},locale:"it-IT"});
  await ctx.addInitScript(()=>{ Object.defineProperty(Notification,"permission",{get:()=>"granted"}); });
  const p=await setup(ctx);
  await p.evaluate(()=>document.querySelector("#doOpzioni").click()); await p.waitForTimeout(200);
  const st=()=>p.evaluate(()=>({riga:document.querySelector('#opzFunzioni [data-gestisci="notifiche"]').getAttribute("aria-checked"), lista:document.querySelector('#opzFunzioni [data-gestisci="notifiche"]').getAttribute("aria-checked"), off:localStorage.getItem("nt:promemoriaOff")}));
  ok((await st()).riga==="true", "promemoria: con permesso risultano accesi "+JSON.stringify(await st()));
  await p.click('#opzFunzioni [data-gestisci="notifiche"]'); await p.waitForTimeout(200); await p.evaluate(()=>{ const x=document.querySelector('#sceltaNotif [data-scelta=\"essenziali\"]'); x&&x.click(); }); await p.waitForTimeout(200); const s1=await st();
  ok(s1.riga==="false"&&s1.lista==="false"&&s1.off==="true", "promemoria: si spengono dalla riga 'Sul telefono' "+JSON.stringify(s1));
  await p.click('#opzFunzioni [data-gestisci="notifiche"]'); await p.waitForTimeout(200); await p.evaluate(()=>{ const x=document.querySelector('#sceltaNotif [data-scelta=\"essenziali\"]'); x&&x.click(); }); await p.waitForTimeout(200); const s2=await st();
  ok(s2.riga==="true"&&s2.lista==="true", "promemoria: si riaccendono da 'Il tuo piano, automatico' "+JSON.stringify(s2));
  await ctx.close(); }
// 5. NATIVO simulato: stampa via NTPrint, calendario e promemoria si spengono
{ const ctx=await b.newContext({viewport:{width:390,height:800},locale:"it-IT"});
  await ctx.addInitScript(()=>{ const L={}; const on=n=>(ev,cb)=>{ (L[n+":"+ev]=L[n+":"+ev]||[]).push(cb); return Promise.resolve({remove(){}}); }; window.__w=0; window.__pend=[]; window.__prints=[]; window.__cal={cals:{},ev:{},next:1}; const cal=window.__cal;
    window.confirm=()=>true;
    window.Capacitor={isNativePlatform:()=>true,getPlatform:()=>"android",Plugins:{
      LocalNotifications:{checkPermissions:async()=>({display:window.__perm||"prompt"}),requestPermissions:async()=>{ window.__perm="granted"; return {display:"granted"}; },checkExactNotificationSetting:async()=>({exact_alarm:"granted"}),getPending:async()=>({notifications:window.__pend}),schedule:async(o)=>{ window.__pend=o.notifications.map(n=>({id:n.id})); return {}; },cancel:async()=>{ window.__pend=[]; return {}; },createChannel:async()=>({}),addListener:on("LN")},
      App:{getLaunchUrl:async()=>({}),addListener:on("App"),minimizeApp:async()=>{}}, SystemBars:{setStyle:async()=>{}}, Share:{share:async()=>({})},
      NTPrint:{print:async(o)=>{ window.__prints.push(o.title); }},
      NTWidget:{publish:async()=>({widgets:window.__w}),count:async()=>({widgets:window.__w}),pin:async()=>{ window.__w=1; return {supported:true}; }},
      CapacitorCalendar:{checkAllPermissions:async()=>({result:{readCalendar:window.__cp||"prompt",writeCalendar:window.__cp||"prompt"}}),requestAllPermissions:async()=>{ window.__cp="granted"; return {result:{readCalendar:"granted",writeCalendar:"granted"}}; },
        listCalendars:async()=>({result:Object.keys(cal.cals).map(id=>({id}))}),createCalendar:async(o)=>{ const id=String(cal.next++); cal.cals[id]=o.title; return {id}; },deleteCalendar:async(o)=>{ delete cal.cals[o.id]; },
        createEvent:async(o)=>{ const id=String(cal.next++); cal.ev[id]=o; return {id}; },deleteEventsById:async()=>({result:{}}),openCalendar:async()=>{}}}};
    window.__fire=(k,v)=>(L[k]||[]).forEach(f=>f(v)); });
  const p=await setup(ctx,"http://localhost:8766/index.html");
  await p.evaluate(()=>document.querySelector("#doPrint").click()); await p.waitForTimeout(200);
  ok((await p.evaluate(()=>window.__prints)).length===1, "nativo: 'Stampa il foglio del ciclo' apre la stampa di Android "+JSON.stringify(await p.evaluate(()=>window.__prints)));
  await p.click('[data-attiva="notifiche"]'); await p.waitForTimeout(500); await p.evaluate(()=>{ const x=document.querySelector('#sceltaNotif [data-scelta=\"essenziali\"]'); x&&x.click(); }); await p.waitForTimeout(200);
  const n1=await p.evaluate(()=>window.__pend.length);
  await p.click('[data-attiva="calendario"]'); await p.waitForTimeout(2500);
  await p.evaluate(()=>document.querySelector("#doOpzioni").click()); await p.waitForTimeout(300);
  await p.click('#opzFunzioni [data-gestisci="notifiche"]'); await p.waitForTimeout(500); await p.evaluate(()=>{ const x=document.querySelector('#sceltaNotif [data-scelta=\"essenziali\"]'); x&&x.click(); }); await p.waitForTimeout(200);
  const n2=await p.evaluate(()=>window.__pend.length);
  ok(n1>0 && n2===0, "nativo: promemoria spenti → coda del telefono svuotata ("+n1+" → "+n2+")");
  await p.evaluate(()=>window.__fire("App:resume")); await p.waitForTimeout(600);
  ok((await p.evaluate(()=>window.__pend.length))===0, "nativo: spenti restano spenti anche al ritorno nell'app");
  await p.click('#opzFunzioni [data-gestisci="calendario"]'); await p.waitForTimeout(500);
  const c=await p.evaluate(()=>({cals:Object.keys(window.__cal.cals).length, on:document.querySelector('#opzFunzioni [data-gestisci="calendario"]').getAttribute("aria-checked")}));
  ok(c.cals===0 && c.on==="false", "nativo: calendario spento dall'interruttore e tolto dal telefono "+JSON.stringify(c));
  await p.locator("#opzFunzioni").screenshot({path:SP+"/f-funzioni.png"});
  await ctx.close(); }
console.log("errori:", errs); await b.close();
