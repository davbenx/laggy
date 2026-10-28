// «Il piano si adatta a te» non propone come orario dei giorni liberi un sonno molto più corto del tuo bisogno:
// notti di 5 ore non sono una preferenza da adottare. Con un sonno vero (8 ore) la proposta resta.
import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const oggi=new Date(); oggi.setHours(12,0,0,0);
const ST={turniConfigurati:true,pattern:"RRRRRRR",anchor:iso(oggi),shifts:{M:{n:"Mattino",s:360,e:840}},repeat:true,firstSeenAt:"2026-01-01",freeBed:"00:30",freeWake:"08:45",need:495};
async function prova(sveglia){
  const ctx=await b.newContext({locale:"it-IT",viewport:{width:390,height:844}});
  await ctx.addInitScript(([st,sv])=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
    const w={}, bd={}; for(let i=1;i<=30;i++){ const d=new Date(); d.setDate(d.getDate()-i); const k=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); w[k]=sv; bd[k]="00:30"; }
    localStorage.setItem("nt:state",JSON.stringify(st)); localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:wakes",JSON.stringify(w)); localStorage.setItem("nt:beds",JSON.stringify(bd));
    localStorage.setItem("nt:invitoVisto","\"2000-01-01\""); localStorage.setItem("nt:firstPlanBannerChiuso","true"); localStorage.setItem("nt:attivazioneNascosta","true"); },[ST,sveglia]);
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(1500);
  const r=await p.evaluate(()=>{ const c=document.querySelector("#adattaCard"); return c && !c.hidden ? c.innerText.replace(/\n+/g," | ") : null; });
  await ctx.close(); return r;
}
const corta=await prova("05:45"), vera=await prova("08:00");
ok(!(corta && /dormi/.test(corta)), "notti di 5 ore e 15: nessuna proposta di adottarle ("+corta+")");
ok(!!vera && /dormi/.test(vera), "con 7 ore e mezza di sonno la proposta c'è → "+vera);
console.log("errori", errs); await b.close();
