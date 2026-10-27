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

{ const p=await apri(base);
  await p.evaluate(d=>{ const f=document.querySelector("#next"); f.click(); }, 0); await p.waitForTimeout(300);
  await p.click("#shiftPill"); await p.waitForTimeout(300);
  ok(await p.evaluate(()=>!!document.querySelector("#qsNuovoApri")), "il foglio del giorno ha «＋ Un altro turno»");
  await p.click("#qsNuovoApri"); await p.waitForTimeout(150);
  ok(await p.evaluate(()=>!document.querySelector("#qsNuovoForm").hidden && document.querySelector("#qsNuovoNome").placeholder==="Giornata"), "nome e orari; con 08:00–16:00 il nome proposto è «Giornata»");
  await p.click("#qsNuovoOk"); await p.waitForTimeout(400);
  const st=await stato(p), k=Object.keys(st.shifts).find(x=>st.shifts[x].n==="Giornata");
  ok(k && st.shifts[k].s===480 && st.shifts[k].e===960 && st.ecc[iso(dom)]===k, "nasce il turno «Giornata» (08:00–16:00) e vale per quel giorno → "+k);
  ok(await p.evaluate(()=>/Giornata/.test(document.querySelector("#shiftPill").textContent)), "il giorno ora dice «Giornata», non «Pomeriggio»");
  // il secondo giorno: è già fra i tuoi turni, un tocco
  await p.evaluate(()=>document.querySelector("#next").click()); await p.waitForTimeout(300);
  await p.click("#shiftPill"); await p.waitForTimeout(300);
  ok(await p.evaluate(()=>[...document.querySelectorAll("#qsGrid .qs-btn")].some(x=>/Giornata/.test(x.textContent) && /08:00–16:00/.test(x.textContent))), "dopodomani «Giornata 08:00–16:00» è fra i turni, un tocco");
  await p.click('#qsGrid [data-qs]:not([data-qs="R"]):not([data-qs="M"]):not([data-qs="P"]):not([data-qs="N"])'); await p.waitForTimeout(300);
  const st2=await stato(p); ok(st2.ecc[iso(dopo)]===k && Object.keys(st2.shifts).length===4, "un solo turno nuovo per i due giorni");
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
  ok(/Turni › «Segna o importa i turni»/.test(t.hint) && /Festivi/.test(t.hint), "e dove si segnano ferie, cambi e festivi");
  await p.context().close(); }

console.log("errori", errs); ok(errs.length===0, "nessun errore di pagina"); await b.close();
