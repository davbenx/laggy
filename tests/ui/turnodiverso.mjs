// Sostituire il turno di un giorno con uno diverso (una «giornata» al posto del pomeriggio): un altro turno con nome e orari,
// che poi si trova fra i tuoi; e il nome segue gli orari quando si cambiano. Le ferie già segnate e i cambi turno
// contano nelle proposte di ferie.
import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const SH={M:{n:"Mattino",s:360,e:840},P:{n:"Pomeriggio",s:840,e:1320},N:{n:"Notte",s:1320,e:1800}};
const oggi=new Date(); oggi.setHours(12,0,0,0);
const dom=new Date(oggi); dom.setDate(dom.getDate()+1); const dopo=new Date(oggi); dopo.setDate(dopo.getDate()+2);
const apri=async(st)=>{
  const ctx=await b.newContext({locale:"it-IT",viewport:{width:390,height:844}});
  await ctx.addInitScript(st=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1"); localStorage.setItem("nt:state",JSON.stringify(st)); localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:firstPlanBannerChiuso","true"); localStorage.setItem("nt:attivazioneNascosta","true"); localStorage.setItem("nt:novitaViste",JSON.stringify("2099")); }, st);
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(1000); return p;
};
const stato=p=>p.evaluate(()=>JSON.parse(localStorage.getItem("nt:state")));
const base={turniConfigurati:true,pattern:"PPPPPPP",anchor:iso(oggi),shifts:SH,repeat:true,firstSeenAt:"2026-01-01",freeBed:"23:30",freeWake:"07:30"};

const imposta=async(p,sel,v)=>{ await p.evaluate(([sel,v])=>{ const i=document.querySelector(sel); i.value=v; i.dispatchEvent(new Event("change",{bubbles:true})); },[sel,v]); await p.waitForTimeout(250); };
{ const p=await apri(base);
  await p.evaluate(()=>document.querySelector("#next").click()); await p.waitForTimeout(300);
  await p.click("#shiftPill"); await p.waitForTimeout(300);
  ok(await p.evaluate(()=>{ const s=document.querySelector("#quickShiftModal .qs-sheet"); return !!document.querySelector("#qsOrari [data-qs-ora=s]") && !document.querySelector("#qsNuovoApri") && s.scrollHeight<=s.clientHeight+2; }), "il foglio ha una sola riga di orari, niente modulo a parte, e sta in una schermata");
  await imposta(p,'#qsOrari [data-qs-ora="s"]',"08:00"); await imposta(p,'#qsOrari [data-qs-ora="e"]',"16:00");
  ok(await p.evaluate(()=>/Giornata/.test(document.querySelector("#shiftPill").textContent) && !!document.querySelector("#qsOrari [data-qs-salva]")), "cambi le ore e vale subito: il giorno è «Giornata» e compare «Salva «Giornata» fra i tuoi turni»");
  ok(await p.evaluate(()=>!document.querySelector("#qsReset").hidden && /Annulla/.test(document.querySelector("#toast").textContent)), "«Ripristina» in alto e «Annulla» nell'avviso");
  await p.click("#qsOrari [data-qs-salva]"); await p.waitForTimeout(400);
  const st=await stato(p), k=Object.keys(st.shifts).find(x=>st.shifts[x].n==="Giornata");
  ok(k && st.shifts[k].s===480 && st.shifts[k].e===960 && st.ecc[iso(dom)]===k && !(st.giorni&&st.giorni[iso(dom)]&&st.giorni[iso(dom)].s!=null), "un tocco: «Giornata» è fra i tuoi turni e vale per quel giorno → "+k);
  await p.evaluate(()=>document.querySelector("#qsClose").click()); await p.waitForTimeout(200);
  await p.evaluate(()=>document.querySelector("#next").click()); await p.waitForTimeout(300);
  await p.click("#shiftPill"); await p.waitForTimeout(300);
  ok(await p.evaluate(()=>[...document.querySelectorAll("#qsGrid .qs-btn")].some(x=>/Giornata/.test(x.textContent) && /08:00–16:00/.test(x.textContent))), "dopodomani «Giornata 08:00–16:00» è fra i turni, un tocco");
  await p.click('#qsGrid [data-qs]:not([data-qs="R"]):not([data-qs="M"]):not([data-qs="P"]):not([data-qs="N"])'); await p.waitForTimeout(300);
  const st2=await stato(p); ok(st2.ecc[iso(dopo)]===k && Object.keys(st2.shifts).length===4, "un solo turno nuovo per i due giorni");
  await p.context().close(); }

// mezz'ora in più sullo stesso pomeriggio: niente da salvare; «Annulla» rimette com'era
{ const p=await apri(base);
  await p.evaluate(()=>document.querySelector("#next").click()); await p.waitForTimeout(300);
  await p.click("#shiftPill"); await p.waitForTimeout(300);
  await imposta(p,'#qsOrari [data-qs-ora="e"]',"22:30");
  ok(await p.evaluate(()=>!document.querySelector("#qsOrari [data-qs-salva]") && /Pomeriggio/.test(document.querySelector("#shiftPill").textContent)), "straordinario sullo stesso turno: resta «Pomeriggio», niente da salvare");
  await p.click("#toast .toast-undo"); await p.waitForTimeout(300);
  const st=await stato(p); ok(!(st.giorni&&st.giorni[iso(dom)]), "«Annulla»: orari di prima");
  await p.context().close(); }

