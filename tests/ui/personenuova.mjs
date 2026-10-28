// Aggiungere una persona: una scelta (ha l'app, fa i tuoi turni, lun–ven, turni diversi) e compare solo quello che serve.
// «Fa i miei turni»: di quanti giorni è sfasata, con l'anteprima dei suoi sette giorni; niente da scrivere. Si annulla.
import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const SH={M:{n:"Mattino",s:360,e:840},P:{n:"Pomeriggio",s:840,e:1320},N:{n:"Notte",s:1320,e:1800}};
const oggi=new Date(); oggi.setHours(12,0,0,0);
const ST={turniConfigurati:true,pattern:"MMPPNNRR",anchor:iso(oggi),shifts:SH,repeat:true,firstSeenAt:"2026-01-01",freeBed:"23:30",freeWake:"07:30"};
const apri=async(st,w=390,h=844)=>{
  const ctx=await b.newContext({locale:"it-IT",viewport:{width:w,height:h}});
  await ctx.addInitScript(st=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1"); localStorage.setItem("nt:state",JSON.stringify(st)); localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:firstPlanBannerChiuso","true"); localStorage.setItem("nt:attivazioneNascosta","true"); localStorage.setItem("nt:novitaViste",JSON.stringify("2099")); }, st);
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(900);
  await p.evaluate(()=>document.querySelector('[data-tab="turni"]').click()); await p.waitForTimeout(300);
  await p.evaluate(()=>document.querySelector("#doPartner").click()); await p.waitForTimeout(300);
  await p.evaluate(()=>document.querySelector("[data-partner-edit]").click()); await p.waitForTimeout(400);
  return p;
};
const stato=p=>p.evaluate(()=>JSON.parse(localStorage.getItem("nt:state")));
const visibile=(p,s)=>p.evaluate(s=>{ const e=document.querySelector(s); return !!e && !e.hidden && e.offsetParent!==null; }, s);

{ const p=await apri(ST);
  ok(await p.evaluate(()=>document.querySelectorAll("[data-pvia]").length===4), "quattro scelte: ha l'app, fa i miei turni, lun–ven, turni diversi");
  ok(!(await visibile(p,"#doConfirmPersona")) && !(await visibile(p,"#pvManuale")) && !(await visibile(p,"#pvLink")) && !(await visibile(p,"#annullaModificaPersona")), "all'inizio: nome e scelte, nessun modulo, né «Aggiungi» né «Annulla»");
  await p.fill("#personaName","Anna");
  await p.click('[data-pvia="mine"]'); await p.waitForTimeout(200);
  ok(await visibile(p,"#pvSfasa") && !(await visibile(p,"#personaPattern")) && !(await visibile(p,"#personaShiftsList")) && await p.evaluate(()=>document.querySelectorAll("#pvAnteprima .ptile").length===7), "«Fa i miei turni»: il passo e i suoi sette giorni, niente sequenza né orari da scrivere");
  ok(await p.evaluate(()=>/1 giorno dopo il mio/.test(document.querySelector("#pvSfasaTx").textContent)), "parte da «1 giorno dopo il mio»");
  await p.click('[data-pv-sfasa="1"]'); await p.waitForTimeout(150);
  ok(await p.evaluate(()=>/2 giorni dopo il mio/.test(document.querySelector("#pvSfasaTx").textContent)), "+ : «2 giorni dopo il mio»");
  await p.click("#doConfirmPersona"); await p.waitForTimeout(500);
  const st=await stato(p), ancora=new Date(oggi); ancora.setDate(ancora.getDate()+2);
  const per=st.pPattern ? {pattern:st.pPattern, anchor:st.pAnchor, shifts:st.pShifts, name:st.pName} : st.people[0];
  ok(per && per.name==="Anna" && per.pattern==="MMPPNNRR" && per.anchor===iso(ancora) && per.shifts && per.shifts.N.s===1320, "Anna: stessa rotazione, partita 2 giorni dopo, con i tuoi orari copiati");
  ok(await p.evaluate(()=>document.querySelectorAll("#wizPeopleList .diary .ptile").length===7 && !document.querySelector("#wizPeopleList .diary").textContent.includes("MMPPNN")), "nella lista: i suoi sette giorni colorati, non le lettere della sequenza");
  ok(!(await visibile(p,"#doConfirmPersona")) && await p.evaluate(()=>document.querySelector("#personaName").value===""), "il modulo si richiude e si svuota");
  await p.click("#toast .toast-undo"); await p.waitForTimeout(400);
  const st2=await stato(p); ok(!st2.pPattern && !(st2.people||[]).length, "«Annulla»: Anna non c'è più");
  await p.context().close(); }

