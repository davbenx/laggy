// Notifiche che invitano ("Come hai dormito?", consigli) e recensione:
// quando partono, quando si diradano, quando tacciono. App nativa simulata.
import pw from "./_pw.mjs";
const ok=(c,m)=>{ console.log((c?"✔ ":"✘ ")+m); };
const b=await pw.chromium.launch(); const errs=[];
const nativo=()=>{ const on=(n,cb)=>{ (window.__L=window.__L||{})[n]=cb; return Promise.resolve({remove(){}}); };
  window.__sched=[]; window.__rev=0;
  window.Capacitor={isNativePlatform:()=>true,getPlatform:()=>"android",Plugins:{
    LocalNotifications:{checkPermissions:async()=>({display:"granted"}),requestPermissions:async()=>({display:"granted"}),checkExactNotificationSetting:async()=>({exact_alarm:"granted"}),getPending:async()=>({notifications:[]}),schedule:async(x)=>{window.__sched=x.notifications;return {};},cancel:async()=>({}),createChannel:async()=>({}),listChannels:async()=>({channels:[]}),addListener:on},
    App:{getLaunchUrl:async()=>({}),addListener:()=>Promise.resolve({remove(){}}),minimizeApp:async()=>{}}, SystemBars:{setStyle:async()=>{}}, Share:{share:async()=>({})},
    NTWidget:{publish:async()=>({widgets:0}),count:async()=>({widgets:0})}, NTReview:{request:async()=>{window.__rev++;return {};}},
    CapacitorCalendar:{checkAllPermissions:async()=>({result:{readCalendar:"granted",writeCalendar:"granted"}}),listCalendars:async()=>({result:[]}),listEventsInRange:async()=>({result:[]})}}}; };
const ds=n=>{ const d=new Date(); d.setDate(d.getDate()-n); return d.toISOString().slice(0,10); };
async function apri(giorni, extra){
  const ctx=await b.newContext({locale:"it-IT"}); await ctx.addInitScript(nativo);
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.goto("http://localhost:8766/index.html"); await p.waitForTimeout(800);
  await p.click("text=Conosco già il mio schema"); await p.click("[data-preset-ob='0']"); await p.click("[data-pos='0']"); await p.click("#qhConfermaOrari"); await p.waitForTimeout(400);
  await p.evaluate(([f,x])=>{ const st=JSON.parse(localStorage.getItem("nt:state")); st.firstSeenAt=f; st.turniConfigurati=true; localStorage.setItem("nt:state",JSON.stringify(st));
    localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:firstPlanBannerChiuso","true"); for(const k in x) localStorage.setItem("nt:"+k, JSON.stringify(x[k])); }, [ds(giorni), extra||{}]);
  await p.reload(); await p.waitForTimeout(3000);
  return {p, ctx, sched: await p.evaluate(()=>window.__sched.map(n=>({k:n.extra.kind, at:+new Date(n.schedule.at), ch:n.channelId, tab:n.extra.tab})))};
}
const giorno=t=>new Date(t).toDateString();
let r=await apri(10);
const dia=r.sched.filter(n=>n.k==="diario"), con=r.sched.filter(n=>n.k==="consigli");
ok(dia.length>=1 && dia.length<=2, "diario: una o due nei prossimi giorni → "+dia.length);
ok(dia.every(n=>n.ch==="diario"), "diario: canale suo, che si vede (non fra le silenziose)");
ok(new Set(dia.map(n=>giorno(n.at))).size===dia.length, "diario: mai due nello stesso giorno");
ok(con.length===1 && con[0].tab==="consiglio:viaggio", "consiglio: uno solo, il primo che manca (viaggio) → "+JSON.stringify(con.map(n=>n.tab)));
const perG={}; r.sched.forEach(n=>{ const g=giorno(n.at); perG[g]=(perG[g]||0)+1; });
ok(Math.max(...Object.values(perG))<=4, "mai più di 4 notifiche al giorno");
const vicine=r.sched.filter(n=>n.k==="diario"||n.k==="consigli").some(n=>r.sched.some(m=>m!==n && Math.abs(m.at-n.at)<3600e3 && m.k!=="wake"));
ok(!vicine, "inviti mai a meno di un'ora da un'altra notifica");
// tocco sul consiglio → Impostazioni, sezione aperta
await r.p.evaluate(()=>window.__L.localNotificationActionPerformed({notification:{extra:{kind:"consigli",tab:"consiglio:viaggio"}}})); await r.p.waitForTimeout(1000);
ok(await r.p.evaluate(()=>document.body.classList.contains("tab-opzioni") && !document.querySelector("#opzBox4").hidden), "tocco sul consiglio: si apre il tragitto in Impostazioni");
await r.ctx.close();
r=await apri(1);
ok(!r.sched.some(n=>n.k==="consigli"), "primi giorni: nessun consiglio");
await r.ctx.close();
r=await apri(10, {diarioNotif:{prog:[],ignorate:4,ferma:0}});
const d2=r.sched.filter(n=>n.k==="diario").map(n=>n.at).sort();
ok(d2.length<2 || (d2[1]-d2[0])>=2.5*864e5, "3+ senza risposta: si dirada (una ogni 3 giorni)");
await r.ctx.close();
r=await apri(10, {diarioNotif:{prog:[],ignorate:6,ferma:0}});
ok(!r.sched.some(n=>n.k==="diario"), "6 senza risposta: il diario tace");
await r.ctx.close();
r=await apri(10, {notifTipi:["cambio","ret","bedtime","domani"]});
ok(r.sched.some(n=>n.k==="diario"), "chi aveva le 4 essenziali di prima riceve anche le nuove");
await r.ctx.close();
console.log("errori", errs); await b.close();
