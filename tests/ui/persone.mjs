// Turni: «Sonno e carico» in alto, «Persone» nella griglia; un tocco apre l'elenco; «Rimuovi» nel foglio di modifica.
import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const fa=n=>{ const d=new Date(); d.setDate(d.getDate()-n); return iso(d); };
const SH={M:{n:"Mattino",s:420,e:840},P:{n:"Pomeriggio",s:840,e:1260},N:{n:"Notte",s:1320,e:1800}};
const b=await pw.chromium.launch(); const errs=[];
async function apri(people){
  const ctx=await b.newContext({locale:"it-IT",viewport:{width:360,height:900}});
  const st={turniConfigurati:true,pattern:"MPNSR",anchor:fa(2),shifts:SH,repeat:true,firstSeenAt:fa(40),freeBed:"23:30",freeWake:"07:30",people};
  await ctx.addInitScript(st=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1"); localStorage.setItem("nt:state",JSON.stringify(st)); for(const k of ["turniConfigurati","firstPlanBannerChiuso","attivazioneNascosta","backupDone","novitaProva"]) localStorage.setItem("nt:"+k,"true"); localStorage.setItem("nt:novitaViste",JSON.stringify("2099-01-01")); },st);
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(3500);
  await p.evaluate(()=>{ const o=document.querySelector("#novitaOk"); if(o&&!document.querySelector("#novitaModal").hidden) o.click(); });
  await p.evaluate(()=>document.querySelector('[data-tab="turni"]').click()); await p.waitForTimeout(400);
  return p;
}
{ const p=await apri([]);
  const l=await p.evaluate(()=>{ const t=document.querySelector("#doAndamenti"), g=document.querySelector("#strumenti"); return {topPrimaDellaGriglia:!!(t.compareDocumentPosition(g)&Node.DOCUMENT_POSITION_FOLLOWING), fuoriGriglia:!g.contains(t), griglia:[...g.querySelectorAll(".tsec")].map(e=>e.id), sub:document.querySelector("#doPersoneSub").textContent}; });
  ok(l.topPrimaDellaGriglia && l.fuoriGriglia, "«Sonno e carico» è una riga sopra la griglia");
  ok(JSON.stringify(l.griglia)===JSON.stringify(["doPartner","doPersone","doFerie","doScambioTurno"]), "la griglia 2×2 ha Tempo libero, Persone, Ferie, Cambio turno → "+l.griglia.join(","));
  ok(l.sub==="Aggiungi qualcuno", "senza persone: «Aggiungi qualcuno»");
  await p.evaluate(()=>document.querySelector("#doPersone").click()); await p.waitForTimeout(500);
  ok(await p.evaluate(()=>!document.querySelector("#vederciPagina").hidden && !document.querySelector("#opzBoxPersone").hidden), "un tocco su Persone apre la pagina con l'elenco già aperto");
  await p.context().close(); }
{ const p=await apri([{name:"Anna",pattern:"NNRR",anchor:fa(2)},{name:"Luca",pattern:"MMRR",anchor:fa(1)},{name:"Marta",pattern:"PPRR",anchor:fa(0)}]);
  ok(await p.evaluate(()=>document.querySelector("#doPersoneSub").textContent)==="Anna, Luca +1", "con tre persone: «Anna, Luca +1»");
  await p.evaluate(()=>document.querySelector("#doPersone").click()); await p.waitForTimeout(500);
  await p.evaluate(()=>document.querySelector('[data-edit-persona="1"]').click()); await p.waitForTimeout(400);
  ok(await p.evaluate(()=>!document.querySelector("#rimuoviPersona").hidden), "modificando una persona compare «Rimuovi questa persona»");
  await p.evaluate(()=>document.querySelector("#rimuoviPersona").click()); await p.waitForTimeout(400);
  const nomi=await p.evaluate(()=>JSON.parse(localStorage.getItem("nt:state")).people.map(x=>x.name));
  ok(JSON.stringify(nomi)==='["Anna","Marta"]', "«Rimuovi» toglie proprio lei (Luca) → "+JSON.stringify(nomi));
  ok(await p.evaluate(()=>document.querySelector("#rimuoviPersona").hidden), "e il pulsante sparisce");
  await p.context().close(); }
console.log("errori",errs); ok(errs.length===0,"nessun errore di pagina"); await b.close();
