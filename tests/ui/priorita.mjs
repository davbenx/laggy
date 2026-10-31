// Disposizione per priorità: sopra il piano al massimo un invito, «Adesso»
// nella prima schermata, la lista di attivazione intera solo il primo giorno,
// e in Turni prima ciò che si usa di più.
import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
// Data locale, come la conta l'app (toISOString è UTC: a cavallo della mezzanotte UTC sbagliava giorno).
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const INVITI=["#setupChecklist","#firstPlanBanner","#adattaCard","#medicoCard","#setupNudge"];
const apri=async(giorniFa)=>{
  const ctx=await b.newContext({locale:"it-IT",viewport:{width:360,height:740}});
  await ctx.addInitScript(([f,oggi])=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
    localStorage.setItem("nt:state",JSON.stringify({turniConfigurati:true,pattern:"MPNSR",anchor:oggi,shifts:{M:{n:"Mattino",s:420,e:840},P:{n:"Pomeriggio",s:840,e:1260},N:{n:"Notte",s:1260,e:1860}},repeat:true,firstSeenAt:f,freeBed:"23:00",freeWake:"07:00"}));
    localStorage.setItem("nt:attivazioneDal", JSON.stringify(f));
    localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:firstPlanBannerChiuso","true"); },
    [iso(new Date(Date.now()-giorniFa*864e5)), iso(new Date())]);
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(1000);
  return p;
};
const sopra=p=>p.evaluate(sel=>sel.filter(s=>{ const e=document.querySelector(s); return e && !e.hidden && getComputedStyle(e).display!=="none" && e.getBoundingClientRect().height>2; }), INVITI);
for(const g of [0,1,3,8,20]){
  const p=await apri(g);
  const v=await sopra(p), y=await p.evaluate(()=>document.querySelector("#ora").getBoundingClientRect().top);
  ok(v.length<=1 && y<740-120, "giorno "+g+": "+(v.join(",")||"nessun invito")+" sopra il piano, «Adesso» a "+Math.round(y)+" px (prima schermata)");
  const modello=await p.evaluate(sel=>sel.map(s=>document.querySelector(s)).filter(e=>e && !e.hidden && e.getBoundingClientRect().height>2 && !e.querySelector("#apriAttivazione")).map(e=>{
    const x=e.querySelector(":scope > .x"), r=x && x.getBoundingClientRect(), c=e.getBoundingClientRect();
    return {id:e.id, x:!!x && r.width>=44 && Math.abs(r.right-c.right)<8, freccia:/→/.test([...e.querySelectorAll(".btn")].map(b=>b.textContent).join(""))}; }), INVITI);
  ok(modello.every(m=>m.x && !m.freccia), "giorno "+g+": stesso modello (× in alto a destra, azione senza freccia) → "+JSON.stringify(modello));
  if(g===0) ok(await p.evaluate(()=>document.querySelectorAll("#setupChecklist [data-attiva]").length>0), "primo giorno: la lista intera, con le voci da attivare");
  if(g===1 && v.includes("#setupChecklist")){
    const h=await p.evaluate(()=>document.querySelector("#setupChecklist").getBoundingClientRect().height);
    await p.click("#apriAttivazione"); await p.waitForTimeout(200);
    ok(h<120 && await p.evaluate(()=>document.querySelectorAll("#setupChecklist [data-attiva]").length>0), "dal secondo giorno una riga ("+Math.round(h)+" px) che si apre con un tocco");
  }
  if(g===20){
    await p.click('[data-tab="turni"]'); await p.waitForTimeout(300);
    const ord=await p.evaluate(()=>["#doAndamenti","#doPartner","#doFerie","#doScambioTurno","#doCondividi"].map(s=>document.querySelector(s).getBoundingClientRect().top));
    ok(ord.every((y,i)=>!i || y>=ord[i-1]) && ord[1]>ord[0] && ord[2]>ord[1] && ord[4]>ord[3], "Turni: sonno e carico e tempo libero in alto, poi ferie e scambio, poi condividi");
  }
  await p.context().close();
}
console.log("errori", errs); await b.close();
