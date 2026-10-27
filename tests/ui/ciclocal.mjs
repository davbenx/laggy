// Il ciclo a calendario (per chi non ha il widget) e il sonno della persona sul filo del suo turno.
import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const SH={M:{n:"Mattino",s:360,e:840},P:{n:"Pomeriggio",s:840,e:1320},N:{n:"Notte",s:1320,e:1800}};
const ST=(extra={})=>({turniConfigurati:true,pattern:"MPNSR",anchor:"2026-10-19",shifts:SH,repeat:true,firstSeenAt:"2026-01-01",freeBed:"23:30",freeWake:"07:30",
  people:[{name:"Anna",pattern:"MMRR",anchor:"2026-10-20"}],...extra});
async function apri(st){
  const ctx=await b.newContext({locale:"it-IT",viewport:{width:390,height:844}});
  await ctx.addInitScript(st=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1"); localStorage.setItem("nt:state",JSON.stringify(st)); localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:firstPlanBannerChiuso","true"); localStorage.setItem("nt:attivazioneNascosta","true"); localStorage.setItem("nt:backupDone","true"); },st);
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.clock.setFixedTime(new Date(2026,9,25,12,0,0));
  await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(1100);
  await p.evaluate(()=>document.querySelector('[data-tab="turni"]').click()); await p.waitForTimeout(500);
  return p;
}
const q=(p,f)=>p.evaluate(f);
const primo=p=>q(p,()=>document.querySelector(".ccell")?.dataset.calGiorno);
// il mese sta nel titolo della pagina: «Turni ottobre»
const titolo=p=>q(p,()=>{ const t=document.querySelector("#cycRange").textContent.replace(/^Turni /,""); return t.charAt(0).toUpperCase()+t.slice(1); });

// vista predefinita: le ore; il selettore c'è e dice dove si è
{ const p=await apri(ST());
  const s=await q(p,()=>({ore:document.querySelector('[data-vista="ore"]')?.getAttribute("aria-pressed"), cal:document.querySelector('[data-vista="calendario"]')?.getAttribute("aria-pressed"), righe:document.querySelectorAll("#cyc .crow").length, celle:document.querySelectorAll(".ccell").length}));
  ok(s.ore==="true" && s.cal==="false" && s.righe>0 && s.celle===0, "predefinito: «Ore» (la striscia), il selettore dice dove si è → "+JSON.stringify(s));
  await p.click('[data-vista="calendario"]'); await p.waitForTimeout(400);
  const c=await q(p,()=>({celle:document.querySelectorAll(".ccell").length, righe:document.querySelectorAll("#cyc .crow").length, nav:getComputedStyle(document.querySelector(".cycbar")).display, corpo:document.body.classList.contains("cic-cal"), salvato:JSON.parse(localStorage.getItem("nt:state")).piano?.vistaCiclo}));
  ok(c.celle===35 && c.righe===0 && c.nav!=="none" && c.corpo && c.salvato==="calendario", "«Calendario»: 5 settimane da 7 giorni, la striscia sparisce, le frecce e «Scegli giorno» restano, la scelta resta → "+JSON.stringify(c));
  await p.reload(); await p.waitForTimeout(1100); await p.evaluate(()=>document.querySelector('[data-tab="turni"]').click()); await p.waitForTimeout(400);
  ok(await q(p,()=>document.querySelectorAll(".ccell").length===35), "dopo aver riaperto la pagina si resta sul calendario");
  await p.context().close(); }

