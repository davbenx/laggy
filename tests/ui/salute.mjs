// Health Connect nell'app (plugin simulato): ogni tipo si accende da solo e chiede solo il suo permesso; il sonno letto
// propone gli orari nel diario; spegnendo, i dati letti si dimenticano; un permesso negato lascia spento; un permesso
// tolto da Android si nota al ritorno nell'app. Sul sito il riquadro non c'è.
import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const st={turniConfigurati:true,pattern:"R",anchor:iso(new Date()),shifts:{},repeat:true,firstSeenAt:"2026-01-01",freeBed:"23:30",freeWake:"07:30"};
async function apri(nativo, nega){
  const ctx=await b.newContext({locale:"it-IT",viewport:{width:390,height:844}});
  await ctx.addInitScript(([st,nativo,nega])=>{
    if(nativo){
      const L={}; window.__resume=[]; window.__chiesti=[];
      const oggi=new Date(); oggi.setHours(6,50,0,0); const fine=oggi.getTime(), inizio=fine-(7*60+10)*60000;   // 23:40 → 06:50
      window.__hc={sonno:false, passi:false};
      window.Capacitor={isNativePlatform:()=>true,getPlatform:()=>"android",Plugins:{
        App:{getLaunchUrl:async()=>({}),addListener:(ev,cb)=>{ if(ev==="resume") window.__resume.push(cb); return Promise.resolve({remove(){}}); },minimizeApp:async()=>{}},
        LocalNotifications:{checkPermissions:async()=>({display:"granted"}),requestPermissions:async()=>({display:"granted"}),getPending:async()=>({notifications:[]}),schedule:async()=>({}),cancel:async()=>({}),createChannel:async()=>({}),addListener:()=>Promise.resolve({remove(){}})},
        SystemBars:{setStyle:async()=>{}},
        NTSalute:{
          stato:async()=>({stato:"ok", sonno:window.__hc.sonno, passi:window.__hc.passi}),
          chiedi:async(o)=>{ window.__chiesti.push(o.tipi.join(",")); if(!nega) o.tipi.forEach(t=>window.__hc[t]=true); return {sonno:window.__hc.sonno, passi:window.__hc.passi}; },
          sonno:async()=>({sessioni:[{inizio, fine, fonte:"com.test.orologio"}]}),
          passi:async()=>({blocchi:[{t:fine+3600000, n:420}]}),
          apri:async()=>{ window.__aperto=true; }
        }}};
    }
    if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
    localStorage.setItem("nt:state",JSON.stringify(st)); localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:firstPlanBannerChiuso","true"); localStorage.setItem("nt:attivazioneNascosta","true"); localStorage.setItem("nt:backupDone","true");
  },[st,nativo,nega]);
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.goto(nativo ? "http://localhost:8766/index.html" : "http://localhost:8765/index.html"); await p.waitForTimeout(3000);
  return p;
}
const box=p=>p.evaluate(()=>{ const x=document.querySelector("#saluteBox"); return x ? {hidden:x.hidden, sonno:document.querySelector("#hcSonno").checked, passi:document.querySelector("#hcPassi").checked, nota:document.querySelector("#hcNota").textContent} : null; });
const accendi=(p,id,v)=>p.evaluate(([id,v])=>{ const i=document.querySelector(id); i.checked=v; i.dispatchEvent(new Event("change",{bubbles:true})); },[id,v]);
const salvato=(p,k)=>p.evaluate(k=>JSON.parse(localStorage.getItem("nt:"+k)||"null"),k);

let p=await apri(false);
ok((await box(p)).hidden, "sul sito il riquadro di Health Connect non c'è");
await p.context().close();

p=await apri(true);
let s=await box(p);
ok(s && !s.hidden && !s.sonno && !s.passi && (await p.evaluate(()=>window.__chiesti.length))===0, "nell'app: il riquadro c'è, tutto spento, nessun permesso chiesto da solo");
await accendi(p,"#hcSonno",true); await p.waitForTimeout(800);
ok((await p.evaluate(()=>window.__chiesti))[0]==="sonno", "accendere «Sonno» chiede solo il permesso del sonno");
const hs=await salvato(p,"hcSonno"), stt=await salvato(p,"state");
ok(Array.isArray(hs) && hs.length===1 && stt.salute && stt.salute.sonno===true && !stt.salute.passi, "il sonno letto è salvato sul telefono, e la scelta resta");
await p.evaluate(()=>document.querySelector('[data-tab="oggi"]').click()); await p.waitForTimeout(500);
const d=await p.evaluate(()=>{ const x=document.querySelector("#essenziale .drem .dq"); return x ? x.innerText.replace(/\s+/g," ") : ""; });
ok(/Hai dormito 23:40 → 06:50\? da Health Connect/.test(d), "il diario propone gli orari letti, e dice da dove vengono → «"+d+"»");
await accendi(p,"#hcPassi",true); await p.waitForTimeout(800);
ok((await p.evaluate(()=>window.__chiesti))[1]==="passi" && (await salvato(p,"hcPassi")).length===1, "«Passi» chiede il suo permesso, a parte, e legge i passi");
await accendi(p,"#hcSonno",false); await p.waitForTimeout(500);
ok((await salvato(p,"hcSonno")).length===0 && /dimenticati/.test((await box(p)).nota), "spento «Sonno»: i dati letti si dimenticano, e lo dice");
// permesso tolto da Android: al ritorno nell'app l'interruttore si spegne e i dati si dimenticano
await p.evaluate(()=>{ window.__hc.passi=false; window.__resume.forEach(cb=>cb()); }); await p.waitForTimeout(800);
ok(!(await box(p)).passi && (await salvato(p,"hcPassi")).length===0 && !(await salvato(p,"state")).salute.passi, "permesso tolto da Android: al ritorno l'interruttore è spento e i passi dimenticati");
await p.context().close();

p=await apri(true, true);
await accendi(p,"#hcSonno",true); await p.waitForTimeout(800);
s=await box(p);
ok(!s.sonno && /non concesso/.test(s.nota) && !(await salvato(p,"state")).salute?.sonno, "permesso negato: resta spento, con una frase su come darlo dopo");
await p.context().close();
console.log("errori", errs); ok(errs.length===0, "nessun errore di pagina"); await b.close();
