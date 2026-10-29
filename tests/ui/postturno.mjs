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
  ok(/Dovresti dormire/.test(s.ora), "in pieno sonno «Adesso» dice di dormire, non di rischio → "+s.ora);
  await p.context().close(); }
{ const p=await apri("15:00"), s=await stato(p);
  ok(/^Oggi, /.test(s.titolo), "dopo il risveglio: «Oggi» sul giorno nuovo → "+s.titolo);
  await p.context().close(); }
// 07:38, turno finito alle 06:15, sonno pianificato dalle 07:10: «Adesso» dice di dormire (non «Rientro»), la linea dell'ora
// sta sotto «Dormi» (già cominciato) e il sonno di stamattina è «Oggi», non «Domani»
{ const ctx=await b.newContext({locale:"it-IT",viewport:{width:360,height:740}});
  const ieri=new Date(); ieri.setDate(ieri.getDate()-1);
  await ctx.addInitScript(a=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
    localStorage.setItem("nt:state",JSON.stringify({turniConfigurati:true,pattern:"NNNRR",anchor:a,shifts:{N:{n:"Notte",s:1320,e:1815}},repeat:true,firstSeenAt:"2026-01-01"}));
    localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:firstPlanBannerChiuso","true"); localStorage.setItem("nt:attivazioneNascosta","true"); }, iso(ieri));
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  const d=new Date(); d.setHours(7,38,0,0); await p.clock.setFixedTime(d);
  await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(1200);
  const x=await p.evaluate(()=>{ const on=document.querySelector("#ora .ora-card"), righe=[...document.querySelectorAll(".tl, .tl-adesso")];
    const dormi=righe.find(r=>r.classList.contains("ora"));
    return {adesso:on?on.innerText.replace(/\s+/g," "):"", linea:righe.findIndex(r=>r.classList.contains("tl-adesso")), iDormi:righe.indexOf(dormi), quando:dormi?(dormi.querySelector(".dwhen")||{}).textContent||"":"?", oraSonno:dormi?dormi.innerText.replace(/\s+/g," ").slice(0,40):""}; });
  ok(/Dovresti dormire/.test(x.adesso) && !/Rientro dal turno/.test(x.adesso), "07:38, sonno già cominciato: «Adesso» dice di dormire, non «Rientro» → "+x.adesso.slice(0,70));
  ok(x.iDormi>=0 && x.linea===-1, "«Dormi» è in corso e ultima voce: la linea dell'ora non va oltre il sonno ("+x.linea+", Dormi alla posizione "+x.iDormi+")");
  ok(x.quando!=="Domani", "il sonno di stamattina non è «Domani» → «"+x.quando+"» "+x.oraSonno);
  await ctx.close(); }
// sonno che comincia dopo mezzanotte (letto all'01:00): prima che cominci sei ancora nel giorno di ieri
{ const ctx=await b.newContext({locale:"it-IT",viewport:{width:360,height:740}});
  await ctx.addInitScript(()=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
    localStorage.setItem("nt:state",JSON.stringify({turniConfigurati:true,pattern:"RRRR",anchor:"2026-01-01",shifts:{N:{n:"Notte",s:1320,e:1800}},repeat:true,firstSeenAt:"2026-01-01",freeBed:"01:00",freeWake:"09:00"}));
    localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:firstPlanBannerChiuso","true"); localStorage.setItem("nt:attivazioneNascosta","true"); });
  const out=[];
  for(const ora of ["00:30","03:00","09:30"]){ const p=await ctx.newPage(); const d=new Date(); d.setHours(...ora.split(":").map(Number),0,0); await p.clock.setFixedTime(d);
    await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(900); out.push([ora, await p.evaluate(()=>document.querySelector("#dateLabel").textContent)]); await p.close(); }
  ok(/^Ancora /.test(out[0][1]) && /^Ancora /.test(out[1][1]) && /^Oggi/.test(out[2][1]), "letto all'01:00: alle 00:30 (prima di dormire) e alle 03:00 ancora ieri, alle 09:30 oggi → "+JSON.stringify(out));
  await ctx.close(); }
console.log("errori", errs); await b.close();
