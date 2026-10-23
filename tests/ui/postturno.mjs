// Dopo lo smonto di una notte, fino al risveglio, Oggi resta sul giorno del turno:
// c'è il sonno che sta per cominciare, la striscia lo mostra e la data dice
// «Ancora giovedì…»; al risveglio passa al giorno nuovo.
import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
async function apri(ora){
  const ctx=await b.newContext({locale:"it-IT",viewport:{width:360,height:740}});
  const ieri=new Date(); ieri.setDate(ieri.getDate()-1);
  await ctx.addInitScript(a=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
    localStorage.setItem("nt:state",JSON.stringify({turniConfigurati:true,pattern:"NNNRR",anchor:a,shifts:{N:{n:"Notte",s:1320,e:1800}},repeat:true,firstSeenAt:"2026-01-01"}));
    localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:firstPlanBannerChiuso","true"); localStorage.setItem("nt:attivazioneNascosta","true"); }, iso(ieri));
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  const [h,m]=ora.split(":").map(Number); const d=new Date(); d.setHours(h,m,0,0); await p.clock.setFixedTime(d);
  await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(1200);
  return p;
}
const stato=p=>p.evaluate(()=>({titolo:document.querySelector("#dateLabel").textContent, ora:document.querySelector("#ora").innerText.replace(/\s+/g," "),
  dormi:!!document.querySelector('#essenziale [data-row="sonno"]'), pill:document.querySelector("#shiftPill").textContent.trim()}));

{ const p=await apri("06:27"), s=await stato(p);
  ok(/^Ancora /.test(s.titolo), "appena smontato: la data dice «Ancora …» → "+s.titolo);
  ok(/a letto alle \d\d:\d\d/.test(s.ora), "«Poi» dice quando andare a letto → "+s.ora);
  ok(s.dormi, "il sonno che sta per cominciare è nel piano");
  ok(await p.evaluate(()=>{ const m=document.querySelector("#formaGiorno svg"); return !!m && m.querySelectorAll("rect,path").length>3; }), "la striscia mostra il sonno davanti");
  await p.context().close(); }
{ const p=await apri("10:00"), s=await stato(p);
  ok(/^Ancora /.test(s.titolo), "durante il sonno resta il giorno del turno → "+s.titolo);
  await p.context().close(); }
{ const p=await apri("15:00"), s=await stato(p);
  ok(/^Oggi, /.test(s.titolo), "dopo il risveglio: «Oggi» sul giorno nuovo → "+s.titolo);
  await p.context().close(); }
console.log("errori", errs); await b.close();