// oggi è domenica 25 ottobre: la settimana di oggi in cima, titolo del mese del giovedì, frecce agganciate al mese
{ const p=await apri(ST({piano:{vistaCiclo:"calendario"}}));
  ok(await titolo(p)==="Ottobre" && await primo(p)==="2026-10-19", "parte dalla settimana di oggi: «Ottobre», lunedì 19 → "+await titolo(p)+" "+await primo(p));
  const oggi=await q(p,()=>{ const o=document.querySelectorAll(".ccell.oggi"); return {n:o.length, g:o[0]?.dataset.calGiorno, passati:document.querySelectorAll(".ccell.passato").length}; });
  ok(oggi.n===1 && oggi.g==="2026-10-25" && oggi.passati===6, "oggi è uno solo e cerchiato (25 ottobre), i giorni prima sono più tenui ("+oggi.passati+")");
  await p.click('#cycNext'); await p.waitForTimeout(150);
  ok(await titolo(p)==="Novembre" && await primo(p)==="2026-11-02", "› si aggancia all'inizio di novembre (lunedì 2) → "+await titolo(p)+" "+await primo(p));
  await p.click('#cycNext'); await p.waitForTimeout(150);
  ok(await titolo(p)==="Dicembre" && await primo(p)==="2026-11-30", "› di nuovo: la settimana che contiene il primo giorno di dicembre → "+await titolo(p)+" "+await primo(p));
  ok(await q(p,()=>document.querySelector("#cycToday").textContent==="Torna a oggi"), "lontano da oggi il pulsante dice «Torna a oggi»");
  await p.click("#cycToday"); await p.waitForTimeout(150);
  ok(await titolo(p)==="Ottobre" && await primo(p)==="2026-10-19" && await q(p,()=>document.querySelector("#cycToday").textContent==="Scegli giorno"), "«Torna a oggi» riporta a oggi");
  await p.click('#cycPrev'); await p.waitForTimeout(150);
  ok(await primo(p)<"2026-10-19", "‹ va indietro → "+await primo(p));
  // le sigle, i colori e il mese: 1 novembre è «1 NOV» in grassetto, i numeri di un altro mese hanno la loro classe
  await p.click("#cycToday"); await p.waitForTimeout(150);
  const g=await q(p,()=>({uno:[...document.querySelectorAll(".cnum.uno")].map(x=>x.textContent), altro:document.querySelectorAll(".cnum.altro").length, tipi:[...document.querySelectorAll(".ctile:not(.p)")].slice(0,7).map(x=>x.textContent+":"+x.className.replace("ctile ","")).join(" ")}));
  ok(g.uno[0]==="1 NOV" && g.altro>0, "«1 NOV» in grassetto e i numeri di novembre con la classe «altro mese» ("+g.altro+")");
  // «Scegli giorno»: il calendario salta alla settimana di quel giorno, il titolo dice il mese
  await p.evaluate(()=>{ const j=document.querySelector("#jumpDate"); j.value="2026-12-14"; j.dispatchEvent(new Event("change",{bubbles:true})); }); await p.waitForTimeout(250);
  ok(await primo(p)==="2026-12-14" && await titolo(p)==="Dicembre", "un giorno scelto porta alla sua settimana, e il mese è nel titolo → "+await primo(p)+" "+await titolo(p));
  ok(await q(p,()=>!document.querySelector(".cal-testa, .cal-titolo")), "dentro il calendario non c'è più un secondo titolo");
  ok(await q(p,()=>{ const l=document.querySelector("#cyc .key").textContent; return /Mattina/.test(l) && /Pomeriggio/.test(l) && /Notte/.test(l) && /Riposo/.test(l); }), "la legenda dice le fasce che ci sono: mattina, pomeriggio, notte, riposo");
  ok(/M:t-m/.test(g.tipi) && /R:t-r/.test(g.tipi), "sigle e fasce dei giorni: mattina (t-m) e riposo (t-r) → "+g.tipi);
  await p.context().close(); }

// la persona: seconda riga più bassa, nascondibile dal chip; un tocco su un giorno apre il giorno
{ const p=await apri(ST({piano:{vistaCiclo:"calendario"}}));
  ok(await q(p,()=>document.querySelectorAll(".ctile.p").length===35 && document.querySelector(".key-pers")?.getAttribute("aria-pressed")==="true"), "con la persona: una seconda riga per ogni giorno e il chip nella legenda");
  await p.click("[data-cp-toggle]"); await p.waitForTimeout(300);
  ok(await q(p,()=>document.querySelectorAll(".ctile.p").length===0 && document.querySelector(".key-pers")?.getAttribute("aria-pressed")==="false" && document.querySelectorAll(".ccell").length===35), "il chip la nasconde (e il calendario resta)");
  await p.click('.ccell[data-cal-giorno="2026-10-28"]'); await p.waitForTimeout(300);
  ok(await q(p,()=>!document.querySelector("#quickShiftModal").hidden), "un tocco su un giorno apre il giorno (scelta del turno)");
  await p.context().close(); }
{ const p=await apri(ST({people:[],piano:{vistaCiclo:"calendario"}}));
  ok(await q(p,()=>document.querySelectorAll(".ctile.p").length===0 && !document.querySelector(".key-pers")), "senza persone: solo la tua riga e nessun chip");
  await p.click('[data-vista="ore"]'); await p.waitForTimeout(400);
  ok(await q(p,()=>document.querySelectorAll("#cyc .crow").length>0 && getComputedStyle(document.querySelector(".cycbar")).display!=="none"), "«Ore» riporta la striscia e le sue frecce");
  await p.context().close(); }

// il sonno della persona: solo se è un dato suo (ha mandato gli orari), tratteggiato sullo stesso filo del turno
{ const p=await apri(ST({people:[{name:"Anna",pattern:"MMRR",anchor:"2026-10-20",wake:"08:00",bed:"00:30"}]}));
  const s=await q(p,()=>({sonno:document.querySelectorAll("#cyc .cbar.pers.son").length, turno:document.querySelectorAll("#cyc .cbar.pers:not(.son)").length, hint:/tratteggiato: sonno/.test(document.querySelector("#cyc .key").textContent)}));
  ok(s.sonno>=5 && s.turno>0 && s.hint, "con gli orari di Anna: il suo sonno è un tratto tratteggiato accanto al filo del turno, e la legenda lo dice → "+JSON.stringify(s));
  await p.context().close(); }
{ const p=await apri(ST());
  const s=await q(p,()=>({sonno:document.querySelectorAll("#cyc .cbar.pers.son").length, turno:document.querySelectorAll("#cyc .cbar.pers:not(.son)").length, hint:/tratteggiato/.test(document.querySelector("#cyc .key").textContent)}));
  ok(s.sonno===0 && s.turno>0 && !s.hint, "senza i suoi orari («sonno come il tuo»): niente sonno inventato, resta il filo del turno → "+JSON.stringify(s));
  await p.context().close(); }
console.log("errori", errs); await b.close();
