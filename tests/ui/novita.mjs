// Popup «Novità»: una volta sola dopo l'aggiornamento, mai al primo uso, sempre in Impostazioni; modifica persone.
import pw from "./_pw.mjs";
import { nativo } from "./_nativo.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const fa=n=>{ const d=new Date(); d.setDate(d.getDate()-n); return iso(d); };
const SH={M:{n:"Mattino",s:420,e:840},P:{n:"Pomeriggio",s:840,e:1260},N:{n:"Notte",s:1320,e:1800}};
async function apri(st, extra={}, app=false){
  const ctx=await b.newContext({locale:"it-IT",viewport:{width:360,height:740}});
  if(app) await ctx.addInitScript(nativo);
  await ctx.addInitScript(([st,extra])=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
    localStorage.setItem("nt:state",JSON.stringify(st)); localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:firstPlanBannerChiuso","true");
    localStorage.setItem("nt:attivazioneNascosta","true"); localStorage.setItem("nt:backupDone","true"); localStorage.setItem("nt:novitaProva","true");
    for(const k in extra) localStorage.setItem("nt:"+k, JSON.stringify(extra[k])); }, [st,extra]);
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.goto("http://localhost:"+(app?8766:8765)+"/index.html"); await p.waitForTimeout(4600);
  return p;
}
const ST=(extra={})=>({turniConfigurati:true,pattern:"MPNSR",anchor:fa(3),shifts:SH,repeat:true,firstSeenAt:fa(20),freeBed:"01:00",freeWake:"09:30",...extra});
const aperto=p=>p.evaluate(()=>!document.querySelector("#novitaModal").hidden);

