// Il riordino: l'avviso di rischio del giorno ora si vede in Oggi (prima
// viveva solo nella vista «giornata», mai visibile); il mese è un riquadro
// solo, anche vuoto, con «Segna o importa»; Impostazioni senza doppioni
// (niente «Un giorno importante», «Consiglia Notturnisti» al posto del
// secondo invito); il file .ics si apre dalla finestra del calendario.
import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const fa=n=>{ const d=new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()-n); return iso(d); };
const SH={M:{n:"Mattino",s:420,e:840},P:{n:"Pomeriggio",s:840,e:1260},N:{n:"Notte",s:1260,e:1860}};
const apri=async st=>{
  const ctx=await b.newContext({locale:"it-IT",viewport:{width:360,height:740}});
  await ctx.addInitScript(st=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
    localStorage.setItem("nt:state",JSON.stringify(st)); localStorage.setItem("nt:turniConfigurati","true");
    localStorage.setItem("nt:firstPlanBannerChiuso","true"); localStorage.setItem("nt:attivazioneNascosta","true"); }, st);
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  // alle 16: finito il sonno dopo lo smonto, «oggi» è il giorno nuovo (a mezzogiorno dopo una notte l'app è ancora sul giorno del turno)
  const sera=new Date(); sera.setHours(16,0,0,0); await p.clock.setFixedTime(sera);
  await p.goto(process.env.URL||"http://localhost:8765/index.html"); await p.waitForTimeout(1000);
  return p;
};
// 1. quarta notte di fila: l'avviso è una riga in Oggi
let p=await apri({turniConfigurati:true,pattern:"NNNNRRR",anchor:fa(3),shifts:SH,repeat:true,firstSeenAt:fa(30)});
const r=await p.evaluate(()=>{ const e=document.querySelector("#essenziale .essrischio"); return e && e.offsetParent!==null ? e.textContent : ""; });
ok(/4ª notte di fila/.test(r), "quarta notte di fila: l'avviso si vede in Oggi → "+r);
ok(await p.evaluate(()=>!document.querySelector("#band") && !document.querySelector("#cards") && !document.querySelector("#vista")), "la vecchia vista nascosta non c'è più");
await p.click('[data-tab="oggi"]');
await p.evaluate(()=>document.querySelector("#next").click()); await p.waitForTimeout(250);   // domani: riposo
ok(await p.evaluate(()=>!document.querySelector("#essenziale .essrischio")), "su un giorno di riposo nessun avviso");
await p.context().close();
// 1b. impegno importante: l'avviso dice il giorno giusto, e solo nei 3 giorni prima
for(const [n, atteso] of [[1,/domani alle 09:00/],[5,null]]){
  p=await apri({turniConfigurati:true,pattern:"MPNSR",anchor:fa(0),shifts:SH,repeat:true,firstSeenAt:fa(30),evento:{d:fa(-n),h:"09:00"}});
  const t=await p.evaluate(()=>{ const e=document.querySelector(".lucidita-banner"); return e ? e.textContent : ""; });
  ok(atteso ? atteso.test(t) : t==="", "impegno fra "+n+" giorni: "+(atteso?"l'avviso dice «domani»":"nessun avviso")+" → «"+t+"»");
  await p.context().close();
}
// 1c. «Adesso» solo su oggi: sfogliando un altro giorno non sta sotto una data che non è la sua
p=await apri({turniConfigurati:true,pattern:"MPNSR",anchor:fa(0),shifts:SH,repeat:true,firstSeenAt:fa(30)});
const vis=()=>p.evaluate(()=>{ const o=document.querySelector("#ora"); return !!o && !o.hidden && o.offsetParent!==null && /Adesso/i.test(o.innerText); });
const suOggi=await vis();
await p.evaluate(()=>document.querySelector("#next").click()); await p.waitForTimeout(250);
const suDomani=await vis();
await p.evaluate(()=>document.querySelector("#goToday").click()); await p.waitForTimeout(250);
ok(suOggi && !suDomani && await vis(), "«Adesso»: c'è su oggi, sparisce su domani, torna con «Oggi»");
await p.context().close();
// 2. turni variabili, mese vuoto: il riquadro resta, con «Segna o importa»
p=await apri({turniConfigurati:true,pattern:"R",anchor:"2000-01-01",shifts:SH,repeat:false,firstSeenAt:fa(30)});
await p.click('[data-tab="turni"]'); await p.waitForTimeout(300);
const m=await p.evaluate(()=>{ const e=document.querySelector("#meseBox"); return {vis:!e.hidden && e.offsetParent!==null, t:e.innerText}; });
ok(m.vis && /Nessun turno segnato/.test(m.t) && /Segna o importa i turni/.test(m.t), "mese vuoto: il riquadro resta, con «Segna o importa i turni»");
ok(await p.evaluate(()=>!document.querySelector("#doSegnaMese")), "niente più una seconda voce per il mese");
await p.click("#meseBox [data-mese-segna]"); await p.waitForTimeout(300);
ok(await p.evaluate(()=>document.body.classList.contains("turni-aperta") && !!document.querySelector("#ttMese #segnaOut")), "turni variabili: il pulsante apre il mese in «I tuoi turni»");
await p.context().close();
// 3. la scheda di un altro giorno parla di QUEL giorno (prima: del giorno in vista)
p=await apri({turniConfigurati:true,pattern:"MPNSR",anchor:fa(0),shifts:SH,repeat:true,firstSeenAt:fa(30)});
await p.click('[data-tab="turni"]'); await p.waitForTimeout(300);
await p.click('#cyc .crow[data-off="2"]'); await p.waitForTimeout(250);   // dopodomani: Notte
const sc=await p.evaluate(()=>({att:(document.querySelector(".qs-btn.active")||{}).textContent||"", s:(document.querySelector('[data-qs-ora="s"]')||{}).value, e:(document.querySelector('[data-qs-ora="e"]')||{}).value}));
ok(/Notte/.test(sc.att) && sc.s==="21:00" && sc.e==="07:00", "scheda di dopodomani: turno attivo Notte e orari 21:00 → 07:00 → "+JSON.stringify(sc));
await p.evaluate(()=>{ const i=document.querySelector('[data-qs-ora="e"]'); i.value="08:00"; i.dispatchEvent(new Event("change",{bubbles:true})); });
await p.waitForTimeout(200);
const g=await p.evaluate(()=>JSON.parse(localStorage.getItem("nt:state")).giorni);
const d2=fa(-2);
ok(g[d2] && g[d2].s===1260 && g[d2].e===1920 && Object.keys(g).length===1, "orari veri salvati su quel giorno: notte fino alle 08:00 → "+JSON.stringify(g));
await p.click("#qsClose");
await p.context().close();
// 4. Impostazioni senza doppioni; il file del calendario dalla finestra del calendario
p=await apri({turniConfigurati:true,pattern:"MPNSR",anchor:fa(2),shifts:SH,repeat:true,firstSeenAt:fa(30)});
await p.evaluate(()=>document.querySelector("#doOpzioni").click()); await p.waitForTimeout(300);
const o=await p.evaluate(()=>({testo:document.querySelector("#opzioni").innerText, lucid:!!document.querySelector("#doOpzLucidita"), file:!!document.querySelector("#doIcs")}));
ok(!o.lucid && !/Un giorno importante/.test(o.testo), "Impostazioni: «Un giorno importante» non c'è più (si segna dalla scheda del giorno)");
ok(!o.file && /Consiglia Notturnisti/.test(o.testo) && !/Invita chi lavora con te/.test(o.testo), "Impostazioni: «Consiglia Notturnisti», niente secondo invito né riga del file");
const vaFile=await p.evaluate(()=>{ if(!window.NTPaid) return "nopaid"; window.NTPaid.open("attiva"); const f=document.querySelector("#pf-file"); if(!f) return "nofile"; f.click(); return ""; });
await p.waitForTimeout(400);
ok(vaFile==="" && await p.evaluate(()=>!document.querySelector("#icsBox").hidden && document.querySelector("#icsBox").offsetParent!==null), "finestra del calendario → «Scarica un file»: si apre il riquadro del file ("+(vaFile||"ok")+")");
await p.context().close();
// 5. «I tuoi turni»: una pagina sola per cambiare la turnazione; ← torna da dove si è partiti
p=await apri({turniConfigurati:true,pattern:"MPNSR",anchor:fa(2),shifts:SH,repeat:true,firstSeenAt:fa(30)});
const cl=s=>p.evaluate(s=>document.querySelector(s).click(), s);
const dove=()=>p.evaluate(()=>({tab:["oggi","turni","opzioni"].find(t=>document.body.classList.contains("tab-"+t)), pagina:document.body.classList.contains("turni-aperta"),
  h:(document.querySelector("#ttFlusso #demoEsempio:not([hidden]) .qh-h")||{}).textContent||"", righe:[...document.querySelectorAll("#ttRighe [data-tt]")].filter(b=>!b.hidden).map(b=>b.dataset.tt).join(",")}));