// giorno di riposo: «＋ Orari diversi»
{ const p=await apri(Object.assign({}, base, {pattern:"PR", anchor:iso(oggi)}));
  await p.evaluate(()=>document.querySelector("#next").click()); await p.waitForTimeout(300);
  await p.click("#shiftPill"); await p.waitForTimeout(300);
  ok(await p.evaluate(()=>!!document.querySelector("#qsOrari [data-qs-orari-apri]")), "giorno di riposo: «＋ Orari diversi»");
  await p.click("#qsOrari [data-qs-orari-apri]"); await p.waitForTimeout(150);
  await p.click("#qsOrari [data-qs-orari-ok]"); await p.waitForTimeout(400);
  const st=await stato(p), k=Object.keys(st.shifts).find(x=>st.shifts[x].n==="Giornata");
  ok(k && st.ecc[iso(dom)]===k, "08:00–16:00 sul riposo: nasce «Giornata» e il giorno lo usa");
  await p.context().close(); }

// giorni speciali: due in vista, il resto dietro «Altro»
{ const p=await apri(base);
  await p.evaluate(()=>document.querySelector("#next").click()); await p.waitForTimeout(300);
  await p.click("#shiftPill"); await p.waitForTimeout(300);
  ok(await p.evaluate(()=>{ const c=[...document.querySelectorAll("#qsSpec .qs-chip")].map(x=>x.textContent.trim()); return c.length===3 && /Ferie/.test(c[0]) && /Malattia/.test(c[1]) && /Altro/.test(c[2]); }), "giorni speciali: Ferie, Malattia, «Altro»");
  await p.click("#qsSpec [data-qs-altro]"); await p.waitForTimeout(150);
  ok(await p.evaluate(()=>{ const c=[...document.querySelectorAll("#qsSpec .qs-chip")].map(x=>x.textContent.trim()).join("|"); return /Reperibil/.test(c) && /Formazione/.test(c) && /extra/i.test(c); }), "«Altro» apre reperibilità, formazione e turno extra");
  ok(await p.evaluate(()=>/Cambio turno/.test(document.querySelector("#qsVaiScambio").textContent) && !/mi conviene/.test(document.querySelector("#qsVaiScambio").textContent)), "in fondo: «Cambio turno»");
  await p.context().close(); }

// orari diversi: il nome segue la fascia
{ const p=await apri(Object.assign({}, base, {giorni:{[iso(dom)]:{s:480,e:960}}}));
  await p.evaluate(()=>document.querySelector("#next").click()); await p.waitForTimeout(300);
  ok(await p.evaluate(()=>/Giornata/.test(document.querySelector("#shiftPill").textContent)), "orari personalizzati 08:00–16:00 su un pomeriggio: il giorno dice «Giornata»");
  await p.context().close(); }
{ const p=await apri(Object.assign({}, base, {giorni:{[iso(dom)]:{s:870,e:1350}}}));
  await p.evaluate(()=>document.querySelector("#next").click()); await p.waitForTimeout(300);
  ok(await p.evaluate(()=>/Pomeriggio/.test(document.querySelector("#shiftPill").textContent)), "mezz'ora in più sullo stesso pomeriggio: resta «Pomeriggio»");
  await p.context().close(); }

// ferie: quelle già segnate e i cambi turno contano, e si dice dove si segnano
{ const st=Object.assign({}, base, {pattern:"MMMMRR", anchor:iso(oggi), giorni:{}, ecc:{}});
  const f1=new Date(oggi); f1.setDate(f1.getDate()+9); const f2=new Date(oggi); f2.setDate(f2.getDate()+10); const cc=new Date(oggi); cc.setDate(cc.getDate()+14);
  st.giorni[iso(f1)]={t:"ferie"}; st.giorni[iso(f2)]={t:"ferie"}; st.ecc[iso(cc)]="R";
  const p=await apri(st);
  await p.evaluate(()=>document.querySelector('[data-tab="turni"]').click()); await p.waitForTimeout(300);
  await p.evaluate(()=>document.querySelector("#doFerie").click()); await p.waitForTimeout(500);
  const t=await p.evaluate(()=>({gia:[...document.querySelectorAll(".fg.gia")].length, hint:[...document.querySelectorAll("#ferieOut .hint")].map(x=>x.textContent).join(" ")}));
  ok(/Già nel conto:.*2 giorni di ferie già segnati.*1 cambio turno/.test(t.hint), "il riquadro dice cosa è già nel conto: ferie e cambi segnati → "+t.hint.slice(0,160));
  ok(/Modifica turni › «Segna i giorni del mese»/.test(t.hint) && /Festivi/.test(t.hint), "e dove si segnano ferie, cambi e festivi");
  await p.context().close(); }

console.log("errori", errs); ok(errs.length===0, "nessun errore di pagina"); await b.close();
