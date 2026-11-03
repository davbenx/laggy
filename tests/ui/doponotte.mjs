// La scelta «dopo la notte» su Oggi: solo nei giorni in cui il sonno
// principale cade di giorno dopo un turno, con gli orari veri delle due
// strade; cambia la stessa preferenza di Impostazioni; la spiegazione
// sta in una riga chiusa con la scelta in vigore e l'ora: le due strade si aprono al tocco.
import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const ctx=await b.newContext({locale:"it-IT",viewport:{width:360,height:740}});
await ctx.addInitScript(a=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
  localStorage.setItem("nt:state",JSON.stringify({turniConfigurati:true,pattern:"NNSRR",anchor:a,shifts:{N:{n:"Notte",s:1260,e:1860}},repeat:true,firstSeenAt:"2026-01-01"}));
  localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:firstPlanBannerChiuso","true"); }, iso(new Date()));
const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(900);
const leggi=()=>p.evaluate(()=>{ const e=document.querySelector(".dopo-notte"); if(!e) return null;
  return {opz:[...e.querySelectorAll("[data-sonnod]")].map(x=>({t:x.querySelector("b").textContent, fine:x.querySelector("span").textContent, on:x.getAttribute("aria-pressed")})), hint:!!e.querySelector(".dn-hint"), sum:e.querySelector("summary").innerText.replace(/\s+/g," "), aperta:e.open,
    dormi:document.querySelector('[data-row="sonno"] .essrow').innerText.replace(/\s+/g," ")}; });
let r=await leggi();
ok(r && r.opz.map(o=>o.t).join("/")==="In due tempi/Tutto di fila" && r.opz[0].on==="true" && r.hint && !r.aperta && /In due tempi · dormi fino alle \d\d:\d\d/.test(r.sum), "notte con un'altra notte dopo: una riga chiusa («"+(r&&r.sum)+"»), dentro In due tempi / Tutto di fila e la spiegazione");
ok(r && r.dormi.includes(r.opz[0].fine.match(/\d\d:\d\d$/)[0]) && r.opz[0].fine!==r.opz[1].fine, "gli orari mostrati sono quelli del piano ("+r.dormi+" · "+r.opz.map(o=>o.fine).join(" / ")+")");
await p.click('.dopo-notte summary'); await p.click('[data-sonnod]:not(.on)'); await p.waitForTimeout(400);
r=await leggi();
ok(r.opz[1].on==="true" && r.dormi.includes(r.opz[1].fine.match(/\d\d:\d\d$/)[0]) && r.sum.includes("Tutto di fila") && r.sum.includes(r.opz[1].fine.match(/\d\d:\d\d$/)[0]), "scelto «Tutto di fila»: il piano si aggiorna, e la riga dice la scelta e l'ora");
ok(await p.evaluate(()=>document.querySelector("#sonnoD").value==="unicoPisolino" && JSON.parse(localStorage.getItem("nt:state")).sonnoDiurno==="unicoPisolino"), "è la stessa preferenza di Impostazioni, salvata");
await p.click("#next"); await p.waitForTimeout(300);
r=await leggi();
ok(r && r.opz.map(o=>o.t).join("/")==="Sonno breve/Sonno lungo" && r.opz[1].on==="true", "ultima notte: Sonno breve / Sonno lungo (pomeriggio libero o recupero lungo)");
await p.click("#next"); await p.waitForTimeout(300);
ok(await leggi()===null, "smonto e riposi: niente scelta, non serve");
for(let i=0;i<6;i++){ await p.click("#prev"); await p.waitForTimeout(120); }   // 4 giorni fa: una notte
  await p.waitForTimeout(300);
ok(await leggi()===null && /Notte/.test(await p.evaluate(()=>document.querySelector("#shiftPill").textContent)), "una notte già passata: niente scelta");
console.log("errori", errs); await b.close();