await cl('[data-tab="turni"]'); await p.waitForTimeout(300); await cl("#tEdit"); await p.waitForTimeout(300);
let d=await dove();
ok(d.pagina && d.tab==="turni" && d.righe==="orari,posizione,schema" && /In quinta/.test(await p.evaluate(()=>document.querySelector("#ttRiepilogo").innerText)), "Turni › Modifica: «I tuoi turni» con riepilogo e tre righe → "+JSON.stringify(d));
await cl('[data-tt="schema"]'); await p.waitForTimeout(200); d=await dove();
const sotto=await p.evaluate(()=>({casa:!!document.querySelector("#aCasa").offsetParent, sap:!!document.querySelector("#loSapevi").offsetParent}));
ok(d.h==="Come sono i tuoi turni?" && !sotto.casa && !sotto.sap, "Cambia schema: il flusso dentro la pagina, niente altro sotto → "+d.h);
await cl('[data-subflow="schema"]'); await p.waitForTimeout(200);
const dodici=await p.evaluate(()=>[...document.querySelectorAll("[data-preset-ob]")].map(b=>b.textContent).filter(t=>/smonto/i.test(t)&&/19–7/.test(t)));
ok(dodici.length===2, "dodici ore: entrambi gli schemi hanno lo smonto → "+dodici.join(" / "));
await cl('[data-subflow="prossimi"]').catch(()=>{}); await p.waitForTimeout(150);
await cl("[data-chiudi-schema]"); await p.waitForTimeout(200); d=await dove();
ok(d.pagina && d.h==="" && d.righe==="orari,posizione,schema", "Annulla: si torna alla pagina, non a Oggi");
await cl('[data-tt="orari"]'); await p.waitForTimeout(200);
await p.evaluate(()=>{ const i=document.querySelector('[data-ora-da="M"]'); i.value="06:30"; }); await cl("#qhConfermaOrari"); await p.waitForTimeout(300); d=await dove();
ok(d.pagina && d.h==="" && await p.evaluate(()=>JSON.parse(localStorage.getItem("nt:state")).shifts.M.s)===390, "Orari dei turni: il mattino alle 6:30, e si torna alla pagina");
await cl('[data-tt="posizione"]'); await p.waitForTimeout(200); await cl('[data-pos="0"]'); await p.waitForTimeout(300); d=await dove();
ok(d.pagina && await p.evaluate(()=>JSON.parse(localStorage.getItem("nt:state")).anchor)===fa(0), "Oggi dove sei: un tocco riallinea il ciclo e torna alla pagina");
await cl("#chiudiTuoiTurni"); await p.waitForTimeout(300); d=await dove();
ok(!d.pagina && d.tab==="turni", "← da Turni torna a Turni");
await cl("#doOpzioni"); await cl('[data-opz="1"]'); await p.waitForTimeout(300); d=await dove();
ok(d.pagina, "Impostazioni › I tuoi turni: la stessa pagina");
await p.evaluate(()=>history.back && 0); await cl("#chiudiTuoiTurni"); await p.waitForTimeout(300); d=await dove();
ok(!d.pagina && d.tab==="opzioni", "← da Impostazioni torna alle Impostazioni");
ok(await p.evaluate(()=>!document.querySelector("#opzBox1") && !document.querySelector("#qhAvanzate")), "niente più pannello nascosto né «Impostazioni avanzate»");
await p.context().close();
// sempre lo stesso turno: «Giorni di riposo» parte da quelli attuali
{ const lun=(()=>{ const x=new Date(); x.setHours(12,0,0,0); x.setDate(x.getDate()-((x.getDay()+6)%7)); return iso(x); })();
  p=await apri({turniConfigurati:true,pattern:"NNNNNRR",anchor:lun,shifts:SH,repeat:true,firstSeenAt:fa(30)});
  await p.evaluate(()=>document.querySelector('[data-tab="turni"]').click()); await p.evaluate(()=>document.querySelector("#tEdit").click()); await p.waitForTimeout(300);
  const f=await p.evaluate(()=>({righe:[...document.querySelectorAll("#ttRighe [data-tt]")].filter(b=>!b.hidden).map(b=>b.dataset.tt).join(","), r:document.querySelector("#ttRiepilogo").innerText}));
  await p.evaluate(()=>document.querySelector('[data-tt="riposi"]').click()); await p.waitForTimeout(200);
  const on=await p.evaluate(()=>[...document.querySelectorAll(".qh-gg.on")].map(b=>b.dataset.gg).join(","));
  ok(f.righe==="orari,riposi,schema" && /Sempre Notte/.test(f.r) && on==="5,6", "turno fisso: «Sempre Notte», Giorni di riposo parte da sab-dom → "+JSON.stringify(f)+" "+on);
  await p.context().close(); }
