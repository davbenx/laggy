// «Lo sapevi?» per le funzioni nuove: ognuna solo a chi può servire, e il bottone porta dove si accende.
import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const oggi=iso(new Date()), fa=n=>{ const d=new Date(); d.setDate(d.getDate()-n); return iso(d); };
const SH={M:{n:"Mattino",s:360,e:840},N:{n:"Notte",s:1320,e:1800}};
const apri=async(st, k)=>{
  const ctx=await b.newContext({locale:"it-IT",viewport:{width:390,height:844}});
  await ctx.addInitScript(([st,k,oggi])=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
    localStorage.setItem("nt:state",JSON.stringify(st)); localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:firstPlanBannerChiuso","true");
    localStorage.setItem("nt:attivazioneNascosta","true"); localStorage.setItem("nt:novitaViste",JSON.stringify("2099")); localStorage.setItem("nt:backupDone","true");
    localStorage.setItem("nt:loSapevi",JSON.stringify({oggi:{d:oggi,k}})); },[st,k,oggi]);
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(1200); return p;
};
const tip=p=>p.evaluate(()=>{ const e=document.querySelector("#loSapevi"); return e && !e.hidden ? e.dataset.k+": "+e.textContent : ""; });
const BASE={turniConfigurati:true,pattern:"MMNNRR",anchor:fa(3),shifts:SH,repeat:true,firstSeenAt:fa(40),freeBed:"23:30",freeWake:"07:30"};
// figli a scuola: solo a chi segue già qualcuno
let p=await apri({...BASE, people:[{name:"Anna",pattern:"MMRR",anchor:fa(1)}]}, "scuola");
let t=await tip(p); ok(/^scuola:.*scuola o all'asilo/.test(t), "con una persona: «Hai figli a scuola o all'asilo?» → "+t.slice(0,60));
await p.click("#loSapevi [data-sapevi-prova]"); await p.waitForTimeout(500);
ok(await p.evaluate(()=>{ const x=document.querySelector('[data-pvia="scuola"]'); return !!x && x.offsetParent!==null; }), "«Aggiungi» apre Persone con la scelta «Va a scuola o all'asilo»");
await p.context().close();
p=await apri({...BASE}, "scuola"); ok(!/^scuola/.test(await tip(p)), "senza persone: niente (c'è già l'invito ad aggiungere qualcuno)"); await p.context().close();
// guida per lavoro
p=await apri({...BASE}, "guida"); t=await tip(p); ok(/^guida:.*pause di guida/.test(t), "guida per lavoro → "+t.slice(0,50));
await p.click("#loSapevi [data-sapevi-prova]"); await p.waitForTimeout(600);
ok(await p.evaluate(()=>{ const x=document.querySelector("#guidaL"); return !!x && x.closest("label").offsetParent!==null; }), "«Accendi» porta all'interruttore «Guidi per lavoro»");
await p.context().close();
p=await apri({...BASE, guidaLavoro:true}, "guida"); ok(!/^guida/.test(await tip(p)), "già acceso: niente"); await p.context().close();
// piano essenziale
p=await apri({...BASE}, "essenziale"); t=await tip(p); ok(/^essenziale:.*Piano essenziale/.test(t), "piano essenziale → "+t.slice(0,50));
await p.click("#loSapevi [data-sapevi-prova]"); await p.waitForTimeout(500);
ok(await p.evaluate(()=>{ const x=document.querySelector("#pv-_essenziale"); return !!x && x.closest("label").offsetParent!==null; }), "«Scegli cosa vedere» apre Cosa vedi nel piano");
await p.context().close();
// copia una settimana: solo con turni che cambiano
p=await apri({...BASE}, "settimana"); ok(!/^settimana/.test(await tip(p)), "ciclo fisso senza cambi: niente"); await p.context().close();
p=await apri({...BASE, pattern:"R", anchor:"2000-01-01", repeat:false, ecc:{[oggi]:"M"}}, "settimana"); t=await tip(p); ok(/^settimana:.*Copia una settimana/.test(t), "turni che cambiano → "+t.slice(0,50)); await p.context().close();
// Health Connect: solo nell'app Android che lo ha (sul web niente)
p=await apri({...BASE}, "salute"); ok(!/^salute/.test(await tip(p)), "sul web: niente Health Connect"); await p.context().close();
console.log("errori", errs); ok(errs.length===0, "nessun errore di pagina"); await b.close();
