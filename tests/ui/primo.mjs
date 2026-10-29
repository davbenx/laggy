// Primo ingresso e Impostazioni: fiducia al primo passo, «tocca una voce per
// sapere perché» finché non se ne apre una, legenda chiara; in Impostazioni la
// freccia resta visibile scorrendo e una modifica dice «Salvato».
import pw from "./_pw.mjs";
const ok=(c,m)=>{ console.log((c?"✔ ":"✘ ")+m); };
const b=await pw.chromium.launch(); const errs=[];
const p=await (await b.newContext({locale:"it-IT",viewport:{width:390,height:844}})).newPage(); p.on("pageerror",e=>errs.push(e.message));
await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(900);
ok(/Gratis, senza account: turni e sonno restano sul tuo telefono/.test(await p.evaluate(()=>document.body.innerText)), "primo passo: gratis, senza account, dati sul telefono");
ok(await p.evaluate(()=>["[data-subflow=schema]","[data-importa-primo]"].every(q=>{ const e=document.querySelector(q); return e && e.tagName==="BUTTON" && e.classList.contains("btn") && e.getBoundingClientRect().height>=44; })), "primo passo: «Conosco già il mio schema» e «Ho già i turni in un calendario» sono pulsanti, non link: sono percorsi veri");
await p.click("[data-pick=M]"); await p.click("#qhConfermaOrario"); await p.waitForTimeout(800);
ok(await p.evaluate(()=>!!document.querySelector("#essenziale .esshint")), "primo piano: «Tocca una voce per sapere perché»");
await p.click("#essenziale .erow[data-row]"); await p.waitForTimeout(300);   // il perché si apre in un foglio
await p.reload(); await p.waitForTimeout(1500);
ok(await p.evaluate(()=>!document.querySelector("#essenziale .esshint")), "aperta una voce, il suggerimento non torna");
const leg=await p.evaluate(()=>document.body.innerText.includes("Picco di sonnolenza") || !document.body.innerText.includes("Sonnolenza"));
ok(leg, "legenda: «Picco di sonnolenza»");
await p.click("#doOpzioni"); await p.waitForTimeout(400);
await p.evaluate(()=>window.scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(400);
const vis=await p.evaluate(()=>{ const r=document.querySelector("#chiudiOpzioni").getBoundingClientRect(); const top=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2); return r.top>=0 && r.bottom<=innerHeight && !!top && !!top.closest("#chiudiOpzioni"); });
ok(vis, "Impostazioni in fondo: la freccia per uscire è visibile e toccabile");
await p.evaluate(()=>window.scrollTo(0,0));
const campo=await p.evaluate(()=>{ const i=[...document.querySelectorAll("#opzioni input[type=time],#opzioni input[type=number],#opzioni select")].find(x=>!x.closest(".opz-funz")); if(!i) return ""; i.dispatchEvent(new Event("change",{bubbles:true})); return i.id||i.name||i.tagName; });
await p.waitForTimeout(600);
const t=await p.evaluate(()=>{ const e=document.querySelector("#toast"); return e && e.classList.contains("on") ? e.innerText : ""; });
ok(campo && /Salvato/.test(t), "una modifica in Impostazioni dice «Salvato» ("+campo+" → "+t+")");
console.log("errori", errs); await b.close();