{ const p=await apri(ST);
  await p.click('[data-pvia="day"]'); await p.waitForTimeout(150);
  ok(!(await visibile(p,"#pvManuale")) && await visibile(p,"#doConfirmPersona"), "«Lavora lun–ven»: niente da scrivere, solo «Aggiungi»");
  await p.click("#doConfirmPersona"); await p.waitForTimeout(400);
  const st=await stato(p), per=st.pPattern ? {pattern:st.pPattern} : st.people[0];
  ok(per && per.pattern==="GGGGGRR", "giornata lun–ven, riposo nel weekend");
  await p.context().close(); }

{ const p=await apri(ST);
  await p.fill("#personaName","Luca");
  await p.click('[data-pvia="custom"]'); await p.waitForTimeout(150);
  ok(await visibile(p,"#pvPennelli") && !(await visibile(p,"#pvSfasa")) && await p.evaluate(()=>!document.querySelector("#personaSeqBox .pv-testo").open), "«Turni diversi»: i turni da toccare, la sequenza a lettere è chiusa");
  ok(await p.evaluate(()=>[...document.querySelectorAll("#pvPennelli .pv-pen")].map(b=>b.dataset.pvPen).join("")==="RMPNG"), "i pennelli: Riposo e i tuoi turni, più la giornata");
  ok(await p.evaluate(()=>{ const d=document.querySelector(".pv-sonno"); return !!d && !d.open; }), "il sonno è chiuso («＋ Il suo sonno nei giorni liberi (facoltativo)»), senza tendine vuote");
  for(const l of ["M","M","R","R"]) await p.click('[data-pv-pen="'+l+'"]');
  await p.waitForTimeout(150);
  ok(await p.evaluate(()=>document.querySelector("#personaPattern").value==="MMRR" && document.querySelectorAll("#pvSeqStrip .pv-gg").length===4 && /Tocca il giorno/.test(document.querySelector("#pvOggiNota").textContent)), "toccando M, M, R, R: «MMRR», quattro giorni, «Tocca il giorno in cui è oggi»");
  ok(await p.evaluate(()=>document.querySelectorAll("#personaShiftsList .psh").length===1 && document.querySelector('#personaShiftsList .psh[data-l="M"] [data-fld="s"]').value==="06:00"), "un orario per ogni lettera, partendo dai tuoi (M 06:00)");
  await p.click('#pvSeqStrip [data-pv-gg="1"]'); await p.waitForTimeout(150);
  const ieri=new Date(oggi); ieri.setDate(ieri.getDate()-1);
  ok(await p.evaluate(a=>document.querySelector("#personaAnchor").value===a && /giorno 2/.test(document.querySelector("#pvOggiNota").textContent), iso(ieri)), "tocchi il giorno 2: «oggi è il giorno 2», la partenza è ieri");
  await p.click("#pvSeqTogli"); await p.waitForTimeout(150);
  ok(await p.evaluate(()=>document.querySelector("#personaPattern").value==="MMR"), "«Togli l'ultimo»");
  await p.click("#doConfirmPersona"); await p.waitForTimeout(500);
  const st=await stato(p), per=st.pPattern ? {pattern:st.pPattern, anchor:st.pAnchor, shifts:st.pShifts, name:st.pName} : st.people[0];
  ok(per && per.name==="Luca" && per.pattern==="MMR" && per.anchor===iso(ieri) && per.shifts && per.shifts.M.s===360, "Luca: MMR, partito ieri, con gli orari proposti");
  await p.context().close(); }

{ const p=await apri(ST);
  await p.click('[data-pvia="link"]'); await p.waitForTimeout(150);
  ok(await visibile(p,"#personaLink") && await visibile(p,"#doIncollaLink") && await visibile(p,"#doChiediLink"), "«Ha Notturnisti»: invia il tuo link, incolla il suo");
  await p.click("#doConfirmPersona"); await p.waitForTimeout(200);
  ok(await p.evaluate(()=>/Incolla il suo link/.test(document.querySelector("#personaLinkErr").textContent)), "senza link, il messaggio dice cosa fare");
  await p.context().close(); }

console.log("errori", errs); ok(errs.length===0, "nessun errore di pagina"); await b.close();
