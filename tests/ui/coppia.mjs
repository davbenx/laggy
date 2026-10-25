// Persona nella striscia del ciclo (sigle accanto alle tue, nascondibili dalla legenda) e
// proposta del calendario di coppia: sotto la lista delle persone e come «Lo sapevi?», solo nell'app.
import pw from "./_pw.mjs";
import { nativo } from "./_nativo.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const fa=n=>{ const d=new Date(); d.setDate(d.getDate()-n); return iso(d); };
const SH={M:{n:"Mattino",s:420,e:840},P:{n:"Pomeriggio",s:840,e:1260},N:{n:"Notte",s:1260,e:1860}};
const ST=(extra={})=>({turniConfigurati:true,pattern:"MPNSR",anchor:fa(3),shifts:SH,repeat:true,firstSeenAt:fa(40),freeBed:"01:00",freeWake:"09:30",
  people:[{name:"Anna",pattern:"MMRR",anchor:fa(2)},{name:"Bruno",pattern:"NNRRR",anchor:fa(1)}],...extra});
async function apri(st, app, tab="turni"){
  const ctx=await b.newContext({locale:"it-IT",viewport:{width:360,height:740}});
  if(app) await ctx.addInitScript(nativo);
  await ctx.addInitScript(st=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
    localStorage.setItem("nt:state",JSON.stringify(st)); localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:firstPlanBannerChiuso","true");
    localStorage.setItem("nt:attivazioneNascosta","true"); localStorage.setItem("nt:backupDone","true"); localStorage.setItem("nt:loSapevi", JSON.stringify({visti:["installa","tester","statistiche","colleghi","copia","orologio","mese","festivi","calendario","ferie","scambio","sonno","grazie","medico","dormi","acasa","sveglia","votowidget","widgetmese","momenti","riepilogo"], migrato:1})); }, st);
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.goto("http://localhost:"+(app?8766:8765)+"/index.html"); await p.waitForTimeout(900);
  if(tab==="turni"){ await p.evaluate(()=>document.querySelector('[data-tab="turni"]')?.click()); await p.waitForTimeout(500); }
  return p;
}

// sito: la persona con la stellina (la prima) compare nella striscia; la legenda la nasconde e la riporta
{ const p=await apri(ST(), false);
  const n=await p.evaluate(()=>({righe:document.querySelectorAll("#cyc .crow").length, cp:document.querySelectorAll("#cyc .crow .cp").length, key:document.querySelector("#cyc .key-pers")?.textContent}));
  ok(n.righe>0 && n.cp===n.righe, "striscia: una sigla della persona per ogni giorno ("+n.cp+"/"+n.righe+")");
  ok(/^Anna in verde/.test(n.key||""), "legenda con il nome della persona → "+n.key);
  const allinea=()=>p.evaluate(()=>{ const r=document.querySelector("#cyc .crow .crail").getBoundingClientRect(), g=document.querySelector("#cyc .cgrid").getBoundingClientRect(); return Math.abs(r.left-g.left); });
  { const d=await allinea(); ok(d<1.5, "la griglia delle ore parte dove parte la rotaia, con la colonna della persona (scarto "+d.toFixed(1)+"px)"); }
  const sig=await p.evaluate(()=>[...document.querySelectorAll("#cyc .crow .cp")].map(x=>x.textContent).join(""));
  ok(/^[MPNSR·]+$/.test(sig) && /[MR]/.test(sig), "le sigle sono quelle del suo ciclo → "+sig);
  ok(await p.evaluate(()=>{ const f=document.querySelectorAll("#cyc .crow .cbar.pers").length, l=[...document.querySelectorAll("#cyc .crow .cp")].filter(x=>!x.classList.contains("r")).length; return f>0 && f===l; }), "ogni giorno di lavoro della persona ha il suo filo verde sotto la barra");
  const allineata=await p.evaluate(()=>{ const r=document.querySelector("#cyc .crow .crail").getBoundingClientRect(), a=document.querySelector("#cyc .caxis .crail").getBoundingClientRect(); return Math.abs(r.left-a.left)<1 && Math.abs(r.width-a.width)<1; });
  ok(allineata, "l'asse delle ore resta allineato alle barre");
  await p.click("[data-cp-toggle]"); await p.waitForTimeout(300);
  ok(await p.evaluate(()=>!document.querySelector("#cyc .cp") && document.querySelector("#cyc .key-pers")?.getAttribute("aria-pressed")==="false"), "legenda: nascondi → via le sigle, resta il tasto per riportarle");
  await p.click("[data-cp-toggle]"); await p.waitForTimeout(300);
  ok(await p.evaluate(()=>!!document.querySelector("#cyc .cp")), "legenda: mostra → tornano");
  await p.context().close(); }
// la stellina sceglie chi si vede
{ const p=await apri(ST({personaGlance:1}), false);
  ok(await p.evaluate(()=>document.querySelector("#cyc .key-pers")?.textContent.startsWith("Bruno in verde")), "con la stellina su Bruno si vede Bruno");
  await p.context().close(); }
