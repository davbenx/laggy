// Il diario di Oggi: un solo modo per sonno, energia e pisolino. Domanda con
// gli orari → «Sì, così» o «Altri orari» (campi e Salva) → una riga con
// «Modifica». Le scelte si salvano al tocco. Il pisolino si chiede solo dopo
// che è cominciato.
import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const apri=async(ore,min)=>{
  const ora=new Date(); ora.setHours(ore,min,0,0);
  const ctx=await b.newContext({locale:"it-IT",viewport:{width:360,height:740}});
  await ctx.clock.install({time:ora});
  await ctx.addInitScript(a=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
    const f=new Date(a+"T12:00:00"); f.setDate(f.getDate()-10);
    localStorage.setItem("nt:state",JSON.stringify({turniConfigurati:true,pattern:"NSRMP",anchor:a,shifts:{M:{n:"Mattino",s:420,e:840},P:{n:"Pomeriggio",s:840,e:1260},N:{n:"Notte",s:1260,e:1860}},repeat:true,firstSeenAt:f.getFullYear()+"-"+String(f.getMonth()+1).padStart(2,"0")+"-"+String(f.getDate()).padStart(2,"0")}));
    localStorage.setItem("nt:attivazioneNascosta","true"); localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:firstPlanBannerChiuso","true"); }, iso(ora));
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.goto("http://localhost:8765/index.html"); await p.clock.runFor(1500);
  return p;
};
const box=p=>p.evaluate(()=>{ const d=document.querySelector("#essenziale .drem"); return d ? d.innerText.replace(/\s+/g," ").trim() : ""; });
const n=(p,s)=>p.evaluate(s=>document.querySelectorAll("#essenziale .drem "+s).length, s);
const tap=async(p,s)=>{ await p.click("#essenziale .drem "+s); await p.clock.runFor(300); };
let p=await apri(9,30);
let t=await box(p);
ok(/Hai dormito \d\d:\d\d → \d\d:\d\d\?/.test(t) && /Sì, così/.test(t) && /Altri orari/.test(t) && await n(p,"input")===0, "sonno: una domanda con gli orari, «Sì, così» o «Altri orari», nessun campo aperto");
ok(!/Pisolino/.test(t), "alle 9:30 il pisolino delle 17:20 non si chiede");
await tap(p,"[data-open]");
ok(await n(p,"input[type=time]")===2 && /Salva/.test(await box(p)) && /Annulla/.test(await box(p)), "«Altri orari»: due campi, Salva e Annulla");
await tap(p,"[data-annulla-sleep]");
ok(await n(p,"input")===0 && /Hai dormito/.test(await box(p)), "Annulla: si torna alla domanda, niente salvato");
await tap(p,"[data-confirm-sleep]");
t=await box(p);
ok(/✓ Sonno \d\d:\d\d–\d\d:\d\d · /.test(t) && /Modifica/.test(t) && await n(p,"[data-confirm-sleep]")===0, "«Sì, così»: una riga con gli orari e Modifica → "+t.slice(0,70));
ok(await n(p,"[data-diary]")===5 && /Come ti senti\?/.test(t), "poi «Come ti senti?», cinque scelte");
await tap(p,'[data-diary="4"]');
t=await box(p);
ok(/Energia: Bene/.test(t) && /Cambia/.test(t) && await n(p,"[data-diary]")===0, "un tocco sull'energia: salvata, resta «Energia: Bene · Cambia»");
await tap(p,"[data-voto-edit]");
ok(await n(p,"[data-diary]")===5, "«Cambia» riapre le cinque scelte");
await tap(p,'[data-diary="2"]');
ok(/Energia: Poca energia/.test(await box(p)) && await p.evaluate(()=>Object.values(JSON.parse(localStorage.getItem("nt:diary")))[0]===2), "e la nuova scelta è salvata");
await tap(p,"[data-open]");
await p.fill("#essenziale .drem [data-sleep-wake]","08:15"); await tap(p,"[data-confirm-sleep]");
ok(/–08:15 ·/.test(await box(p)) && await n(p,"input")===0, "Modifica → campi → Salva: la riga si aggiorna e si richiude");
await p.context().close();
// pomeriggio: il pisolino è cominciato
p=await apri(18,40);
await tap(p,"[data-confirm-sleep]");
t=await box(p);
ok(/Hai fatto il pisolino \d\d:\d\d → \d\d:\d\d\?/.test(t) && /Saltato/.test(t), "pisolino cominciato: la domanda, con «Sì, così», «Altri orari», «Saltato»");
await tap(p,'[data-nap="si"]');
t=await box(p);
ok(/✓ Pisolino \d\d:\d\d–\d\d:\d\d/.test(t) && await n(p,"[data-nap]")===0, "«Sì, così»: una riga, nessun bottone che resta lì");
await tap(p,"[data-edit-nap]");
await p.fill("#essenziale .drem [data-nap-in-b]","20:00"); await tap(p,"[data-nap-salva]");
t=await box(p);
ok(/✓ Pisolino \d\d:\d\d–20:00/.test(t) && /Più lungo del previsto/.test(t), "Modifica → Salva: orari veri, e l'avviso se è durato troppo");
await p.context().close();
p=await apri(18,40);
await tap(p,"[data-confirm-sleep]"); await tap(p,'[data-nap="no"]');
t=await box(p);
ok(/Pisolino saltato/.test(t) && /Modifica/.test(t) && await n(p,"[data-nap]")===0, "«Saltato»: una riga «Pisolino saltato · Modifica»");
await tap(p,"[data-nap-riapri]");
ok(/Hai fatto il pisolino/.test(await box(p)), "Modifica: si torna alla domanda");
ok(await p.evaluate(()=>!!document.querySelector('#essenziale [data-row^="nap"] [data-skip-recupero], #essenziale [data-row^="nap"] .ed')), "le scelte da fare prima del pisolino stanno nella sua riga del piano");
// «e la palestra quando la faccio?»: il tempo libero vero, nella lista della giornata
const lib=await p.evaluate(()=>{ const r=document.querySelector('#essenziale [data-row="liberi"]'); if(!r) return null;
  r.open=true; return {val:r.querySelector(".en").innerText, det:r.querySelector(".ed").innerText}; });
ok(lib && /\d\d:\d\d → \d\d:\d\d/.test(lib.val) && /palestra/i.test(lib.det) && /ultima ora prima di dormire/.test(lib.det), "riga «Libero» con le finestre vere e la nota su palestra e sonno");
console.log("errori", errs); await b.close();
