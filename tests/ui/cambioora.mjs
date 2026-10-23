// Cambio d'ora: nel giorno che comprende il cambio (sabato 24/10/2026 → domenica, 29/03/2026 in
// primavera) il piano lo dice, e per un turno di notte aggiunge che dura un'ora in più o in meno.
// Negli altri giorni niente. E la notte attraversata non rompe nulla (niente NaN, niente errori).
import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
async function apri(quando, st){
  const ctx=await b.newContext({locale:"it-IT",timezoneId:"Europe/Rome",viewport:{width:360,height:740}});
  await ctx.addInitScript(st=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
    localStorage.setItem("nt:state",JSON.stringify(st)); localStorage.setItem("nt:turniConfigurati","true");
    localStorage.setItem("nt:firstPlanBannerChiuso","true"); localStorage.setItem("nt:attivazioneNascosta","true"); }, st);
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.clock.setFixedTime(new Date(quando));
  await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(900);
  return p;
}
const nota=p=>p.evaluate(()=>{ const e=[...document.querySelectorAll("#essenziale .essperche")].find(x=>/Cambio d'ora/.test(x.textContent)); return e ? e.textContent.replace(/\s+/g," ") : ""; });
const NOTTE={turniConfigurati:true,pattern:"NNNRR",anchor:"2026-10-24",shifts:{N:{n:"Notte",s:1320,e:1800}},repeat:true,firstSeenAt:"2026-01-01"};

{ const p=await apri("2026-10-24T12:00:00+02:00", NOTTE), n=await nota(p);
  ok(/tra sabato e domenica l'ora torna indietro: alle 03:00 sono le 02:00/.test(n) && /il tuo turno dura un'ora in più/.test(n), "sabato 24/10, turno di notte: «l'ora torna indietro… il tuo turno dura un'ora in più» → "+n);
  ok(await p.evaluate(()=>!/NaN|undefined|Invalid/.test(document.body.innerText)), "nessun NaN in pagina");
  await p.context().close(); }
{ const p=await apri("2026-10-23T12:00:00+02:00", NOTTE); ok(!(await nota(p)), "venerdì 23/10: niente avviso"); await p.context().close(); }
{ const p=await apri("2026-10-25T14:00:00+01:00", NOTTE); ok(!(await nota(p)), "domenica 25/10 dopo il risveglio: l'avviso non c'è più"); await p.context().close(); }
// notte attraversata: dentro il cambio (seconda 02:30), il piano resta leggibile
{ const p=await apri("2026-10-25T02:30:00+01:00", NOTTE);
  const t=await p.evaluate(()=>({titolo:document.querySelector("#dateLabel").textContent, ora:document.querySelector("#ora").innerText.replace(/\s+/g," ").slice(0,60), nan:/NaN|undefined|Invalid/.test(document.body.innerText)}));
  ok(/^Ancora sabato/.test(t.titolo) && !t.nan && t.ora.length>10, "nella notte del cambio (02:30 dopo il cambio): ancora sabato, piano leggibile → "+t.titolo+" | "+t.ora);
  ok(!!(await nota(p)), "e l'avviso del cambio d'ora è ancora lì"); await p.context().close(); }
// primavera
{ const p=await apri("2026-03-28T12:00:00+01:00", {...NOTTE, anchor:"2026-03-28"}), n=await nota(p);
  ok(/l'ora va avanti: alle 02:00 sono le 03:00/.test(n) && /dura un'ora in meno/.test(n), "sabato 28/03: «l'ora va avanti… un'ora in meno» → "+n);
  await p.context().close(); }
// senza turno di notte: l'avviso c'è ma non parla del turno
{ const p=await apri("2026-10-24T12:00:00+02:00", {turniConfigurati:true,pattern:"MMRR",anchor:"2026-10-24",shifts:{M:{n:"Mattino",s:420,e:840}},repeat:true,firstSeenAt:"2026-01-01"}), n=await nota(p);
  ok(/l'ora torna indietro/.test(n) && !/il tuo turno/.test(n), "turno di giorno: si dice del cambio, non del turno → "+n);
  await p.context().close(); }
console.log("errori", errs); await b.close();
