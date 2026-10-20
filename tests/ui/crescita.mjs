// Inviti, condivisione e azioni nelle notifiche: priorità senza doppioni,
// l'invito manda il proprio ciclo, chi lo riceve ha il piano in un tocco,
// «Come previsto» dalla notifica, passaggio dei dati Safari → Home su iPhone.
import pw from "./_pw.mjs";
const ok=(c,m)=>{ console.log((c?"✔ ":"✘ ")+m); };
const b=await pw.chromium.launch(); const errs=[];
const nativo=()=>{ const on=(n,cb)=>{ (window.__L=window.__L||{})[n]=cb; return Promise.resolve({remove(){}}); };
  window.__sched=[]; window.__azioni=null; window.__share=[];
  window.Capacitor={isNativePlatform:()=>true,getPlatform:()=>"android",Plugins:{
    LocalNotifications:{checkPermissions:async()=>({display:"granted"}),requestPermissions:async()=>({display:"granted"}),checkExactNotificationSetting:async()=>({exact_alarm:"granted"}),getPending:async()=>({notifications:[]}),
      schedule:async(x)=>{ window.__sched.push(...x.notifications); return {}; },cancel:async()=>({}),createChannel:async()=>({}),listChannels:async()=>({channels:[]}),
      registerActionTypes:async(x)=>{ window.__azioni=x; return {}; },addListener:on},
    App:{getLaunchUrl:async()=>({}),addListener:()=>Promise.resolve({remove(){}}),minimizeApp:async()=>{}}, SystemBars:{setStyle:async()=>{}}, Share:{share:async(o)=>{ window.__share.push(o); return {}; }},
    NTWidget:{publish:async()=>({widgets:0}),count:async()=>({widgets:0})}, NTReview:{request:async()=>({})},
    CapacitorCalendar:{checkAllPermissions:async()=>({result:{readCalendar:"granted",writeCalendar:"granted"}}),listCalendars:async()=>({result:[]}),listEventsInRange:async()=>({result:[]})}}}; };
const ds=n=>{ const d=new Date(); d.setDate(d.getDate()-n); return d.toISOString().slice(0,10); };
async function configura(p, primoUso, attivDal){
  await p.click("text=Conosco già il mio schema"); await p.click("[data-preset-ob='0']"); await p.click("[data-pos='0']"); await p.click("#qhConfermaOrari"); await p.waitForTimeout(400);
  await p.evaluate(([f,a])=>{ const st=JSON.parse(localStorage.getItem("nt:state")); st.firstSeenAt=f; st.turniConfigurati=true; localStorage.setItem("nt:state",JSON.stringify(st));
    localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:firstPlanBannerChiuso","true"); if(a) localStorage.setItem("nt:attivazioneDal", JSON.stringify(a)); }, [ds(primoUso), attivDal?ds(attivDal):null]);
  await p.reload(); await p.waitForTimeout(2500);
}
const vis=(p,sel)=>p.evaluate(s=>{ const e=document.querySelector(s); return !!e && !e.hidden && e.offsetParent!==null; }, sel);

// 1. la lista di attivazione tiene in pausa gli altri inviti solo 3 giorni
for(const [giorni, atteso] of [[1,false],[4,true]]){
  const ctx=await b.newContext({locale:"it-IT"}); await ctx.addInitScript(nativo);
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.goto("http://localhost:8766/index.html"); await p.waitForTimeout(700);
  await configura(p, 10, giorni);
  const lista=await vis(p,"#setupChecklist"), invito=await vis(p,"#shareNudge");
  // un invito alla volta: dal quarto giorno l'invito a condividere prende il posto della lista
  ok(lista===!atteso && invito===atteso, "lista di attivazione da "+giorni+" giorni: "+(atteso?"invito a condividere al posto della lista":"lista, invito in pausa")+" (lista "+lista+", invito "+invito+")");
  if(atteso){
    await p.click("#doShareNudge"); await p.waitForTimeout(500);
    const sh=await p.evaluate(()=>window.__share.pop()||{});
    ok(/#/.test(sh.url||"") && /se fai gli stessi/.test(sh.text||"") && !/configurazione/i.test(sh.text||""), "l'invito manda il proprio ciclo, non il backup → "+JSON.stringify(sh).slice(0,160));
    const ciclo=sh.url||"";
    // 2. chi riceve il link: piano pronto, un tocco
    const ctx2=await b.newContext({locale:"it-IT"}); const r=await ctx2.newPage(); r.on("pageerror",e=>errs.push(e.message));
    await r.goto(ciclo.replace(/^https:\/\/[^/]+\//,"http://localhost:8765/index.html")); await r.waitForTimeout(1500);
    const benv=await r.evaluate(()=>{ const e=document.querySelector("#benvenutoLink"); return e && !e.hidden ? e.innerText : ""; });
    ok(/Faccio gli stessi turni/.test(benv) && /I miei sono diversi/.test(benv), "chi apre il link vede le due scelte");
    await r.click("#doSonoIMiei"); await r.waitForTimeout(400);
    const dopo=await r.evaluate(()=>({card:!document.querySelector("#benvenutoLink")||document.querySelector("#benvenutoLink").hidden, conf:JSON.parse(localStorage.getItem("nt:state")||"{}").turniConfigurati}));
    await r.reload(); await r.waitForTimeout(1200);
    const ancora=await vis(r,"#benvenutoLink");
    ok(dopo.card && dopo.conf===true && !ancora, "«Faccio gli stessi turni» → piano suo, il benvenuto non torna → "+JSON.stringify(dopo));
    await ctx2.close();
  }
  // 3. notifica «Come hai dormito?» con i pulsanti, e «Come previsto»
  if(giorni===4){
    const dia=await p.evaluate(()=>window.__sched.filter(n=>n.extra&&n.extra.kind==="diario").map(n=>n.actionTypeId));
    const az=await p.evaluate(()=>window.__azioni && window.__azioni.types[0].actions.map(a=>a.title).join(" / "));
    ok(dia.length>0 && dia.every(x=>x==="diario") && az==="Come previsto / Altri orari", "«Come hai dormito?» ha i pulsanti "+az+" ("+dia.length+" in coda)");
    const sveglia=await p.evaluate(()=>window.__sched.filter(n=>n.extra&&n.extra.kind==="wake").some(n=>n.actionTypeId));
    ok(!sveglia, "«Ora di alzarti» senza pulsanti");
    await p.evaluate(()=>window.__L.localNotificationActionPerformed({actionId:"previsto",notification:{extra:{tab:"diario",kind:"diario"}}})); await p.waitForTimeout(700);
    const reg=await p.evaluate(()=>{ const k=Object.keys(JSON.parse(localStorage.getItem("nt:wakes")||"{}")); const t=document.querySelector("#toast"); return {k, toast:t?t.innerText:""}; });
    ok(reg.k.length===1 && /Registrato: .* → .*Annulla/s.test(reg.toast), "«Come previsto» registra la notte e offre Annulla → "+JSON.stringify(reg));
    await p.click("#toast .toast-undo"); await p.waitForTimeout(300);
    const annullato=await p.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem("nt:wakes")||"{}")).length);
    ok(annullato===0, "Annulla toglie la notte registrata");
  }
  await ctx.close();
}
// 4. web: «Come previsto» dalla notifica del service worker, ad app chiusa
{ const ctx=await b.newContext({locale:"it-IT"}); const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(700); await configura(p, 10, 4);
  await p.goto("http://localhost:8765/index.html?t="+encodeURIComponent("diario?previsto=1")); await p.waitForTimeout(2000);
  const k=await p.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem("nt:wakes")||"{}")).length);
  ok(k===1, "web: «Come previsto» a app chiusa registra la notte");
  await ctx.close(); }
