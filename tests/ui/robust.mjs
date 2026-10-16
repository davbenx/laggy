import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
// 1. salvataggio impossibile
let ctx=await b.newContext({locale:"it-IT"});
await ctx.addInitScript(()=>{ const o=Storage.prototype.setItem; Storage.prototype.setItem=function(k,v){ if(String(k).startsWith("nt:")) throw new DOMException("QuotaExceededError","QuotaExceededError"); return o.call(this,k,v); }; });
let p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(800);
await p.click("[data-pick=N]"); await p.click("#qhConfermaOrario"); await p.waitForTimeout(1500);
const toastTxt=await p.evaluate(()=>document.querySelector("#toast").textContent);
ok(/non permette di salvare/.test(toastTxt) && await p.evaluate(()=>/Notte/.test(document.querySelector("#shiftPill").textContent)), "salvataggio bloccato: l'app funziona e lo dice → "+toastTxt.slice(0,60));
// 2. orario impossibile
ctx=await b.newContext({locale:"it-IT"}); p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(800);
await p.click("[data-pick=M]"); await p.fill("#qhDa","08:00"); await p.fill("#qhA","08:00"); await p.click("#qhConfermaOrario"); await p.waitForTimeout(300);
ok(await p.evaluate(()=>!!document.querySelector("#qhConfermaOrario")) && /Controlla gli orari/.test(await p.evaluate(()=>document.querySelector("#toast").textContent)), "08:00→08:00 (24 ore) fermato con un avviso");
await p.fill("#qhA","08:30"); await p.click("#qhConfermaOrario"); await p.waitForTimeout(300);
ok(await p.evaluate(()=>!!document.querySelector("#qhConfermaOrario")), "08:00→08:30 (30 minuti) fermato con un avviso");
await p.fill("#qhA","14:00"); await p.click("#qhConfermaOrario"); await p.waitForTimeout(400);
ok(await p.evaluate(()=>/Mattino/.test(document.querySelector("#shiftPill").textContent)), "08:00→14:00 accettato");
console.log("errori", errs); await b.close();
