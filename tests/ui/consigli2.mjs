// Consigli d'uso delle funzioni nuove (festivi, scelte sul sonno, orari a casa)
// e le statistiche che li misurano: voce del piano aperta (una volta al giorno)
// e orari di sonno personalizzati (una volta sola).
import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
globalThis.__inv=[];
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const fa=n=>{ const d=new Date(); d.setDate(d.getDate()-n); return iso(d); };
const SH={M:{n:"Mattino",s:420,e:840},P:{n:"Pomeriggio",s:840,e:1260},N:{n:"Notte",s:1260,e:1860}};
const TUTTI=["installa","tester","statistiche","colleghi","copia","orologio","mese","festivi","calendario","ferie","scambio","sonno","grazie","medico","dormi","acasa"];
async function apri(st, quale){
  const ctx=await b.newContext({locale:"it-IT",viewport:{width:360,height:740}});
  await ctx.addInitScript(([st,visti])=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
    localStorage.setItem("nt:state",JSON.stringify(st)); localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:firstPlanBannerChiuso","true");
    localStorage.setItem("nt:attivazioneNascosta","true"); localStorage.setItem("nt:analytics-consent","true"); localStorage.setItem("nt:backupDone","true");
    localStorage.setItem("nt:loSapevi", JSON.stringify({visti, migrato:1})); }, [st, TUTTI.filter(k=>k!==quale)]);
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.route("**/collect", r=>{ (globalThis.__inv=globalThis.__inv||[]).push(r.request().postData()||""); r.fulfill({status:204}); });
  await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(1000);
  return p;
}
const ST={turniConfigurati:true,pattern:"MPNSR",anchor:fa(3),shifts:SH,repeat:true,firstSeenAt:fa(40),freeBed:"01:00",freeWake:"09:30",people:[{name:"Anna",pattern:"MMRR",anchor:fa(2)}]};
const tip=p=>p.evaluate(()=>{ const el=document.querySelector("#loSapevi"); return el.hidden ? "" : el.dataset.k+": "+el.textContent; });
// quello che il sito di statistiche ha ricevuto
const coda=async p=>{ await p.waitForTimeout(400); return (globalThis.__inv||[]).join("\n"); };

{ const p=await apri(ST,"festivi"); const t=await tip(p);
  ok(/^festivi: .*festivi del tuo contratto/.test(t), "consiglio festivi → "+t.slice(0,60));
  await p.click("[data-sapevi-prova]"); await p.waitForTimeout(400);
  ok(await p.evaluate(()=>document.body.classList.contains("tab-turni") && !!document.querySelector("#meseBox .mese-fest-box")), "«Aggiungi i tuoi festivi» apre il riquadro dei festivi in Turni");
  ok(await p.evaluate(()=>!!JSON.parse(localStorage.getItem("nt:funzioniUsate")||"{}").festivi), "aperto il riquadro: il consiglio non torna");
  await p.context().close(); }

{ const p=await apri(ST,"dormi"); ok(/^dormi: .*Tocca «Dormi»/.test(await tip(p)), "consiglio sulle scelte di «Dormi»");
  await p.click('[data-row="sonno"] summary'); await p.waitForTimeout(300);
  ok(await p.evaluate(()=>!!JSON.parse(localStorage.getItem("nt:funzioniUsate")||"{}").dormi), "aperta la voce Dormi: consiglio usato");
  const q1=await coda(p); ok(q1.includes("voce_sonno"), "statistica: voce del piano aperta → voce_sonno");
  await p.click('[data-row="sonno"] summary'); await p.click('[data-row="sonno"] summary'); await p.waitForTimeout(200);
  ok((await coda(p)).split("voce_sonno").length===2, "la stessa voce conta una volta al giorno");
  await p.waitForTimeout(5000);
  ok((await coda(p)).includes("orologio_tuo"), "statistica: orari di sonno personalizzati, una volta");
  await p.context().close(); }

{ const p=await apri(ST,"acasa"); ok(/^acasa: .*Condividi i tuoi orari/.test(await tip(p)), "consiglio sugli orari a casa");
  await p.context().close(); }

{ const p=await apri(ST,"ferie"); ok(/insieme/.test(await tip(p)), "ferie: ricorda la scelta «a casa con»");
  await p.context().close(); }

{ const p=await apri({...ST, festiviRiposo:true},"festivi"); ok(!/^festivi/.test(await tip(p)), "chi ha già i festivi come riposo non vede il consiglio");
  await p.context().close(); }

console.log("errori", errs); await b.close();
