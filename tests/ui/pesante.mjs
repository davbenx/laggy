// Chi usa l'app da anni: due anni di diario e otto colleghi, su un telefono
// lento (CPU 4×). Prima Turni ci metteva più di 20 secondi (gli andamenti
// rifacevano il piano di ogni giorno annotato, più volte a ogni disegno).
import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const ctx=await b.newContext({locale:"it-IT",viewport:{width:360,height:740}});
await ctx.addInitScript(()=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
  const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  const diary={},wakes={},beds={},diaryAt={};
  for(let i=1;i<730;i++){ const d=new Date(); d.setDate(d.getDate()-i); const k=iso(d); diary[k]=1+i%5; wakes[k]="07:"+String(i%60).padStart(2,"0"); beds[k]="23:"+String(i%60).padStart(2,"0"); diaryAt[k]=d.getTime(); }
  const people=[]; for(let i=0;i<8;i++) people.push({name:"Collega "+i,pattern:"MMPPNNRR".slice(i%4)+"RR",anchor:"2026-01-0"+(1+i%9)});
  localStorage.setItem("nt:state",JSON.stringify({turniConfigurati:true,pattern:"MMPPNNSRRR",anchor:"2026-01-05",shifts:{M:{n:"Mattino",s:360,e:840},P:{n:"Pomeriggio",s:840,e:1320},N:{n:"Notte",s:1320,e:1800}},repeat:true,firstSeenAt:"2024-10-01",people}));
  for(const [k,v] of Object.entries({diary,wakes,beds,diaryAt})) localStorage.setItem("nt:"+k,JSON.stringify(v));
  localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:firstPlanBannerChiuso","true"); });
const p=await ctx.newPage(); const errs=[]; p.on("pageerror",e=>errs.push(e.message));
const cdp=await ctx.newCDPSession(p); await cdp.send("Emulation.setCPUThrottlingRate",{rate:4});
let t0=Date.now(); await p.goto("http://localhost:8765/index.html",{waitUntil:"load"}); await p.waitForSelector("#doOpzioni");
const tAvvio=Date.now()-t0; await p.waitForTimeout(1000);
const dipinto=()=>p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
t0=Date.now(); await p.click('[data-tab="turni"]'); await dipinto(); const tTurni=Date.now()-t0;
const r=await p.evaluate(()=>{ for(let i=0;i<3;i++) render(); const T=[]; for(let i=0;i<5;i++){ const t=performance.now(); render(); T.push(performance.now()-t); } return T.map(Math.round).sort((a,b)=>a-b); });
const anteprima=await p.evaluate(()=>document.querySelector("#andamentiAnteprima").textContent);
t0=Date.now(); await p.click("#doAndamenti"); await dipinto(); const tAnd=Date.now()-t0;
const pag=await p.evaluate(()=>({num:(document.querySelector("#andamenti .andamento-num")||{}).textContent||"", testo:document.querySelector("#andamenti").innerText}));
console.log("avvio "+tAvvio+" ms · render "+r.join(",")+" ms");
ok(tAvvio<4000, "avvio con due anni di dati, CPU 4×: "+tAvvio+" ms (limite 4000)");
ok(tTurni<2000, "Turni con due anni di diario e otto colleghi: "+tTurni+" ms (limite 2000; prima oltre 20 s)");
// Con la CPU rallentata le misure ballano (200–450 ms per lo stesso codice);
// prima delle correzioni lo stesso disegno costava secondi.
ok(r[2]<500, "render() in Turni, CPU 4×: mediana "+r[2]+" ms (limite 500)");
ok(tAnd<2500 && /\d|✓/.test(pag.num) && !/NaN|undefined/.test(pag.testo), "«Sonno e carico» si apre in "+tAnd+" ms con i numeri veri ("+pag.num.trim()+")");
const n=pag.num.trim().replace(/^[-+−]\s*/,"");
ok(/Ti mancano|in pari/.test(anteprima) && (anteprima.includes(n) || /in pari$/.test(anteprima)), "anteprima in Turni coerente con la pagina: «"+anteprima+"»");
ok(errs.length===0, "nessun errore"+(errs.length?": "+errs.slice(0,2).join(" | "):""));
await b.close();
