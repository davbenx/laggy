import pw from "./_pw.mjs";
import fs from "fs";
const SP=(process.env.OUT||"/tmp");
const AXE=fs.readFileSync(process.env.AXE_JS,"utf8");
const b=await pw.chromium.launch(); const errs=[];
const ctx=await b.newContext({viewport:{width:360,height:780},locale:"it-IT"});
const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message)); p.on("console",m=>{ if(m.type()==="error") errs.push("console: "+m.text()); });
const cdp=await ctx.newCDPSession(p); await cdp.send("Emulation.setCPUThrottlingRate",{rate:4});
let t0=Date.now(); await p.goto("http://localhost:8765/index.html",{waitUntil:"load"});
await p.waitForSelector("[data-pick],[data-preset-ob],#doOpzioni");
const tPrimo=Date.now()-t0; console.log((tPrimo<2500?"✔ ":"✘ ")+"primo avvio con CPU 4× più lenta: pronta in "+tPrimo+" ms (limite 2500)");
const pm=await p.evaluate(()=>{ const n=performance.getEntriesByType("navigation")[0]; return {dcl:Math.round(n.domContentLoadedEventEnd), load:Math.round(n.loadEventEnd), lcp:0}; });
console.log("DOMContentLoaded", pm.dcl, "ms, load", pm.load, "ms");
await p.click("text=Conosco già il mio schema"); await p.click("[data-preset-ob='0']"); await p.click("[data-pos='0']"); await p.click("#qhConfermaOrari"); await p.waitForTimeout(500);
await p.click("#doChiudiPrimoPiano").catch(()=>{});
// costo di un render()
const r=await p.evaluate(()=>{ const T=[]; for(let i=0;i<5;i++){ const t=performance.now(); render(); T.push(performance.now()-t); } return T.map(x=>Math.round(x)); });
// Mediana, non massimo: la prima misura include il riscaldamento del motore
// JavaScript e oscillava fra 45 e 110 ms sulla stessa versione del codice.
// Il limite resta 60 ms; il massimo deve comunque restare sotto i 150.
const med=[...r].sort((a,b)=>a-b)[2];
console.log((med<60 && Math.max(...r)<150?"✔ ":"✘ ")+"render() con CPU 4×: "+r.join(", ")+" ms (mediana "+med+", limite 60)");
t0=Date.now(); await p.reload({waitUntil:"load"}); await p.waitForSelector("#doOpzioni"); await p.waitForFunction(()=>document.querySelector("#dateLabel")&&document.querySelector("#dateLabel").innerText.length>3);
console.log("avvio con turni impostati (CPU 4x): pronta in", Date.now()-t0, "ms");
await cdp.send("Emulation.setCPUThrottlingRate",{rate:1});
// accessibilità su ogni schermata
const schermate=[["Oggi",async()=>{}],["Turni",async()=>{ await p.click('[data-tab="turni"]'); }],["Quando ho tempo libero",async()=>{ await p.evaluate(()=>document.querySelector("#doPartner").click()); }],["Come sto dormendo",async()=>{ await p.evaluate(()=>{ document.querySelector("#chiudiVederci").click(); document.querySelector("#doAndamenti").click(); }); }],["Quando prendere le ferie",async()=>{ await p.evaluate(()=>{ document.querySelector("#chiudiAndamenti").click(); document.querySelector("#doFerie").click(); }); }],["Impostazioni",async()=>{ await p.evaluate(()=>{ document.querySelector("#chiudiFerie").click(); document.querySelector("#doOpzioni").click(); }); }]];
for (const scheme of ["light","dark"]) {
  await p.emulateMedia({colorScheme:scheme});
  await p.evaluate(()=>{ localStorage.removeItem("nt:theme"); delete document.documentElement.dataset.theme; });
  await p.click('[data-tab="oggi"]').catch(()=>{});
  for (const [nome,vai] of schermate) {
    await vai(); await p.waitForTimeout(300);
    await p.evaluate(AXE);
    const v=await p.evaluate(async()=>{ const r=await axe.run(document,{runOnly:["wcag2a","wcag2aa","wcag21aa"],resultTypes:["violations"]}); return r.violations.map(x=>({id:x.id,impact:x.impact,n:x.nodes.length,es:x.nodes.slice(0,3).map(n=>n.target.join(" ")+" :: "+(n.failureSummary||"").split("\n")[1])})); });
    console.log((v.length?"✘ ":"✔ ")+"accessibilità ["+scheme+"] "+nome+": "+(v.length?v.map(x=>x.id+"("+x.impact+")×"+x.n).join(", "):"nessuna violazione WCAG 2.1 AA"));
    v.forEach(x=>x.es.forEach(e=>console.log("   - "+e.slice(0,200))));
  }
}
console.log("\nerrori:", errs);
await b.close();
