// «Libero»: con chi (le ore libere in comune con le persone che segui) e qualche idea secondo il momento:
// prima movimento e persone, nell'ultima ora e mezza prima di dormire le cose calme, dopo la notte cose leggere.
// Senza persone, un invito ad aggiungerne una; con i momenti migliori spenti, un rimando per accenderli.
import pw from "./_pw.mjs";
import { apriVoce, testoVoce } from "./_info.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const SH={M:{n:"Mattino",s:360,e:840},P:{n:"Pomeriggio",s:840,e:1320},N:{n:"Notte",s:1320,e:1800}};
// ciclo MPNSR dal 19/10/2026: 4/11 pomeriggio, 6/11 smonto, 7/11 riposo; Anna MMRR dal 20/10: il 7/11 è a riposo
const base={turniConfigurati:true,pattern:"MPNSR",anchor:"2026-10-19",shifts:SH,repeat:true,firstSeenAt:"2026-01-01",freeBed:"23:30",freeWake:"07:30"};
const ANNA=[{name:"Anna",pattern:"MMRR",anchor:"2026-10-20",wake:"08:00",bed:"00:30"}];
const apri=async(data,st)=>{
  const ctx=await b.newContext({locale:"it-IT",viewport:{width:360,height:740}});
  await ctx.addInitScript(st=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1"); localStorage.setItem("nt:state",JSON.stringify(st));
    localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:firstPlanBannerChiuso","true"); localStorage.setItem("nt:attivazioneNascosta","true"); localStorage.setItem("nt:backupDone","true"); },st);
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.clock.install({time:data}); await p.goto("http://localhost:8765/index.html"); await p.clock.runFor(1500); return p;
};
const riga=p=>p.evaluate(()=>{ const r=document.querySelector('#essenziale [data-row="liberi"]'); return r ? r.innerText.replace(/\s+/g," ") : ""; });

let p=await apri(new Date(2026,10,7,10,0),{...base,people:ANNA});
let r=await riga(p); await apriVoce(p,"liberi"); let t=await testoVoce(p);
ok(/con Anna/.test(r) && !/con Anna dalle/.test(r), "riposo insieme: la riga dice «con Anna» → "+r);
ok(/tutto con Anna/.test(t) && !/Insieme/.test(t), "il tempo libero è tutto in comune: lo dice la riga dell'orario, senza ripeterlo in «Insieme»");
ok(/Qualche idea[\s\S]*muoverti[\s\S]*cose calme/.test(t), "qualche idea: prima movimento e persone, poi le cose calme prima di dormire");
ok(/\d\d:\d\d → 20:50\s*cose calme/.test(t) && /19:20 → 20:50/.test(t), "le cose calme nell'ultima ora e mezza prima di dormire (a letto alle 20:50 prima del mattino)");
await p.click('#infoCorpo [data-vai="momenti"]'); await p.waitForTimeout(500);
ok(await p.evaluate(()=>{ const d=document.querySelector("#opzPianoVoci .pv-momenti"); return !!d && d.open && !!d.offsetParent; }), "«Vedi il momento migliore per muoverti» apre i momenti migliori");
await p.context().close();

p=await apri(new Date(2026,10,6,15,0),{...base,people:ANNA});
r=await riga(p); await apriVoce(p,"liberi"); t=await testoVoce(p);
ok(/con Anna dalle \d\d:\d\d/.test(r) && /Insieme[\s\S]*libero con Anna/.test(t), "smonto: insieme solo in parte → «con Anna dalle…» e la sezione «Insieme» → "+r);
ok(/dopo la notte, cose leggere/.test(t) && !/meglio all'aperto/.test(t), "dopo la notte: idee leggere, non «muoverti»");
await p.context().close();

p=await apri(new Date(2026,10,4,8,0),{...base,piano:{leggera:true}});
await apriVoce(p,"liberi"); t=await testoVoce(p);
ok(/Aggiungi chi vive con te/.test(t) && !/momento migliore per muoverti/.test(t), "senza persone: l'invito ad aggiungerne una; con «Movimento» acceso niente rimando ai momenti");
await p.click('#infoCorpo [data-vai="persone"]'); await p.waitForTimeout(500);
ok(await p.evaluate(()=>{ const g=document.querySelector('[data-opzg="persone"]'); return !!g && !!g.offsetParent; }), "«Aggiungi una persona» apre Persone");
await p.context().close();
console.log("errori", errs); await b.close();
