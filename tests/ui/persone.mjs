// Turni: «Sonno e carico» e «Tempo libero» in alto; le persone si gestiscono in Impostazioni › Persone; «Rimuovi» nel foglio di modifica.
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
const vaiPersone=p=>p.evaluate(()=>{ document.querySelector("#doOpzioni").click(); document.querySelector('[data-opzg-vai="persone"]').click(); });
{ const p=await apri([]);
  const l=await p.evaluate(()=>{ const a=document.querySelector("#doAndamenti"), tl=document.querySelector("#doPartner"), g=document.querySelector("#strumenti"); return {ordine:!!(a.compareDocumentPosition(tl)&Node.DOCUMENT_POSITION_FOLLOWING) && !!(tl.compareDocumentPosition(g)&Node.DOCUMENT_POSITION_FOLLOWING), fuoriGriglia:!g.contains(a)&&!g.contains(tl), griglia:[...g.querySelectorAll(".tsec")].map(e=>e.id), persone:!!document.querySelector("#doPersone")}; });
  ok(l.ordine && l.fuoriGriglia, "«Sonno e carico» e «Tempo libero» sono due righe sopra la griglia");
  ok(JSON.stringify(l.griglia)===JSON.stringify(["doFerie","doScambioTurno"]) && !l.persone, "la griglia ha Ferie e Cambio turno, senza riquadro Persone → "+l.griglia.join(","));
  await p.evaluate(()=>document.querySelector("#doPartner").click()); await p.waitForTimeout(400);
  ok(await p.evaluate(()=>!document.querySelector("#opzBoxPersone") || document.querySelector("#vederciPagina").querySelector("#opzBoxPersone")===null), "la pagina del tempo libero non contiene più la gestione delle persone");
  ok(await p.evaluate(()=>/Aggiungi qualcuno/.test(document.querySelector("#partner").innerText)), "senza persone: il link «Aggiungi qualcuno →»");
  await p.evaluate(()=>document.querySelector("[data-partner-edit]").click()); await p.waitForTimeout(500);
  ok(await p.evaluate(()=>document.body.classList.contains("opz-g-persone") && document.querySelector("#opzioni .tab-title").textContent==="Persone"), "il link porta a Impostazioni › Persone");
  await p.context().close(); }
{ const p=await apri([{name:"Anna",pattern:"NNRR",anchor:fa(2)},{name:"Luca",pattern:"MMRR",anchor:fa(1)},{name:"Marta",pattern:"PPRR",anchor:fa(0)}]);
  await p.evaluate(()=>document.querySelector("#doOpzioni").click()); await p.waitForTimeout(300);
  ok(await p.evaluate(()=>/Persone[\s\S]*Anna, Luca \+1/.test(document.querySelector("#opzHub").innerText)), "in Impostazioni la riga «Persone» mostra «Anna, Luca +1»");
  await p.evaluate(()=>document.querySelector('[data-opzg-vai="persone"]').click()); await p.waitForTimeout(400);
  ok(await p.evaluate(()=>document.querySelectorAll("#wizPeopleList [data-edit-persona]").length===3), "il gruppo mostra le tre persone con modifica");
  await p.evaluate(()=>document.querySelector('[data-edit-persona="1"]').click()); await p.waitForTimeout(400);
  ok(await p.evaluate(()=>!document.querySelector("#rimuoviPersona").hidden), "modificando una persona compare «Rimuovi questa persona»");
  await p.evaluate(()=>document.querySelector("#rimuoviPersona").click()); await p.waitForTimeout(400);
  const nomi=await p.evaluate(()=>JSON.parse(localStorage.getItem("nt:state")).people.map(x=>x.name));
  ok(JSON.stringify(nomi)==='["Anna","Marta"]', "«Rimuovi» toglie proprio lei (Luca) → "+JSON.stringify(nomi));
  ok(await p.evaluate(()=>document.querySelector("#rimuoviPersona").hidden), "e il pulsante sparisce");
  await p.context().close(); }
console.log("errori",errs); ok(errs.length===0,"nessun errore di pagina"); await b.close();
