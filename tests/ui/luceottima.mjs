// La luce dell'ottimizzatore nella pagina: il Worker calcola in background, la riga «Luce» passa dalle regole alle ore
// ottimizzate, il risultato resta per il giorno; se turni cambiano, si torna alle regole finché non arriva il ricalcolo;
// senza Worker restano le regole.
import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const SH={M:{n:"Mattino",s:360,e:840},P:{n:"Pomeriggio",s:840,e:1320},N:{n:"Notte",s:1320,e:1800}};
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const anc=new Date(); anc.setDate(anc.getDate()-2);
const st={turniConfigurati:true,pattern:"MPNSR",anchor:iso(anc),shifts:SH,repeat:true,firstSeenAt:"2026-01-01",freeBed:"23:30",freeWake:"07:30"};
const apri=async(senzaWorker)=>{
  const ctx=await b.newContext({locale:"it-IT",viewport:{width:390,height:844}});
  await ctx.addInitScript(([st,sw])=>{ if(sw) delete window.Worker; if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1"); localStorage.setItem("nt:state",JSON.stringify(st)); localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:firstPlanBannerChiuso","true"); localStorage.setItem("nt:attivazioneNascosta","true"); localStorage.setItem("nt:backupDone","true"); },[st,senzaWorker]);
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(1200); return p; };
const riga=p=>p.evaluate(()=>{ const r=document.querySelector('#essenziale [data-row="luce"]'); return r?r.innerText.replace(/\s+/g," "):""; });

let p=await apri(false);
const prima=await riga(p);
await p.waitForFunction(()=>{ try{ return !!JSON.parse(localStorage.getItem("nt:luceOttima")||"null"); }catch(e){ return false; } }, null, {timeout:30000});
await p.waitForTimeout(500);
const dopo=await riga(p);
ok(!/Luce forte \d\d:\d\d–\d\d:\d\d/.test(prima) && /Luce forte \d\d:\d\d–\d\d:\d\d/.test(dopo), "il Worker calcola e la riga passa alle ore ottimizzate → «"+dopo+"»");
await p.click('#essenziale [data-row="luce"]'); await p.waitForTimeout(400);
ok(/l'ottimizzatore dell'app/.test(await p.evaluate(()=>document.querySelector("#infoCorpo").textContent)), "il perché dice da dove vengono le ore");
await p.click("#infoChiudi"); await p.waitForTimeout(300);
await p.reload(); await p.waitForTimeout(1500);
ok(/Luce forte \d\d:\d\d–\d\d:\d\d/.test(await riga(p)), "riaprendo l'app il risultato c'è subito (ricordato per il giorno)");
// orari cambiati (pagina nuova con il vecchio risultato salvato): la chiave non torna, valgono le regole finché non arriva il ricalcolo
const vecchio=await p.evaluate(()=>localStorage.getItem("nt:luceOttima"));
await p.context().close();
{ const ctx=await b.newContext({locale:"it-IT",viewport:{width:390,height:844}});
  await ctx.addInitScript(([st,v])=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1"); localStorage.setItem("nt:state",JSON.stringify({...st, freeWake:"08:30"})); localStorage.setItem("nt:luceOttima", v);
    localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:firstPlanBannerChiuso","true"); localStorage.setItem("nt:attivazioneNascosta","true"); localStorage.setItem("nt:backupDone","true"); },[st,vecchio]);
  p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(1000);
  ok(!/Luce forte \d\d:\d\d–\d\d:\d\d/.test(await riga(p)), "orari cambiati: il vecchio risultato non vale più, intanto le regole");
  const k=JSON.parse(vecchio).chiave;
  await p.waitForFunction(v=>{ try{ return JSON.parse(localStorage.getItem("nt:luceOttima")).chiave!==v; }catch(e){ return false; } }, k, {timeout:30000});
  await p.waitForTimeout(400);
  ok(/Luce forte \d\d:\d\d–\d\d:\d\d|Luce bassa/.test(await riga(p)), "e l'ottimizzatore ricalcola da solo");
  await ctx.close(); }

p=await apri(true); await p.waitForTimeout(3500);
ok(!/Luce forte \d\d:\d\d–\d\d:\d\d/.test(await riga(p)) && !!(await riga(p)), "senza Worker: restano le regole, nessun errore");
await p.context().close();
console.log("errori", errs); ok(errs.length===0, "nessun errore di pagina"); await b.close();
