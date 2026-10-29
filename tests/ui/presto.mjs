// A letto molto presto prima di un mattino: su Oggi le due strade con gli
// orari veri (stessa preferenza di Impostazioni), e il dettaglio non dice più
// «dormi senza guardare l'orologio» con una sveglia alle 04:50.
import pw from "./_pw.mjs";
import { apriVoce, testoVoce, chiudiVoce } from "./_info.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const apri=async(pattern, inizio)=>{
  const ctx=await b.newContext({locale:"it-IT",viewport:{width:360,height:740}});
  await ctx.addInitScript(([a,pat,s])=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
    localStorage.setItem("nt:state",JSON.stringify({turniConfigurati:true,pattern:pat,anchor:a,shifts:{M:{n:"Mattino",s,e:840}},repeat:true,firstSeenAt:"2026-01-01"}));
    localStorage.setItem("nt:attivazioneNascosta","true"); localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:firstPlanBannerChiuso","true"); }, [iso(new Date()), pattern, inizio]);
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(1000); return p;
};
const leggi=p=>p.evaluate(()=>({dormi:document.querySelector('[data-row="sonno"] .en').innerText.replace(/\s+/g," "),
  opz:[...document.querySelectorAll("[data-mattinobif]")].map(x=>({t:x.querySelector("b").textContent, ora:x.querySelector("span").textContent, on:x.getAttribute("aria-pressed")})),
  hint:!!document.querySelector(".dopo-notte .dn-hint")}));
let p=await apri("RM",360);
let r=await leggi(p);
ok(r.opz.length===2 && r.opz[0].on==="true" && r.dormi.includes(r.opz[0].ora.replace("a letto alle ","")) && r.hint, "riposo prima di un mattino alle 06: «Tutto stanotte» / «Più tardi + pisolino» con l'ora di letto ("+r.opz.map(o=>o.ora).join(" / ")+")");
await apriVoce(p,"sonno");
const det=await testoVoce(p); await chiudiVoce(p);
// l'ora del turno la dice già la riga «Il piano, in breve»: qui la sveglia e da dove viene
ok(/Stanotte la sveglia è alle 04:50, contata all'indietro dal turno di domani/.test(det) && !/senza guardare l'orologio/.test(det), "il dettaglio dice il motivo, non «dormi senza guardare l'orologio»");
await p.click('[data-mattinobif="1"]'); await p.waitForTimeout(400);
r=await leggi(p);
ok(r.opz[1].on==="true" && r.dormi.includes(r.opz[1].ora.replace("a letto alle ","")) && !r.hint, "scelto «Più tardi + pisolino»: «Dormi» si sposta, la spiegazione sparisce");
ok(await p.evaluate(()=>document.querySelector("#mattinoBif").checked && JSON.parse(localStorage.getItem("nt:state")).mattinoBifasico===true), "è la stessa preferenza di Impostazioni, salvata");
await p.context().close();
p=await apri("RM",480);   // mattino alle 8: niente letto presto
ok((await leggi(p)).opz.length===0, "mattino alle 08:00: a letto a un'ora normale, niente scelta");
await p.context().close();
console.log("errori", errs); await b.close();
