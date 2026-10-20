// «Lo sapevi?»: in fondo a Oggi una funzione mai usata, una volta sola, non
// nei primi giorni, al più una ogni 3 giorni; «Prova» la apre, × la chiude.
import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const fa=n=>{ const d=new Date(); d.setDate(d.getDate()-n); return iso(d); };
const SH={M:{n:"Mattino",s:420,e:840},P:{n:"Pomeriggio",s:840,e:1260},N:{n:"Notte",s:1260,e:1860}};
const apri=async(st, extra={})=>{
  const ctx=await b.newContext({locale:"it-IT",viewport:{width:360,height:740}});
  await ctx.addInitScript(([st,extra])=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
    localStorage.setItem("nt:state",JSON.stringify(st)); localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:firstPlanBannerChiuso","true");
    localStorage.setItem("nt:attivazioneNascosta","true");
    for(const k in extra) localStorage.setItem("nt:"+k, JSON.stringify(extra[k])); }, [st,extra]);
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(900);
  return p;
};
const tip=p=>p.evaluate(()=>{ const el=document.querySelector("#loSapevi"); return el.hidden ? "" : el.dataset.k+": "+el.textContent; });
const ST={turniConfigurati:true,pattern:"MPNSR",anchor:fa(3),shifts:SH,repeat:true};
// primi giorni: niente
let p=await apri(Object.assign({firstSeenAt:fa(1)}, ST));
ok(await tip(p)==="", "nei primi giorni d'uso niente consigli");
await p.context().close();
// dopo 10 giorni: il primo consiglio, con Prova che apre la funzione
p=await apri(Object.assign({firstSeenAt:fa(10)}, ST));
let t=await tip(p);
ok(/^mese: Lo sapevi\?/.test(t), "dopo qualche giorno: «Lo sapevi?» sui turni del mese → "+t);
ok(await p.evaluate(()=>{ const r=document.querySelector("#loSapevi").getBoundingClientRect(), c=document.querySelector("#aCasa").getBoundingClientRect(); return r.top>c.top; }), "sta in fondo, sotto «Manda a casa»");
await p.click("[data-sapevi-prova]"); await p.waitForTimeout(300);
ok(await p.evaluate(()=>document.body.classList.contains("tab-turni") && !document.querySelector("#segnaPagina").hidden), "«Prova» apre I turni del mese");
await p.click('[data-tab="oggi"]'); await p.waitForTimeout(300);
ok(await tip(p)==="", "usata: non torna, e oggi nessun altro consiglio");
const S=await p.evaluate(()=>JSON.parse(localStorage.getItem("nt:loSapevi")));
await p.context().close();
// tre giorni dopo: il successivo, mai quello già visto; × lo chiude per sempre
S.oggi.d=fa(3);
p=await apri(Object.assign({firstSeenAt:fa(10)}, ST), {loSapevi:S, funzioniUsate:{mese:fa(3)}});
t=await tip(p);
ok(/^ferie:/.test(t), "tre giorni dopo il prossimo: ferie → "+t);
await p.click("[data-sapevi-chiudi]"); await p.waitForTimeout(200);
await p.reload(); await p.waitForTimeout(900);
ok(await tip(p)==="", "× lo chiude: ricaricando non torna");
await p.context().close();
// meno di 3 giorni dall'ultimo: niente
p=await apri(Object.assign({firstSeenAt:fa(10)}, ST), {loSapevi:{visti:["mese"], oggi:{k:"mese", d:fa(1)}}});
ok(await tip(p)==="", "al massimo uno ogni 3 giorni");
await p.context().close();
// chi ha già persone e ha usato il mese: si salta al successivo non usato
p=await apri(Object.assign({firstSeenAt:fa(10), people:[{name:"Anna",pattern:"MMRR",anchor:fa(2)}]}, ST), {funzioniUsate:{mese:fa(5), ferie:fa(5)}});
t=await tip(p);
ok(/^scambio:/.test(t), "salta le funzioni già usate (mese, ferie, persone) → "+t);
await p.context().close();
// il riepilogo per il medico solo dopo 2 mesi d'uso
p=await apri(Object.assign({firstSeenAt:fa(20)}, ST), {funzioniUsate:{mese:1,ferie:1,persone:1,scambio:1,sonno:1}});
ok(await tip(p)==="", "riepilogo per il medico: non prima di due mesi d'uso");
await p.context().close();
ok(!errs.length, "nessun errore di pagina "+JSON.stringify(errs));
await b.close();
