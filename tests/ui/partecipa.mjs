// Partecipazione senza disturbare: un solo budget di richieste (una ogni 7 giorni, non nei primi 3, non di notte),
// le tre facce di soddisfazione nello slot «Lo sapevi?», la riga «Cosa ha cambiato il piano?» quando lo scarto è grande,
// e l'esito di ogni notte come contatore anonimo (mai gli orari).
import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const apri=async({giorni, ora=10, extra={}})=>{
  const t=new Date(); t.setHours(ora,0,0,0);
  const ctx=await b.newContext({locale:"it-IT",viewport:{width:360,height:740}});
  await ctx.clock.install({time:t});
  const ev=[]; await ctx.route("**/collect", r=>{ try{ const j=JSON.parse(r.request().postData()); ev.push(j.event+(j.props&&Object.keys(j.props).length?":"+Object.values(j.props).join(","):"")); }catch(e){} r.fulfill({status:204}); });
  await ctx.addInitScript(([a,g,extra])=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
    const f=new Date(a+"T12:00:00"); f.setDate(f.getDate()-g);
    const I=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
    localStorage.setItem("nt:state",JSON.stringify({turniConfigurati:true,pattern:"RRRRRRR",anchor:a,shifts:{M:{n:"Mattino",s:420,e:840}},repeat:true,firstSeenAt:I(f),freeBed:"23:30",freeWake:"07:30"}));
    localStorage.setItem("nt:attivazioneNascosta","true"); localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:firstPlanBannerChiuso","true");
    localStorage.setItem("nt:analytics-consent","true"); localStorage.setItem("nt:backupDone","true"); localStorage.setItem("nt:novitaViste",JSON.stringify("2099"));
    for(const k in extra) localStorage.setItem("nt:"+k, JSON.stringify(extra[k])); }, [iso(t), giorni, extra]);
  const p=await ctx.newPage(); p.ev=ev; p.on("pageerror",e=>errs.push(e.message));
  await p.goto("http://localhost:8765/index.html"); await p.clock.runFor(2000);
  return p;
};
const sapevi=p=>p.evaluate(()=>{ const e=document.querySelector("#loSapevi"); return e&&!e.hidden?e.dataset.k:""; });
const coda=async p=>{ await p.clock.runFor(300); return p.ev; };
const TUTTI=["installa","tester","colleghi","copia","orologio","mese","festivi","calendario","ferie","scambio","sonno","grazie","medico","dormi","sveglia","votowidget","widgetmese","coppia","momenti","riepilogo","funzioneUtile"];
const visti={visti:TUTTI,migrato:1};

// le facce: giorno 15, statistiche già risposte, nient'altro da dire
let p=await apri({giorni:15, extra:{loSapevi:visti, "analytics-consent":true}});
ok(await sapevi(p)==="soddisfazione" && await p.evaluate(()=>document.querySelectorAll("#loSapevi [data-sapevi-faccia]").length===3), "giorno 15: tre facce nello slot «Lo sapevi?», in fondo");
ok(await p.evaluate(()=>!!document.querySelector("#loSapevi .x") && !document.querySelector("#loSapevi [data-sapevi-si]")), "si può dire «non ora» con la ×");
await p.click("[data-sapevi-faccia=su]"); await p.clock.runFor(400);
ok(!(await sapevi(p)) && (await coda(p)).includes("soddisfazione:su"), "una faccia: sparisce e conta (solo «su»), senza altro");
ok(await p.evaluate(()=>!!localStorage.getItem("nt:soddisfazioneAl") && !!localStorage.getItem("nt:partecipaAl")), "ricorda quando, e occupa il budget delle richieste");
await p.reload(); await p.clock.runFor(2000);
ok(!(await sapevi(p)), "riaprendo l'app non la richiede");
await p.context().close();

// il budget: dopo una richiesta, per sette giorni non se ne fanno altre
const ieri=iso(new Date(Date.now()-864e5)), treFa=iso(new Date(Date.now()-3*864e5)), ottoFa=iso(new Date(Date.now()-8*864e5));
p=await apri({giorni:15, extra:{loSapevi:visti, partecipaAl:treFa}});
ok(!(await sapevi(p)), "3 giorni dopo l'ultima richiesta: nessuna domanda");
await p.context().close();
p=await apri({giorni:15, extra:{loSapevi:visti, partecipaAl:ottoFa}});
ok(await sapevi(p)==="soddisfazione", "8 giorni dopo: di nuovo possibile");
await p.context().close();
p=await apri({giorni:2, extra:{loSapevi:visti}});
ok(!(await sapevi(p)), "nei primi giorni niente");
await p.context().close();
p=await apri({giorni:15, ora:23, extra:{loSapevi:visti}});
ok(!(await sapevi(p)), "di notte niente");
await p.context().close();
p=await apri({giorni:15, extra:{loSapevi:visti, soddisfazioneAl:iso(new Date(Date.now()-30*864e5))}});
ok(!(await sapevi(p)), "dopo un mese dalla risposta: ancora no (si riprova a 90 giorni)");
await p.context().close();
p=await apri({giorni:120, extra:{loSapevi:visti, soddisfazioneAl:iso(new Date(Date.now()-100*864e5))}});
ok(await sapevi(p)==="soddisfazione", "dopo 90 giorni dalla risposta: si può richiedere");
await p.context().close();

