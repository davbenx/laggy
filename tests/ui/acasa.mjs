// «Manda a casa i tuoi orari»: un messaggio con i fatti del piano per il
// giorno guardato (turno, rientro, sonno, quando ci sei, a letto), in ordine
// di orario; nascosto senza turni, solo in Oggi.
import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const ctx=await b.newContext({locale:"it-IT",viewport:{width:360,height:740}});
await ctx.addInitScript(a=>{ window.__msg=[]; navigator.share=async o=>{ window.__msg.push(o.text); }; navigator.canShare=()=>true;
  if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
  localStorage.setItem("nt:state",JSON.stringify({turniConfigurati:true,pattern:"MPNSR",anchor:a,shifts:{M:{n:"Mattino",s:420,e:840},P:{n:"Pomeriggio",s:840,e:1260},N:{n:"Notte",s:1260,e:1860}},repeat:true,firstSeenAt:"2026-01-01"}));
  localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:firstPlanBannerChiuso","true"); }, iso(new Date()));
const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(900);
ok(/di oggi$/.test(await p.evaluate(()=>document.querySelector("#aCasaTit").textContent)), "su Oggi: «Manda a casa i tuoi orari di oggi»");
for(let i=0;i<5;i++){ await p.click("#aCasa"); await p.waitForTimeout(200); await p.click("#next"); await p.waitForTimeout(250); }
const m=await p.evaluate(()=>window.__msg);
const ore=t=>t.split("\n").filter(r=>r.startsWith("• ")).map(r=>(r.match(/\d\d:\d\d/)||[""])[0]);
ok(m.length===5 && m.every(t=>!/NaN|undefined/.test(t) && /app\.notturnisti\.club/.test(t)), "5 giorni, 5 messaggi senza testo rotto");
ok(/^Oggi: Mattino 07:00–14:00/.test(m[0]) && /^Domani: Pomeriggio/.test(m[1]), "intestazione: giorno e turno con orario");
ok(/smonto dalla notte/.test(m[3]) && /torno a casa verso le 07:25/.test(m[3]) && /• dormo \d\d:\d\d–\d\d:\d\d/.test(m[3]), "smonto: rientro e sonno di giorno → "+m[3].split("\n").slice(0,3).join(" / "));
ok(/pisolino/.test(m[2]) && /di nuovo/.test(m[2]) && m[2].indexOf("ci sono")<m[2].indexOf("pisolino") && m[2].indexOf("pisolino")<m[2].indexOf("di nuovo"), "notte: tempo libero, pisolino e di nuovo libero, in ordine");
ok(/domani attacco alle 07:00/.test(m[4]), "riposo prima di un mattino: «a letto alle… (domani attacco alle 07:00)»");
ok(!/(libero|libera|stanco|stanca)\b/.test(m.join(" ")), "nessuna parola al maschile o al femminile");
await p.click('[data-tab="turni"]'); await p.waitForTimeout(200);
ok(await p.evaluate(()=>getComputedStyle(document.querySelector("#aCasa")).display==="none"), "non compare in Turni");
await ctx.close();
const c2=await b.newContext({locale:"it-IT"}); const q=await c2.newPage(); q.on("pageerror",e=>errs.push(e.message));
await q.goto("http://localhost:8765/index.html"); await q.waitForTimeout(800);
ok(await q.evaluate(()=>document.querySelector("#aCasa").hidden), "senza turni impostati il bottone non c'è");
console.log("errori", errs); await b.close();