// senza persone nessun cambiamento
{ const p=await apri(ST({people:[]}), false);
  ok(await p.evaluate(()=>!document.querySelector("#cyc .cp") && !document.querySelector("#cyc .key-pers")), "senza persone la striscia resta com'era");
  { const r=await p.evaluate(()=>{ const a=document.querySelector("#cyc .crow .crail").getBoundingClientRect(), g=document.querySelector("#cyc .cgrid").getBoundingClientRect(); return Math.abs(a.left-g.left); }); ok(r<1.5, "senza persone la griglia resta allineata (scarto "+r.toFixed(1)+"px)"); }
  await p.context().close(); }

// app: un solo controllo, la scheda «Calendario di coppia» subito sotto la lista delle persone
{ const p=await apri(ST(), true);
  await p.click("#doPartner"); await p.waitForTimeout(400); await p.click("[data-partner-edit]");
  await p.waitForTimeout(400);
  ok(await p.evaluate(()=>!document.querySelector("#doCoppiaQui") && document.querySelectorAll("#coupleCalToggle").length===1), "app: niente proposta doppia, un solo interruttore");
  ok(await p.evaluate(()=>document.querySelector("#wizPeopleList").nextElementSibling.id==="piuCal" && !document.querySelector("#piuCal").hidden), "app: la scheda sta subito sotto «Le tue persone»");
  await p.evaluate(()=>document.querySelector("#coupleCalToggle").click()); await p.waitForTimeout(800);
  ok(await p.evaluate(()=>JSON.parse(localStorage.getItem("nt:calNativo")||"{}").coppia===true && document.querySelector("#coupleCalToggle").checked && /nel calendario «Notturnisti · insieme»/.test(document.querySelector("#coupleCalSub").textContent)), "app: l'interruttore accende il calendario di coppia e lo dice");
  await p.context().close(); }
// app, permesso al calendario negato: la scheda lo dice e porta alle impostazioni; al ritorno col permesso torna normale
{ const ctx=await b.newContext({locale:"it-IT",viewport:{width:360,height:740}});
  await ctx.addInitScript(nativo);
  await ctx.addInitScript(()=>{ const C=window.Capacitor.Plugins.CapacitorCalendar; window.__ok=false; window.__imp=0;
    C.checkAllPermissions=async()=>({result:{readCalendar:window.__ok?"granted":"prompt",writeCalendar:window.__ok?"granted":"prompt"}});
    C.requestAllPermissions=async()=>({result:{readCalendar:"denied",writeCalendar:"denied"}});
    C.createCalendar=async()=>({id:"1"}); C.createEvent=async()=>({id:"e"}); C.deleteEventsById=async()=>({result:{}}); C.deleteCalendar=async()=>({}); C.listCalendars=async()=>({result:[{id:"1"}]});
    window.Capacitor.Plugins.NTDispositivo={id:async()=>({id:"prova"}),apriImpostazioni:async()=>{ window.__imp++; return {}; }};
    window.__rs=[]; window.Capacitor.Plugins.App.addListener=(ev,cb)=>{ window.__rs.push([ev,cb]); return Promise.resolve({remove(){}}); }; });
  await ctx.addInitScript(st=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1"); localStorage.setItem("nt:state",JSON.stringify(st)); localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:backupDone","true"); localStorage.setItem("nt:attivazioneNascosta","true"); localStorage.setItem("nt:firstPlanBannerChiuso","true"); },ST());
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.goto("http://localhost:8766/index.html"); await p.waitForTimeout(1000);
  await p.evaluate(()=>document.querySelector('[data-tab="turni"]')?.click()); await p.waitForTimeout(400);
  await p.click("#doPartner"); await p.waitForTimeout(400); await p.click("[data-partner-edit]"); await p.waitForTimeout(400);
  await p.evaluate(()=>document.querySelector("#coupleCalToggle").click()); await p.waitForTimeout(600);
  ok(await p.evaluate(()=>!document.querySelector("#coupleCalToggle").checked && !!document.querySelector("#coupleCalImpostazioni") && /permesso/.test(document.querySelector("#coupleCalSub").textContent)), "permesso negato: l'interruttore resta spento e la scheda spiega con «Apri le impostazioni»");
  await p.evaluate(()=>document.querySelector("#coupleCalImpostazioni").click()); await p.waitForTimeout(300);
  ok(await p.evaluate(()=>window.__imp===1), "«Apri le impostazioni» apre le impostazioni dell'app");
  await p.evaluate(()=>{ window.__ok=true; window.__rs.filter(x=>x[0]==="resume").forEach(x=>x[1]()); }); await p.waitForTimeout(800);
  ok(await p.evaluate(()=>!document.querySelector("#coupleCalImpostazioni") || !/permesso/.test(document.querySelector("#coupleCalSub").textContent)), "col permesso concesso al ritorno nell'app lo stato «negato» sparisce");
  await ctx.close(); }
// sito: nessuna proposta
{ const p=await apri(ST(), false);
  ok(await p.evaluate(()=>!document.querySelector("#doCoppiaQui")), "sito: nessuna proposta del calendario del telefono");
  await p.context().close(); }

console.log("errori", errs); ok(errs.length===0, "nessun errore di pagina"); await b.close();