// «non ora»: ritenta fra circa un mese
p=await apri({giorni:15, extra:{loSapevi:visti}});
await p.click("#loSapevi .x"); await p.clock.runFor(300);
ok(!(await sapevi(p)) && await p.evaluate(()=>{ const d=localStorage.getItem("nt:soddisfazioneAl"); return d && (Date.now()-new Date(JSON.parse(d)+"T12:00:00"))/864e5>=55; }), "«non ora»: sparisce e ritenta fra circa un mese");
await p.context().close();

// l'esito della notte e la riga «perché»
const apriDiario=async(extra={})=>{ const p=await apri({giorni:20, extra:Object.assign({loSapevi:visti, "analytics-consent":true, soddisfazioneAl:iso(new Date())}, extra)}); return p; };
p=await apriDiario();
await p.click("#essenziale .drem [data-confirm-sleep]"); await p.clock.runFor(500);
ok((await coda(p)).includes("piano_esito:in_linea"), "«Sì, così»: la notte conta come in linea col piano");
ok(await p.evaluate(()=>!document.querySelector(".perche")), "e non si chiede niente");
await p.context().close();
p=await apriDiario();
await p.click("#essenziale .drem [data-open]"); await p.clock.runFor(300);
await p.evaluate(()=>{ const [a,w]=document.querySelectorAll("#essenziale .drem input[type=time]"); a.value="03:00"; a.dispatchEvent(new Event("input",{bubbles:true})); w.value="10:30"; w.dispatchEvent(new Event("input",{bubbles:true})); });
await p.click("#essenziale .drem [data-confirm-sleep]"); await p.clock.runFor(500);
ok((await coda(p)).includes("piano_esito:oltre_30"), "orari molto diversi: oltre 30 minuti, senza gli orari");
ok(await p.evaluate(()=>document.querySelectorAll(".perche [data-perche]").length===4 && !document.querySelector(".perche").closest("#loSapevi")), "sotto la scheda compare «Cosa ha cambiato il piano?» con tre scelte e «No, grazie»");
await p.click("[data-perche=abitudine]"); await p.clock.runFor(400);
ok(!(await p.$(".perche")) && (await coda(p)).includes("piano_motivo:abitudine"), "una scelta: la riga sparisce e il motivo conta");
ok(await p.evaluate(()=>!!localStorage.getItem("nt:percheAl") && !!localStorage.getItem("nt:partecipaAl")), "ricorda quando (una volta ogni 14 giorni, dentro il budget)");
await p.context().close();
p=await apriDiario({percheAl:ieri});
await p.click("#essenziale .drem [data-open]"); await p.clock.runFor(300);
await p.evaluate(()=>{ const [a,w]=document.querySelectorAll("#essenziale .drem input[type=time]"); a.value="03:00"; a.dispatchEvent(new Event("input",{bubbles:true})); w.value="10:30"; w.dispatchEvent(new Event("input",{bubbles:true})); });
await p.click("#essenziale .drem [data-confirm-sleep]"); await p.clock.runFor(500);
ok(!(await p.$(".perche")), "se l'ho chiesto da meno di 14 giorni, non lo richiedo");
await p.context().close();

// il «No, grazie» non conta niente
p=await apriDiario();
await p.click("#essenziale .drem [data-open]"); await p.clock.runFor(300);
await p.evaluate(()=>{ const [a,w]=document.querySelectorAll("#essenziale .drem input[type=time]"); a.value="03:00"; a.dispatchEvent(new Event("input",{bubbles:true})); w.value="10:30"; w.dispatchEvent(new Event("input",{bubbles:true})); });
await p.click("#essenziale .drem [data-confirm-sleep]"); await p.clock.runFor(500);
await p.click("[data-perche=no]"); await p.clock.runFor(300);
ok(!(await p.$(".perche")) && !(await coda(p)).some(x=>x.startsWith("piano_motivo")), "«No, grazie»: sparisce e non conta niente");
await p.context().close();

console.log("errori", errs); ok(errs.length===0, "nessun errore di pagina"); await b.close();
