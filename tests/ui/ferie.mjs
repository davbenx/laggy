// Ferie: proposte giuste su un ciclo noto, mese, smonto, ciclo che non si
// ripete, «Segna» con Annulla, freccia indietro. E le altre pagine di Turni
// nascondono ancora il resto (una regola CSS sola per tutte).
import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const nuova=async(st)=>{
  const ctx=await b.newContext({locale:"it-IT",viewport:{width:360,height:740}});
  await ctx.addInitScript(st=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
    localStorage.setItem("nt:state",JSON.stringify(st)); localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:firstPlanBannerChiuso","true"); }, st);
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(900);
  await p.click('[data-tab="turni"]'); await p.waitForTimeout(300);
  return p;
};
const lunghezze=p=>p.evaluate(()=>[...document.querySelectorAll(".ferie-prop .ferie-testa b")].map(e=>parseInt(e.textContent)));
const base=p=>p.evaluate(()=>{ const m=/riposo più lungo.*? è di (\d+) giorn/.exec(document.querySelector(".ferie-base").textContent); return m?+m[1]:0; });
const piu=async(p,k)=>{ for(let i=0;i<Math.abs(k);i++){ await p.click('[data-ferie-n="'+(k>0?1:-1)+'"]'); } await p.waitForTimeout(150); };
const oggi=new Date(); oggi.setHours(12);
const SH={M:{n:"Mattino",s:420,e:840},P:{n:"Pomeriggio",s:840,e:1260},N:{n:"Notte",s:1260,e:1860}};
// MPNSR che parte oggi
let p=await nuova({turniConfigurati:true,pattern:"MPNSR",anchor:iso(oggi),shifts:SH,repeat:true,firstSeenAt:"2026-01-01"});
await p.click("#doFerie"); await p.waitForTimeout(300);
ok(await p.evaluate(()=>!document.querySelector("#feriePagina").hidden && getComputedStyle(document.querySelector("#cyc")).display==="none" && document.querySelector("#doFerie").offsetParent===null),
  "la pagina Ferie si apre da sola, il resto di Turni si nasconde");
ok(await base(p)===2, "senza ferie il riposo più lungo è di 2 giorni (smonto + riposo)");
let L=await lunghezze(p); ok(L.length===3 && L.every(x=>x===7), "3 giorni di ferie → 7 giorni a casa, 3 proposte → "+L);
const ferieOk=await p.evaluate(()=>[...document.querySelectorAll(".ferie-prop")].every(s=>s.querySelectorAll(".fg.ferie").length===3 && /Ferie: /.test(s.innerText)));
ok(ferieOk, "ogni proposta mostra 3 giorni di ferie, evidenziati e scritti");
const turniFerie=await p.evaluate(()=>{ const s=document.querySelector(".ferie-prop"); return {testo:s.querySelector(".ferie-cosa").textContent, sigle:[...s.querySelectorAll(".fg.ferie i")].map(i=>i.textContent).join("")}; });
ok(/Mattino/.test(turniFerie.testo) && /Pomeriggio/.test(turniFerie.testo) && /Notte/.test(turniFerie.testo) && turniFerie.sigle==="MPN", "si vede quali turni lasci: "+turniFerie.testo+" · "+turniFerie.sigle);
await piu(p,2); L=await lunghezze(p); ok(L[0]===9, "5 giorni di ferie → 9 giorni a casa → "+L);
await piu(p,-4); L=await lunghezze(p); ok(L[0]===3 && await p.evaluate(()=>document.querySelector('[data-ferie-n="-1"]').disabled), "1 giorno → 3 a casa; sotto 1 non si scende → "+L);
await piu(p,2);
await p.click("label[for=ferieSmonto]"); await p.waitForTimeout(200);
L=await lunghezze(p); ok(L[0]===6 && await base(p)===1, "smonto escluso: 6 giorni e riposo più lungo di 1 → "+L);
await p.click("label[for=ferieSmonto]"); await p.waitForTimeout(200);
// un mese preciso: le ferie stanno tutte lì
const val=await p.evaluate(()=>{ const s=document.querySelector("#ferieMese"); s.selectedIndex=3; s.dispatchEvent(new Event("change")); return s.value; });
await p.waitForTimeout(200);
const dentro=await p.evaluate(m=>{ const testo=[...document.querySelectorAll(".ferie-prop")].map(s=>s.querySelector(".ferie-quando").textContent); return {n:document.querySelectorAll(".ferie-prop").length, testo}; }, val);
ok(dentro.n>=1, "con un mese scelto ci sono proposte ("+val+") → "+dentro.testo.join(" | "));
// segna e annulla
await p.evaluate(()=>{ const s=document.querySelector("#ferieMese"); s.value=""; s.dispatchEvent(new Event("change")); });
await p.waitForTimeout(200);
await p.click('[data-ferie-segna="0"]'); await p.waitForTimeout(400);
const dopo=await base(p), toast=await p.evaluate(()=>document.querySelector("#toast").textContent);
ok(dopo===7 && /3 giorni segnati come ferie/.test(toast), "«Segna»: i 3 giorni diventano riposo, il riposo più lungo ora è 7 → "+dopo+" · "+toast.trim());
await p.click(".toast-undo"); await p.waitForTimeout(400);
ok(await base(p)===2, "Annulla: tutto come prima");
await p.click("#chiudiFerie"); await p.waitForTimeout(200);
ok(await p.evaluate(()=>document.querySelector("#feriePagina").hidden && getComputedStyle(document.querySelector("#cyc")).display!=="none" && !document.body.classList.contains("sottopagina")), "freccia indietro: si torna a Turni");
// le altre pagine di Turni dopo la regola unica
for(const [apri,chiudi] of [["#doAndamenti","#chiudiAndamenti"],["#doPartner","#chiudiVederci"],["#doScambioTurno","#chiudiScambio"]]){
  await p.click(apri); await p.waitForTimeout(250);
  const v=await p.evaluate(()=>({cyc:getComputedStyle(document.querySelector("#cyc")).display, tsec:[...document.querySelectorAll(".tsec")].every(e=>getComputedStyle(e).display==="none")}));
  await p.click(chiudi); await p.waitForTimeout(200);
  ok(v.cyc==="none" && v.tsec, apri+": il resto di Turni nascosto mentre è aperta");
}
await p.click('[data-tab="oggi"]'); await p.waitForTimeout(200);
ok(await p.evaluate(()=>document.querySelector("#doFerie").offsetParent===null && getComputedStyle(document.querySelector("#feriePagina")).display==="none"), "Ferie non compare in Oggi");
await p.context().close();
// ciclo che non si ripete e finisce presto
p=await nuova({turniConfigurati:true,pattern:"MPN",anchor:iso(oggi),shifts:SH,repeat:false,firstSeenAt:"2026-01-01"});
await p.click("#doFerie"); await p.waitForTimeout(300);
ok(/non si ripete/.test(await p.evaluate(()=>document.querySelector("#ferieOut").innerText)), "ciclo che non si ripete: lo dice invece di proporre a caso");
await p.context().close();
console.log("errori", errs); await b.close();
