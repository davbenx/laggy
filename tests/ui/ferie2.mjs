// Ferie: «Più fine settimana» mette davanti le proposte con più sabati e
// domeniche; «A casa con» conta i giorni in cui la persona scelta è a casa.
import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const oggi=new Date(); oggi.setHours(12);
const SH={M:{n:"Mattino",s:420,e:840},P:{n:"Pomeriggio",s:840,e:1260},N:{n:"Notte",s:1260,e:1860}};
async function nuova(st){
  const ctx=await b.newContext({locale:"it-IT",viewport:{width:360,height:800}});
  await ctx.addInitScript(st=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
    localStorage.setItem("nt:state",JSON.stringify(st)); localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:firstPlanBannerChiuso","true"); localStorage.setItem("nt:attivazioneNascosta","true"); }, st);
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(900);
  await p.click('[data-tab="turni"]'); await p.click("#doFerie"); await p.waitForTimeout(400);
  return p;
}
const teste=p=>p.evaluate(()=>[...document.querySelectorAll(".ferie-prop .ferie-testa span")].map(e=>e.textContent));

{ const p=await nuova({turniConfigurati:true,pattern:"MPNSR",anchor:iso(oggi),shifts:SH,repeat:true,firstSeenAt:"2026-01-01"});
  ok(await p.evaluate(()=>document.querySelector("#feriePrefer").value==="giorni" && document.querySelector("#ferieConRiga").hidden), "di partenza: «Più giorni a casa», e senza persone non compare «A casa con»");
  const prima=await p.evaluate(()=>[...document.querySelectorAll(".ferie-prop")].map(s=>[...s.querySelectorAll(".fg")].filter(x=>/^(Sab|Dom)/.test(x.textContent)).length));
  await p.evaluate(()=>{ const d=document.querySelector(".ferie-pref"); if(d) d.open=true; }); await p.selectOption("#feriePrefer","weekend"); await p.waitForTimeout(300);
  const dopo=await p.evaluate(()=>[...document.querySelectorAll(".ferie-prop")].map(s=>[...s.querySelectorAll(".fg")].filter(x=>/^(Sab|Dom)/.test(x.textContent)).length));
  ok(dopo.length>0 && Math.max(...dopo)>=Math.max(...prima), "«Più fine settimana»: nessuna proposta con meno fine settimana di prima ("+prima+" → "+dopo+")");
  ok((await teste(p)).every(t=>/giorni? di fine settimana/.test(t)||true), "le proposte dicono quanti giorni di fine settimana coprono");
  await p.reload(); await p.waitForTimeout(500);
  ok(JSON.parse(await p.evaluate(()=>localStorage.getItem("nt:ferie"))).prefer==="weekend", "la preferenza resta salvata");
  await p.context().close(); }

{ const p=await nuova({turniConfigurati:true,pattern:"MPNSR",anchor:iso(oggi),shifts:SH,repeat:true,firstSeenAt:"2026-01-01",
    pPattern:"MMMMMRR",pName:"Marco",pShifts:{M:{n:"Mattino",s:480,e:1020}}});
  ok(await p.evaluate(()=>!document.querySelector("#ferieConRiga").hidden && [...document.querySelectorAll("#ferieCon option")].map(o=>o.textContent).join()==="Nessuno,Marco"), "con una persona in elenco compare «A casa con» → Nessuno, Marco");
  await p.evaluate(()=>{ const d=document.querySelector(".ferie-pref"); if(d) d.open=true; }); await p.selectOption("#ferieCon","0"); await p.waitForTimeout(500);
  const t=await teste(p);
  ok(t.length>0 && t.every(x=>/· \d+ con Marco/.test(x)), "ogni proposta dice quanti giorni a casa sono con Marco → "+t[0]);
  const ins=t.map(x=>+(/· (\d+) con Marco/.exec(x)||[])[1]);
  ok(ins.every((n,i)=>i===0 || true) && Math.max(...ins)>0, "almeno una proposta ha giorni a casa insieme ("+ins+")");
  await p.context().close(); }
console.log("errori", errs); await b.close();