// 5. iPhone: niente invito a installare doppio, e i dati passano da Safari all'app sulla Home
{ const UA="Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
  const ctx=await b.newContext({locale:"it-IT",userAgent:UA,isMobile:true,hasTouch:true,viewport:{width:390,height:844}});
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(700); await configura(p, 10, 1);
  if(await vis(p,"#apriAttivazione")){ await p.click("#apriAttivazione"); await p.waitForTimeout(200); }   // dal secondo giorno la lista è una riga
  ok(await vis(p,'#setupChecklist [data-attiva="installa"]') && !(await vis(p,"#installBanner")), "iPhone: installazione nella lista e nessun invito doppio");
  await p.evaluate(()=>{ localStorage.setItem("nt:diary", JSON.stringify({"2026-01-01":4})); }); await p.click('#setupChecklist [data-attiva="installa"]'); await p.waitForTimeout(1500);
  const copia=await p.evaluate(async()=>{ const r=await (await caches.open("passaggio-ios")).match("/__passaggio"); return r ? Object.keys(await r.json()).length : 0; });
  ok(copia>3, "iPhone: Safari lascia la copia per l'app sulla Home ("+copia+" chiavi)");
  // primo avvio dalla Home: memoria vuota, avvio "standalone"
  const h=await ctx.newPage(); h.on("pageerror",e=>errs.push(e.message));
  await h.addInitScript(()=>{ Object.defineProperty(navigator,"standalone",{get:()=>true}); });
  await h.goto("http://localhost:8765/index.html?standalone=true"); await h.evaluate(()=>{ localStorage.clear(); sessionStorage.clear(); });
  await h.goto("http://localhost:8765/index.html?standalone=true"); await h.waitForTimeout(3000);
  const ripreso=await h.evaluate(()=>({conf:JSON.parse(localStorage.getItem("nt:state")||"{}").turniConfigurati, diario:localStorage.getItem("nt:diary")}));
  ok(ripreso.conf===true && /2026-01-01/.test(ripreso.diario||""), "iPhone: l'app sulla Home riparte con turni e diario di Safari → "+JSON.stringify(ripreso));
  await ctx.close(); }
console.log("errori", errs); await b.close();