{ const p=await apri(ST());
  ok(await aperto(p), "dopo un aggiornamento compare il foglio delle novità");
  ok(await p.evaluate(()=>document.querySelectorAll("#novitaLista b").length>=3 && !/Widget/.test(document.querySelector("#novitaLista").textContent)), "sul sito niente righe «solo app» (widget)");
  await p.click("#novitaOk"); await p.waitForTimeout(300);
  ok(!(await aperto(p)) && await p.evaluate(()=>/"2026/.test(localStorage.getItem("nt:novitaViste")||"")), "«Ok» lo chiude e lo ricorda");
  await p.reload(); await p.waitForTimeout(4600);
  ok(!(await aperto(p)), "alla riapertura non ricompare");
  await p.evaluate(()=>document.querySelector('[data-tab="oggi"]'))
  await p.context().close(); }
{ const p=await apri(ST(), {novitaViste:"2026-10-27"});
  ok(await aperto(p) && await p.evaluate(()=>document.querySelectorAll("#novitaLista b").length===3 && /Impostazioni e persone/.test(document.querySelector("#novitaLista").textContent) && /altro turno/.test(document.querySelector("#novitaLista").textContent) && /voto sull.energia/.test(document.querySelector("#novitaLista").textContent) && !/colore per ogni turno/.test(document.querySelector("#novitaLista").textContent)), "chi ha già letto la versione prima vede solo le righe nuove");
  ok(await p.evaluate(()=>{ const s=document.querySelector("#novitaModal .qs-sheet"); return s.getBoundingClientRect().height<500 && s.scrollTop===0; }), "e il foglio è corto e parte dall'inizio");
  await p.context().close(); }
{ const p=await apri(ST({firstSeenAt:iso(new Date())}));
  ok(!(await aperto(p)), "chi ha installato oggi non lo vede");
  await p.context().close(); }
{ const p=await apri(ST(), {}, true);
  ok(await p.evaluate(()=>document.querySelectorAll("#novitaLista b").length<=4), "dopo molte versioni: al massimo quattro righe, le più recenti");
  await p.click("#novitaOk"); await p.waitForTimeout(200);
  await p.evaluate(()=>document.querySelector("#doNovita").click()); await p.waitForTimeout(300);
  ok(await p.evaluate(()=>/Widget/.test(document.querySelector("#novitaLista").textContent)), "nell'app (da Impostazioni) c'è anche la riga del widget, e tutte le altre");
  await p.context().close(); }
// sempre raggiungibile da Impostazioni
{ const p=await apri(ST(), {novitaViste:"2026-10-30"});
  ok(!(await aperto(p)), "già vista: non compare da sola");
  await p.evaluate(()=>document.querySelector("#doNovita").click()); await p.waitForTimeout(300);
  ok(await aperto(p), "Impostazioni › Novità la riapre");
  await p.keyboard.press("Escape"); await p.waitForTimeout(200);
  ok(!(await aperto(p)), "Esc la chiude");
  await p.context().close(); }

// persone: modifica, orari che restano suoi, sonno visibile
{ const p=await apri(ST({people:[{name:"Anna",pattern:"MPNSR",anchor:fa(1),wake:"07:00",bed:"23:00"}]}), {novitaViste:"2026-10-30"});
  await p.evaluate(()=>document.querySelector('[data-tab="turni"]').click()); await p.waitForTimeout(300);
  await p.evaluate(()=>document.querySelector("#doPartner").click()); await p.waitForTimeout(400);
  await p.evaluate(()=>document.querySelector("[data-partner-edit]").click()); await p.waitForTimeout(400);
  const riga=await p.evaluate(()=>document.querySelector("#wizPeopleList .diary")?.textContent||"");
  ok(/dorme 23:00–07:00/.test(riga) && await p.evaluate(()=>document.querySelectorAll("#wizPeopleList .diary .ptile").length===7), "nella lista si vede il suo sonno e i suoi prossimi sette giorni → "+riga.replace(/\s+/g," ").slice(0,90));
  await p.evaluate(()=>document.querySelector("[data-edit-persona]").click()); await p.waitForTimeout(500);
  const f=await p.evaluate(()=>({nome:document.querySelector("#personaName").value, pat:document.querySelector("#personaPattern").value, bed:document.querySelector("#personaBed").value,
    wake:document.querySelector("#personaWake").value, rows:[...document.querySelectorAll("#personaShiftsList .psh")].map(r=>r.dataset.l+" "+r.querySelector('[data-fld="s"]').value), btn:document.querySelector("#doConfirmPersona").textContent}));
  ok(f.nome==="Anna" && f.pat==="MPNSR" && f.bed==="23:00" && f.wake==="07:00" && /Salva/.test(f.btn), "Modifica precompila il modulo → "+JSON.stringify(f));
  ok(f.rows.some(r=>r==="N 22:00") && f.rows.some(r=>r==="M 07:00"), "gli orari proposti sono i tuoi di adesso (poi restano suoi)");
  await p.evaluate(()=>{ document.querySelector("#personaName").value="Anna R."; const n=document.querySelector('#personaShiftsList .psh[data-l="N"] [data-fld="s"]'); n.value="21:00"; });
  await p.evaluate(()=>document.querySelector("#doConfirmPersona").click()); await p.waitForTimeout(500);
  const st=await p.evaluate(()=>{ const s=JSON.parse(localStorage.getItem("nt:state")); return {n:s.people.length, nome:s.people[0].name, N:s.people[0].shifts&&s.people[0].shifts.N&&s.people[0].shifts.N.s, wake:s.people[0].wake}; });
  ok(st.n===1 && st.nome==="Anna R." && st.N===1260 && st.wake==="07:00", "salvata al suo posto, senza duplicati, con orari suoi → "+JSON.stringify(st));
  // cambiare un mio turno non muove il suo
  await p.evaluate(()=>{ const s=JSON.parse(localStorage.getItem("nt:state")); s.shifts.N.s=1200; localStorage.setItem("nt:state",JSON.stringify(s)); });
  ok(await p.evaluate(()=>JSON.parse(localStorage.getItem("nt:state")).people[0].shifts.N.s===1260), "il suo turno N resta com'è (21:00) se cambi il tuo");
  await p.context().close(); }
// aggiungere «i tuoi stessi turni» copia gli orari
{ const p=await apri(ST(), {novitaViste:"2026-10-30"});
  await p.evaluate(()=>document.querySelector('[data-tab="turni"]').click()); await p.waitForTimeout(300);
  await p.evaluate(()=>document.querySelector("#doPartner").click()); await p.waitForTimeout(400);
  await p.evaluate(()=>document.querySelector("[data-partner-edit]").click()); await p.waitForTimeout(400);
  await p.evaluate(()=>{ document.querySelector('[data-pvia="mine"]').click(); document.querySelector("#personaName").value="Luca"; });
  await p.evaluate(()=>document.querySelector("#doConfirmPersona").click()); await p.waitForTimeout(500);
  ok(await p.evaluate(()=>{ const s=JSON.parse(localStorage.getItem("nt:state")); const per=s.pPattern ? {shifts:s.pShifts} : s.people[0]; return !!(per.shifts && per.shifts.N && per.shifts.N.s===1320); }), "«I tuoi stessi turni» copia i tuoi orari: non li segue");
  await p.context().close(); }
// calendario di coppia sopra «Condividi»
{ const p=await apri(ST({people:[{name:"Anna",pattern:"MPNSR",anchor:fa(1)}]}), {novitaViste:"2026-10-30"});
  ok(await p.evaluate(()=>{ const a=document.querySelector("#piuCal"), b=document.querySelector("#partnerShare"); return !!a && !!b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)!==0; }), "il calendario di coppia sta sopra «Condividi»");
  await p.context().close(); }

console.log("errori", errs); ok(errs.length===0, "nessun errore di pagina"); await b.close();
