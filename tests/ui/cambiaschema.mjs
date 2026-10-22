// «I tuoi turni» › «Cambia schema»: la domanda si chiama sempre «Come sono i
// tuoi turni?», anche per chi ha segnato solo oggi (prima: «E nei prossimi giorni?»).
import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const ctx=await b.newContext({locale:"it-IT",viewport:{width:360,height:800}});
await ctx.addInitScript(st=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
  localStorage.setItem("nt:state",JSON.stringify(st)); localStorage.setItem("nt:turniConfigurati","true");
  localStorage.setItem("nt:firstPlanBannerChiuso","true"); localStorage.setItem("nt:attivazioneNascosta","true"); },
  {turniConfigurati:true,pattern:"R",anchor:"2000-01-01",repeat:false,ecc:{[iso(new Date())]:"M"},firstSeenAt:"2026-01-01",shifts:{M:{n:"Mattino",s:420,e:840}}});
const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(900);
await p.evaluate(()=>document.querySelector('[data-tab="turni"]').click()); await p.waitForTimeout(200);
await p.evaluate(()=>document.querySelector("#tEdit").click()); await p.waitForTimeout(300);
await p.evaluate(()=>document.querySelector('[data-tt="schema"]').click()); await p.waitForTimeout(300);
const t=await p.evaluate(()=>(document.querySelector("#demoEsempio .qh-h")||{}).textContent);
ok(t==="Come sono i tuoi turni?", "«Cambia schema» → «"+t+"»");
await p.evaluate(()=>document.querySelector("[data-chiudi-schema]").click()); await p.waitForTimeout(300);
await p.evaluate(()=>document.querySelector('[data-tt="schema"]').click()); await p.waitForTimeout(300);
ok((await p.evaluate(()=>document.querySelector("#demoEsempio .qh-h").textContent))==="Come sono i tuoi turni?", "anche riaprendolo dopo Annulla");
console.log("errori", errs); await b.close();
