// La fonte del sonno: le notti registrate «come da piano» (un tocco, dal widget o dagli stessi orari del piano) non misurano la
// regolarità; quelle con orari corretti sì. Il debito di sonno le conta tutte.
import pw from "./_pw.mjs";
import { espandi } from "./_andamenti.mjs";
import { nativo } from "./_nativo.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const fa=n=>{ const d=new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()-n); return iso(d); };
const ST={turniConfigurati:true,pattern:"MPNSR",anchor:fa(0),repeat:true,firstSeenAt:fa(40),freeBed:"00:30",freeWake:"08:30",
  shifts:{M:{n:"Mattino",s:360,e:840},P:{n:"Pomeriggio",s:840,e:1320},N:{n:"Notte",s:1320,e:1800}}};
const BED=["22:30","23:45","00:30","01:15","23:00","00:50","22:10","01:40"], WAKE=["06:30","07:45","08:30","09:15","07:00","08:50","06:10","09:40"];

async function apri(risposte){
  const ctx=await b.newContext({locale:"it-IT",viewport:{width:390,height:844}});
  await ctx.addInitScript(nativo);
  await ctx.addInitScript(r=>{ window.__risposte=r; },risposte);
  await ctx.addInitScript(st=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1"); localStorage.setItem("nt:state",JSON.stringify(st)); localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:firstPlanBannerChiuso","true"); localStorage.setItem("nt:attivazioneNascosta","true"); localStorage.setItem("nt:backupDone","true"); },ST);
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.goto("http://localhost:8766/index.html"); await p.waitForTimeout(2600);
  return p;
}
const apriAndamenti=async p=>{ await p.evaluate(()=>document.querySelector('[data-tab="turni"]').click()); await p.waitForTimeout(400); await p.evaluate(()=>document.querySelector("#doAndamenti").click()); await p.waitForTimeout(600); await espandi(p); };

// 10 notti «Sì, così» (fonte p, anche senza campo: le risposte vecchie del widget erano tutte così) e 8 corrette (fonte m)
{ const r={}; for(let i=1;i<=10;i++) r[fa(i)]={sonno:true,bed:"23:30",wake:"07:30",fonte:i%2?"p":undefined};
  for(let i=0;i<8;i++) r[fa(11+i)]={sonno:true,bed:BED[i],wake:WAKE[i],fonte:"m"};
  const p=await apri(r);
  const s=await p.evaluate(()=>({piano:Object.keys(JSON.parse(localStorage.getItem("nt:sonnoPiano")||"{}")).length, notti:Object.keys(JSON.parse(localStorage.getItem("nt:beds")||"{}")).length}));
  ok(s.notti===18 && s.piano===10, "widget: 18 notti importate, 10 segnate «come da piano» ("+JSON.stringify(s)+")");
  await apriAndamenti(p);
  const o=await p.evaluate(()=>{ const sez=document.querySelector("#andamenti #orari"); return sez ? {testo:sez.textContent, punti:sez.querySelectorAll("circle.g-punto").length} : null; });
  ok(o && /Le 8 notti dormite/.test(o.testo) && o.punti===16, "Gli orari del tuo sonno: contano solo le 8 notti corrette (16 punti: letto e sveglia) → "+(o&&o.testo.slice(0,40)));
  ok(o && /10 notti registrate «come previsto» non contano/.test(o.testo), "Gli orari del tuo sonno: dice che 10 notti «come previsto» non contano");
  await p.context().close(); }

// solo notti «come da piano»: niente regolarità inventata, e lo dice
{ const r={}; for(let i=1;i<=9;i++) r[fa(i)]={sonno:true,bed:"23:30",wake:"07:30",fonte:"p"};
  const p=await apri(r); await apriAndamenti(p);
  const o=await p.evaluate(()=>{ const sez=document.querySelector("#andamenti #orari"); return sez ? {testo:sez.textContent, punti:sez.querySelectorAll("circle.g-punto").length, righe:sez.querySelectorAll(".rows .row").length} : null; });
  ok(o && o.punti===0 && !/regolare|variabile/.test(o.testo) && /9 notti registrate «come previsto» non contano/.test(o.testo) && /almeno cinque notti con i tuoi orari veri/.test(o.testo), "solo notti «come previsto»: nessun grafico né «molto regolare», e il perché");
  await p.context().close(); }

console.log("errori", errs); await b.close();
