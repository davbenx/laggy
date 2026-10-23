// Telefono nuovo: i dati ritrovati dal backup di Android arrivano con il calendario «acceso» e
// il numero di widget del telefono vecchio. L'app se ne accorge dall'impronta del telefono,
// azzera quelle impostazioni, rimostra la lista di attivazione e lo dice. Sullo stesso telefono, nulla.
import pw from "./_pw.mjs";
import { nativo } from "./_nativo.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const ST={turniConfigurati:true,pattern:"MPNSR",anchor:iso(new Date()),repeat:true,firstSeenAt:"2026-01-01",
  shifts:{M:{n:"Mattino",s:420,e:840},P:{n:"Pomeriggio",s:840,e:1260},N:{n:"Notte",s:1260,e:1860}}};
async function apri(idTelefono, salvato, plugin=true){
  const ctx=await b.newContext({locale:"it-IT",viewport:{width:360,height:740}});
  await ctx.addInitScript(nativo);
  if(plugin) await ctx.addInitScript(id=>{ window.Capacitor.Plugins.NTDispositivo={id:async()=>({id})}; }, idTelefono);
  await ctx.addInitScript(([st,salvato])=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
    localStorage.setItem("nt:state",JSON.stringify(st)); localStorage.setItem("nt:turniConfigurati","true");
    localStorage.setItem("nt:firstPlanBannerChiuso","true"); localStorage.setItem("nt:attivazioneNascosta","true");
    localStorage.setItem("nt:calNativo",JSON.stringify({on:true,id:"7",ids:["1","2"]})); localStorage.setItem("nt:widgetN","2");
    if(salvato) localStorage.setItem("nt:dispositivo",JSON.stringify(salvato)); }, [ST,salvato]);
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.goto("http://localhost:8766/index.html"); await p.waitForTimeout(1500);
  return p;
}
const leggi=p=>p.evaluate(()=>({cal:JSON.parse(localStorage.getItem("nt:calNativo")||"{}"), widget:localStorage.getItem("nt:widgetN"), nascosta:localStorage.getItem("nt:attivazioneNascosta"),
  id:JSON.parse(localStorage.getItem("nt:dispositivo")||'""'), toast:[...document.querySelectorAll(".toast,#toast")].map(t=>t.textContent).join("|"), lista:!!document.querySelector("#attivazione:not([hidden]) .attiva-voce, .attiva-voce")}));

{ const p=await apri("bbbb2222","aaaa1111"), s=await leggi(p);
  ok(!s.cal.on && s.id==="bbbb2222" && s.nascosta==="false", "dati di un altro telefono: calendario azzerato, impronta aggiornata, lista di attivazione di nuovo visibile → "+JSON.stringify({cal:s.cal,id:s.id,nascosta:s.nascosta}));
  ok(/ritrovato i tuoi turni da un altro telefono/.test(s.toast), "lo dice → "+s.toast);
  await p.context().close(); }
{ const p=await apri("aaaa1111","aaaa1111"), s=await leggi(p);
  ok(s.cal.on===true && s.nascosta==="true" && !/altro telefono/.test(s.toast), "stesso telefono: non cambia nulla");
  await p.context().close(); }
{ const p=await apri("aaaa1111",null), s=await leggi(p);
  ok(s.cal.on===true && s.id==="aaaa1111" && s.nascosta==="true", "primo avvio con la nuova versione (dati già presenti, nessuna impronta): la salva e non azzera niente");
  await p.context().close(); }
{ const p=await apri("x","aaaa1111",false), s=await leggi(p);
  ok(s.cal.on===true && s.id==="aaaa1111", "senza il plugin (sito o app vecchia): nessun effetto");
  await p.context().close(); }
console.log("errori", errs); await b.close();
