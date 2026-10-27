// Festivi del contratto: una riga nel riquadro del mese, un piccolo editor
// (giorno e mese, ogni anno), «nei festivi non lavoro» solo per l'orario fisso.
import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const lunedi=()=>{ const d=new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()-((d.getDay()+6)%7)); return iso(d); };
async function apri(st){
  const ctx=await b.newContext({locale:"it-IT",viewport:{width:360,height:800}});
  await ctx.addInitScript(st=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
    localStorage.setItem("nt:state",JSON.stringify(st)); localStorage.setItem("nt:turniConfigurati","true");
    localStorage.setItem("nt:firstPlanBannerChiuso","true"); localStorage.setItem("nt:attivazioneNascosta","true"); }, st);
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(1200);
  await p.evaluate(()=>document.querySelector('[data-tab="turni"]').click()); await p.waitForTimeout(300);
  return p;
}
const numFestivi=p=>p.evaluate(()=>{ const d=[...document.querySelectorAll("#meseBox .mese-num div")].find(x=>/festivi/.test(x.textContent)); return d ? +d.querySelector("b").textContent : null; });
const TURNO={M:{n:"Mattino",s:420,e:840}};

{ const p=await apri({turniConfigurati:true,pattern:"MMMMMRR",anchor:lunedi(),repeat:true,firstSeenAt:"2026-01-01",shifts:TURNO});
  const riga=await p.evaluate(()=>document.querySelector("#meseBox .mese-fest").textContent.trim());
  ok(/^FestiviConto le domeniche e i festivi nazionali\./.test(riga), "una riga dice cosa si conta → "+riga);
  const prima=await numFestivi(p);
  await p.evaluate(()=>document.querySelector("[data-fest-apri]").click()); await p.waitForTimeout(150);
  const d=new Date(); d.setHours(12,0,0,0); d.setDate(15); if(d.getDay()===0) d.setDate(16);
  await p.fill("#festData", iso(d)); await p.evaluate(()=>document.querySelector("[data-fest-add]").click()); await p.waitForTimeout(250);
  const dopo=await numFestivi(p);
  ok(dopo===prima+1, "aggiunto un giorno del mese corrente: i festivi contati passano da "+prima+" a "+dopo);
  const chip=await p.evaluate(()=>[...document.querySelectorAll("[data-fest-del]")].map(x=>x.textContent.trim()));
  ok(chip.length===1 && /×$/.test(chip[0]), "il giorno compare come voce da togliere → "+chip.join());
  const salvato=await p.evaluate(()=>JSON.parse(localStorage.getItem("nt:state")).festivi);
  ok(salvato && salvato.extra.length===1 && /^\d+-\d+$/.test(salvato.extra[0]), "salvato come giorno-mese, ogni anno → "+JSON.stringify(salvato));
  ok(await p.evaluate(()=>!!document.querySelector("[data-fest-riposo]")), "orario fisso: compare «Nei festivi non lavoro»");
  await p.evaluate(()=>document.querySelector("[data-fest-del]").click()); await p.waitForTimeout(250);
  ok((await numFestivi(p))===prima, "tolto: si torna a "+prima);
  await p.evaluate(()=>{ const c=document.querySelector("[data-fest-dom]"); c.click(); }); await p.waitForTimeout(250);
  const senzaDom=await numFestivi(p);
  ok(senzaDom<=prima, "senza «la domenica è festiva» le domeniche non contano più ("+prima+" → "+senzaDom+")");
  await p.context().close(); }

{ const p=await apri({turniConfigurati:true,pattern:"MPNSR",anchor:lunedi(),repeat:true,firstSeenAt:"2026-01-01",shifts:{M:{n:"Mattino",s:420,e:840},P:{n:"Pomeriggio",s:840,e:1260},N:{n:"Notte",s:1260,e:1860}}});
  await p.evaluate(()=>document.querySelector("[data-fest-apri]").click()); await p.waitForTimeout(150);
  ok(await p.evaluate(()=>!document.querySelector("[data-fest-riposo]")), "turni a ciclo: niente «Nei festivi non lavoro» (si lavora anche nei festivi)");
  await p.context().close(); }
console.log("errori", errs); await b.close();