// turni variabili: la pagina è il mese; dal riquadro del mese si arriva lì
p=await apri({turniConfigurati:true,pattern:"R",anchor:"2000-01-01",shifts:SH,repeat:false,firstSeenAt:fa(30)});
await p.evaluate(()=>document.querySelector('[data-tab="turni"]').click()); await p.waitForTimeout(300);
await p.evaluate(()=>document.querySelector("#meseBox [data-mese-segna]").click()); await p.waitForTimeout(300);
const v=await p.evaluate(()=>({pagina:document.body.classList.contains("turni-aperta"), mese:!!document.querySelector("#ttMese #segnaOut"), imp:!!document.querySelector("#ttMese .sg-importa"), righe:[...document.querySelectorAll("#ttRighe [data-tt]")].filter(b=>!b.hidden).map(b=>b.dataset.tt).join(","), fatto:!document.querySelector("#ttFatto").hidden}));
ok(v.pagina && v.mese && v.imp && v.righe==="orari,schema" && v.fatto, "turni variabili: «I tuoi turni» è il mese (con importazione), più Orari e Cambia schema → "+JSON.stringify(v));
await p.context().close();
p=await apri({turniConfigurati:true,pattern:"MPNSR",anchor:fa(2),shifts:SH,repeat:true,firstSeenAt:fa(30)});
const nudge=await p.evaluate(()=>(document.querySelector("#essenziale .essnudge")||{}).textContent||"");
ok(/Dimmi i tuoi e il piano si adatta a te/.test(nudge) && !/affinalo/.test(nudge), "frase sul sonno tipico, in italiano naturale → "+nudge);
await p.evaluate(()=>{ const d=document.querySelector('#essenziale details[data-row="sonno"]'); d.open=true; d.querySelector("[data-cambia]").click(); }); await p.waitForTimeout(400);
ok(await p.evaluate(()=>{ const b=document.querySelector("#opzBox3"); return !b.hidden && !!b.offsetParent && !!b.querySelector("#oBed"); }), "«Dormi» → «Dimmi come dormi» apre il sonno nei giorni liberi");
await p.evaluate(()=>document.querySelector('[data-tab="turni"]').click()); await p.waitForTimeout(300);
const testi=await p.evaluate(()=>document.body.innerText);
await p.evaluate(()=>document.querySelector('[data-tab="oggi"]').click()); await p.waitForTimeout(300);
const testiOggi=await p.evaluate(()=>document.body.innerText);
ok(/Cambio turno/.test(testi) && /Sonno e riposo, prima di accettare/.test(testi) && !/mi conviene\?/.test(testi) && !/Mi conviene lo scambio/.test(testi) && /Condividi i tuoi orari/.test(testiOggi) && !/Manda a casa/.test(testiOggi), "testi: «Cambio turno» con «Sonno e riposo, prima di accettare», niente «Manda a casa»");
await p.context().close();
ok(!errs.length, "nessun errore di pagina "+JSON.stringify(errs));
await b.close();
