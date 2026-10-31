// La schermata segue il tempo anche da aperta: ogni minuto e al ritorno in primo piano il giorno
// mostrato si riallinea e «Adesso» si ridisegna; se hai sfogliato un altro giorno, resti lì.
import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
async function apri(pat, shifts, partenza){
  const ctx=await b.newContext({locale:"it-IT",timezoneId:"Europe/Rome",viewport:{width:360,height:740}});
  await ctx.addInitScript(([pat,shifts])=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
    localStorage.setItem("nt:state",JSON.stringify({turniConfigurati:true,pattern:pat,anchor:"2026-11-02",shifts,repeat:true,firstSeenAt:"2026-01-01"}));
    localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:firstPlanBannerChiuso","true"); localStorage.setItem("nt:attivazioneNascosta","true"); }, [pat,shifts]);
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.clock.install({time:new Date(partenza)});
  await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(700);
  return p;
}
const leggi=p=>p.evaluate(()=>({t:document.querySelector("#dateLabel").textContent, ora:document.querySelector("#ora").innerText.replace(/\s+/g," ").slice(0,90)}));
const ripresa=async p=>{ await p.evaluate(()=>{ Object.defineProperty(document,"visibilityState",{value:"visible",configurable:true}); Object.defineProperty(document,"hidden",{value:false,configurable:true}); document.dispatchEvent(new Event("visibilitychange")); }); await p.waitForTimeout(300); };
const N={N:{n:"Notte",s:1320,e:1800}}, M={M:{n:"Mattino",s:420,e:840}};

{ const p=await apri("NNNRR",N,"2026-11-03T05:50:00+01:00"); const a=await leggi(p);
  await p.clock.fastForward("03:00:00"); await ripresa(p); const b2=await leggi(p);
  ok(a.ora!==b2.ora && /È il momento di dormire/.test(b2.ora) && /^Ancora/.test(b2.t), "ripresa dopo 3 ore (05:50 → 08:50): «Adesso» aggiornato, ora dice di dormire → "+a.ora.slice(0,40)+" ⇒ "+b2.ora.slice(0,40));
  await p.clock.fastForward("06:00:00"); await ripresa(p); const c=await leggi(p);
  ok(/^Oggi, martedì 3/.test(c.t), "dopo il risveglio previsto (14:50) il giorno passa a oggi → "+c.t);
  await p.context().close(); }
{ const p=await apri("MMMMMRR",M,"2026-11-04T04:00:00+01:00"); const a=await leggi(p);   // dorme (21:50 → 05:50): ancora il giorno di ieri
  await p.clock.fastForward("01:00:00"); await ripresa(p); const b2=await leggi(p);
  ok(/Ancora martedì 3/.test(a.t) && /Oggi, mercoledì 4/.test(b2.t), "il giorno passa al nuovo quando finisce il sonno (04:00 → 05:00) → "+a.t+" ⇒ "+b2.t);
  await p.context().close(); }
{ const p=await apri("MMMMMRR",M,"2026-11-03T14:00:00+01:00");
  await p.click("#next"); await p.waitForTimeout(200); const a=await leggi(p);
  await p.clock.fastForward("08:00:00"); await ripresa(p); const b2=await leggi(p);
  ok(a.t===b2.t, "se hai sfogliato un altro giorno, la ripresa non ti riporta indietro → "+b2.t);
  await p.context().close(); }
{ const p=await apri("NNNRR",N,"2026-11-03T05:50:00+01:00");
  await p.click('[data-tab="turni"]'); await p.waitForTimeout(200);
  await p.clock.fastForward("09:00:00"); await ripresa(p);
  ok(await p.evaluate(()=>document.body.classList.contains("tab-turni")), "in un'altra scheda la ripresa non ti sposta né ridisegna sopra");
  await p.click('[data-tab="oggi"]'); await p.waitForTimeout(300); const t=await leggi(p);
  ok(/^Oggi/.test(t.t), "tornando a Oggi il giorno è già quello giusto → "+t.t);
  await p.context().close(); }
console.log("errori", errs); await b.close();
