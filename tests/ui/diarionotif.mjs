// Annotare il sonno nell'app toglie subito «Come hai dormito?» di oggi dalla
// coda del telefono (prima si ricalcolava solo alla riapertura dell'app).
import pw from "./_pw.mjs";
import { nativo } from "./_nativo.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const oggi=new Date(); oggi.setHours(6,40,0,0);   // sveglio prima del previsto (07:30): la domanda è per le 08:15
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const ctx=await b.newContext({locale:"it-IT",viewport:{width:360,height:740}});
await ctx.clock.install({time:oggi});
await ctx.addInitScript(nativo);
await ctx.addInitScript(a=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
  const f=new Date(a+"T12:00:00"); f.setDate(f.getDate()-10);
  localStorage.setItem("nt:state",JSON.stringify({turniConfigurati:true,pattern:"RRRRRRR",anchor:a,shifts:{M:{n:"Mattino",s:420,e:840}},repeat:true,firstSeenAt:iso(f),freeBed:"23:30",freeWake:"07:30"}));
  function iso(d){ return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
  localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:firstPlanBannerChiuso","true"); localStorage.setItem("nt:attivazioneNascosta","true"); }, iso(oggi));
const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
await p.goto("http://localhost:8766/index.html"); await p.clock.runFor(2500);
const diarioOggi=()=>p.evaluate(k=>{ const ultimo=window.__sched.slice(-60); return window.__sched.filter(n=>n.extra&&n.extra.kind==="diario").filter(n=>new Date(n.schedule.at).toDateString()===new Date().toDateString()).length; }, iso(oggi));
const prima=await diarioOggi();
ok(prima>0, "prima: «Come hai dormito?» di oggi in coda ("+prima+")");
await p.evaluate(()=>{ window.__sched=[]; });
await p.click("[data-confirm-sleep]"); await p.clock.runFor(1500);
const n=await p.evaluate(()=>window.__sched.length), dopo=await diarioOggi();
ok(n>0 && dopo===0, "registrato il sonno: la coda si rifà subito, senza la domanda di oggi ("+n+" promemoria, diario oggi "+dopo+")");
// si guarda la settimana dopo e l'app va in secondo piano: i promemoria di domani restano
const perDomani=()=>p.evaluate(()=>{ const d=new Date(); d.setDate(d.getDate()+1); return window.__sched.filter(n=>new Date(n.schedule.at).toDateString()===d.toDateString()).length; });
const base=await perDomani();
await p.evaluate(()=>{ window.__sched=[]; }); for(let i=0;i<7;i++){ await p.click("#next"); await p.clock.runFor(150); }
await p.evaluate(()=>{ Object.defineProperty(document,"visibilityState",{configurable:true,get:()=>"visible"}); document.dispatchEvent(new Event("visibilitychange")); });
await p.clock.runFor(1500);
const domani=await perDomani();
ok(domani>0 && domani===base, "guardando la settimana dopo, i promemoria di domani restano tutti in coda ("+domani+" di "+base+")");
console.log("errori", errs); await b.close();
