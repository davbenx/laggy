// Il mese in numeri (Turni) e il segnale per il medico competente (Oggi).
import pw from "./_pw.mjs";
const ok=(c,m)=>{ console.log((c?"✔ ":"✘ ")+m); };
const b=await pw.chromium.launch(); const errs=[];
const ds=n=>{ const d=new Date(); d.setDate(d.getDate()-n); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
async function apri(diario){
  const ctx=await b.newContext({locale:"it-IT",timezoneId:"Europe/Rome",viewport:{width:360,height:800}});
  await ctx.addInitScript(([d,f])=>{ localStorage.setItem("nt:state", JSON.stringify({turniConfigurati:true,pattern:"MPNSR",anchor:"2026-01-05",
      shifts:{M:{n:"Mattino",s:420,e:840},P:{n:"Pomeriggio",s:840,e:1260},N:{n:"Notte",s:1260,e:1860}},repeat:true,firstSeenAt:f}));
    localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:firstPlanBannerChiuso","true"); localStorage.setItem("nt:attivazioneNascosta","true");
    if(d) localStorage.setItem("nt:diary", JSON.stringify(d)); }, [diario, ds(40)]);
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(1500); return {p,ctx};
}
// 1. il mese: i numeri tornano con il ciclo (M 7h, P 7h, N 10h, S e R senza turno)
{ const {p,ctx}=await apri(null);
  await p.click('[data-tab="turni"]'); await p.waitForTimeout(400);
  const r=await p.evaluate(()=>{ const n=[...document.querySelectorAll("#meseBox .mese-num b")].map(x=>+x.textContent.replace(",",".")); return {n, vis:getComputedStyle(document.querySelector("#meseBox")).display!=="none", t:document.querySelector("#meseBox").innerText}; });
  const [ore,turni,notti,festivi,liberi]=r.n;
  const giorni=new Date(new Date().getFullYear(), new Date().getMonth()+1, 0).getDate();
  ok(r.vis && turni+liberi===giorni && Math.abs(ore-(turni-notti)*7-notti*10)<0.01 && notti<=turni && festivi<=turni, "mese: ore, turni, notti e giorni senza turno coerenti con il ciclo → "+JSON.stringify(r.n));
  await p.click('[data-mese="1"]'); await p.waitForTimeout(200);
  ok(/›/.test(r.t) && await p.evaluate(()=>!/NaN|undefined/.test(document.querySelector("#meseBox").innerText)), "mese dopo: si sfoglia senza testi rotti");
  await p.click('[data-tab="oggi"]'); await p.waitForTimeout(200);
  ok(await p.evaluate(()=>getComputedStyle(document.querySelector("#meseBox")).display==="none"), "in Oggi il riepilogo del mese non compare");
  ok(await p.evaluate(()=>document.querySelector("#medicoCard").hidden), "senza diario nessun segnale per il medico");
  await ctx.close(); }
// 2. poche note o note buone: niente segnale
{ const d={}; for(let i=1;i<=10;i++) d[ds(i)]= i<=3 ? 2 : 4;
  const {p,ctx}=await apri(d);
  ok(await p.evaluate(()=>document.querySelector("#medicoCard").hidden), "diario per lo più buono: nessun segnale");
  await ctx.close(); }
// 3. tre settimane di poca energia: segnale, una volta sola
{ const d={}; for(let i=1;i<=12;i++) d[ds(i)]= i%4===0 ? 3 : (i%2 ? 1 : 2);
  const {p,ctx}=await apri(d);
  const t=await p.evaluate(()=>{ const e=document.querySelector("#medicoCard"); return e.hidden ? "" : e.innerText; });
  ok(/medico competente/.test(t) && /non è una diagnosi/i.test(t), "molte note di poca energia: il segnale suggerisce il medico competente, senza diagnosi");
  await p.click("#doMedicoOk"); await p.waitForTimeout(200); await p.reload(); await p.waitForTimeout(1200);
  ok(await p.evaluate(()=>document.querySelector("#medicoCard").hidden), "dopo «Ho capito» non torna");
  await ctx.close(); }
console.log("errori", errs); await b.close();
