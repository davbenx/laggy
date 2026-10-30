// Collegamenti dai popup della timeline alle impostazioni giuste: «Turno» e «Caffè» verso Le tue
// abitudini (tragitto, caffè), «Momenti migliori» verso Cosa vedi nel piano.
import pw from "./_pw.mjs";
import { apriVoce, testoVoce, chiudiVoce } from "./_info.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const ctx=await b.newContext({locale:"it-IT",viewport:{width:390,height:844}});
await ctx.addInitScript(()=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
  const I=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  localStorage.setItem("nt:state",JSON.stringify({turniConfigurati:true,pattern:"MPNSR",anchor:I(new Date()),shifts:{M:{n:"Mattino",s:420,e:840},P:{n:"Pomeriggio",s:840,e:1260},N:{n:"Notte",s:1260,e:1860}},repeat:true,firstSeenAt:"2026-01-01",cTo:30,cFrom:20,piano:{testa:true,leggera:true,intensa:true}}));
  localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:firstPlanBannerChiuso","true"); localStorage.setItem("nt:attivazioneNascosta","true"); });
const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
const t=new Date(); t.setHours(8,0,0,0); await p.clock.setFixedTime(t);
await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(1200);

// «Turno»: dice i minuti di tragitto e porta alla sezione giusta
await apriVoce(p,"turno");
const tt=await testoVoce(p);
ok(/30 minuti all'andata e 20 al ritorno/.test(tt), "il perché del turno dice i minuti del tragitto → "+tt.slice(0,120));
await p.click('#infoModal [data-cambia="4"]'); await p.waitForTimeout(400);
ok(await p.evaluate(()=>document.body.classList.contains("tab-opzioni") && !document.querySelector("#opzBox4").hidden && !!document.querySelector("#infoModal").hidden), "«Cambia il tuo tragitto» apre Le tue abitudini, sezione tragitto/caffè, e chiude il popup");
await p.evaluate(()=>document.querySelector("#chiudiOpzioni").click()); await p.waitForTimeout(250);

// «Caffè»: stesso link, stessa sezione
await p.evaluate(()=>document.querySelector('[data-tab="oggi"]').click()); await p.waitForTimeout(250);
await apriVoce(p,"caffe");
ok(await p.evaluate(()=>!!document.querySelector('#infoModal [data-cambia="4"]')), "il popup del caffè ha il link alla sezione del tragitto/caffè");
await p.click('#infoModal [data-cambia="4"]'); await p.waitForTimeout(400);
ok(await p.evaluate(()=>!document.querySelector("#opzBox4").hidden), "porta alla stessa sezione");
await p.evaluate(()=>document.querySelector("#chiudiOpzioni").click()); await p.waitForTimeout(250);

// «Momenti migliori» (testa/movimento/allenamento): link verso Cosa vedi nel piano
await p.evaluate(()=>document.querySelector('[data-tab="oggi"]').click()); await p.waitForTimeout(250);
await apriVoce(p,"fin-testa");
ok(await p.evaluate(()=>!!document.querySelector('#infoModal [data-vai="momenti"]')), "il popup di «Testa» ha il link «Scegli quando preferisci»");
await p.click('#infoModal [data-vai="momenti"]'); await p.waitForTimeout(400);
ok(await p.evaluate(()=>document.body.classList.contains("tab-opzioni") && document.body.classList.contains("opz-g-voci") && !!document.querySelector("#opzPianoVoci .pv-momenti[open]") && !!document.querySelector("#infoModal").hidden), "apre Cosa vedi nel piano con «Momenti migliori» già aperto, e chiude il popup");

console.log("errori", errs); await b.close();
