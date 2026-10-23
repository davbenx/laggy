// Impostazioni › Cosa vedi nel piano: le voci facoltative (Luce, Penombra, Pasti, Tempo libero e i tre
// momenti migliori) si accendono e spengono; quelle essenziali (Dormi, Turno…) ci sono sempre.
// Predefinito: le voci di sempre accese, i momenti migliori spenti.
import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const ST={turniConfigurati:true,pattern:"PPPPPRR",anchor:"2026-11-03",repeat:true,firstSeenAt:"2026-01-01",shifts:{P:{n:"Pomeriggio",s:840,e:1320}}};
async function apri(extra={}){
  const ctx=await b.newContext({locale:"it-IT",timezoneId:"Europe/Rome",viewport:{width:360,height:780}});
  await ctx.addInitScript(st=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
    localStorage.setItem("nt:state",JSON.stringify(st)); localStorage.setItem("nt:turniConfigurati","true");
    localStorage.setItem("nt:firstPlanBannerChiuso","true"); localStorage.setItem("nt:attivazioneNascosta","true"); }, {...ST,...extra});
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.clock.setFixedTime(new Date("2026-11-03T09:00:00+01:00"));
  await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(900);
  return p;
}
const voci=p=>p.evaluate(()=>[...document.querySelectorAll("#essenziale .tl")].map(x=>(x.querySelector(".el")||{}).textContent));

{ const p=await apri(), v=await voci(p);
  ok(["Luce","Pasti","Turno","Dormi"].every(x=>v.includes(x)) && !v.some(x=>/Testa|Movimento|Allenamento/.test(x)), "predefinito: le voci di sempre ci sono, i momenti migliori no → "+v.join(", "));
  await p.click("#doOpzioni"); await p.waitForTimeout(400);
  const sw=await p.evaluate(()=>[...document.querySelectorAll("#opzPianoVoci input[data-pv]")].map(i=>i.dataset.pv+":"+i.checked));
  ok(sw.length===7 && sw.slice(0,4).every(x=>x.endsWith("true")) && sw.slice(4).every(x=>x.endsWith("false")), "Impostazioni: sette interruttori, quattro accesi e tre spenti → "+sw.join(" "));
  ok(await p.evaluate(()=>/Dormi, Turno, Pisolino, Ultimo caffè e Rientro ci sono sempre/.test(document.querySelector("#opzioni").innerText)), "dice quali voci ci sono sempre");
  await p.click('label[for="pv-luce"]'); await p.click('label[for="pv-testa"]'); await p.waitForTimeout(300);
  await p.click("#doOpzioni").catch(()=>{}); await p.evaluate(()=>document.querySelector('[data-tab="oggi"]').click()); await p.waitForTimeout(400);
  const v2=await voci(p);
  ok(!v2.includes("Luce") && v2.includes("Testa") && v2.includes("Turno") && v2.includes("Dormi"), "spenta Luce e accesa Testa: Oggi li segue, Turno e Dormi restano → "+v2.join(", "));
  const salvato=await p.evaluate(()=>JSON.parse(localStorage.getItem("nt:state")).piano);
  await p.waitForTimeout(4500);
  ok((await p.evaluate(()=>JSON.parse(localStorage.getItem("nt:state")).piano))?.luce===false, "la scelta si salva con le altre impostazioni");
  await p.context().close(); }
{ const p=await apri({piano:{pasti:false,liberi:false,penombra:false}}), v=await voci(p);
  ok(!v.includes("Pasti") && !v.includes("Libero") && !v.includes("Penombra") && v.includes("Luce"), "pasti, tempo libero e penombra spenti → "+v.join(", "));
  await p.context().close(); }
console.log("errori", errs); await b.close();
