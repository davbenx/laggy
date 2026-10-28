// Subito dopo la sveglia (dopo una notte di 7 ore) l'avviso «Rischio fatica alto» non c'è: è il fondo del ritmo del mattino
// e l'inerzia del sonno, non stanchezza. Resta per chi è sveglio da molto.
import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const apri=async(ora, svegliato)=>{
  const t=new Date(); t.setHours(ora[0],ora[1],0,0);
  const ctx=await b.newContext({locale:"it-IT",viewport:{width:390,height:844}});
  await ctx.clock.install({time:t});
  await ctx.addInitScript(([a,w])=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
    const f=new Date(a+"T12:00:00"); f.setDate(f.getDate()-30);
    const I=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
    localStorage.setItem("nt:state",JSON.stringify({turniConfigurati:true,pattern:"GGGGGRR",anchor:a,shifts:{G:{n:"Giornata",s:540,e:1020}},repeat:true,firstSeenAt:I(f),freeBed:"02:00",freeWake:"10:00"}));
    localStorage.setItem("nt:wakes",JSON.stringify({[a]:w})); localStorage.setItem("nt:beds",JSON.stringify({[a]:"00:00"}));
    localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:firstPlanBannerChiuso","true"); localStorage.setItem("nt:attivazioneNascosta","true"); localStorage.setItem("nt:novitaViste",JSON.stringify("2099")); }, [iso(t), svegliato]);
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.goto("http://localhost:8765/index.html"); await p.clock.runFor(2500); return p;
};
const ora=p=>p.evaluate(()=>document.querySelector("#ora").innerText.replace(/\s+/g," "));
{ const p=await apri([7,16],"07:00"); const t=await ora(p);
  ok(!/Rischio fatica/.test(t), "7:16, sveglio alle 7:00 dopo 7 ore di sonno: niente «Rischio fatica» → "+t.slice(0,90)); await p.context().close(); }
// «Come ti senti?» si chiede da 90 minuti dopo la sveglia: l'inerzia del sonno falsa il voto
const facce=p=>p.evaluate(()=>({n:document.querySelectorAll("#essenziale .drem [data-diary]").length, presto:!!document.querySelector("#essenziale .drem [data-voto-presto]"), testo:(document.querySelector("#essenziale .drem [data-voto-presto]")||{}).textContent||""}));
{ const p=await apri([7,16],"07:00"); const f=await facce(p);
  ok(f.n===0 && f.presto && /alle 08:30/.test(f.testo), "7:16, sveglio alle 7:00: le facce non ci sono, dice quando → "+f.testo.slice(0,100)); await p.context().close(); }
{ const p=await apri([8,40],"07:00"); const f=await facce(p);
  ok(f.n===5 && !f.presto, "8:40, 100 minuti dopo la sveglia: le cinque facce ci sono"); await p.context().close(); }
console.log("errori", errs); ok(errs.length===0, "nessun errore di pagina"); await b.close();
