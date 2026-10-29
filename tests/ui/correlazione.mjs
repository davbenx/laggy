// «Il voto dopo le notti corte»: compare solo con un legame vero (almeno 14 giorni con voto, correlazione negativa oltre il caso);
// un legame contrario, debole o con pochi giorni non si dice mai (prima usciva anche «Curioso: il voto è più alto…» da semplice rumore).
import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
async function testo(n, votoCorta, votoLunga, casuale){
  const ctx=await b.newContext({locale:"it-IT",viewport:{width:390,height:844}});
  await ctx.addInitScript(([n,vc,vl,cas])=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
    const I=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
    const w={}, bd={}, dia={}; let seed=12345; const r=()=>{ seed=(seed*1664525+1013904223)%4294967296; return seed/4294967296; };
    for(let i=1;i<=n;i++){ const d=new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()-i); const k=I(d), corta=i%2===0;
      bd[k]=corta?"01:30":"23:30"; w[k]="07:30"; dia[k]= cas ? 1+Math.floor(r()*5) : (corta?vc:vl); }
    const st={turniConfigurati:true,pattern:"R",anchor:I(new Date()),shifts:{M:{n:"Mattino",s:420,e:840}},repeat:true,firstSeenAt:"2026-01-01",freeBed:"23:30",freeWake:"07:30",need:480};
    localStorage.setItem("nt:state",JSON.stringify(st)); localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:wakes",JSON.stringify(w)); localStorage.setItem("nt:beds",JSON.stringify(bd)); localStorage.setItem("nt:diary",JSON.stringify(dia));
    localStorage.setItem("nt:firstPlanBannerChiuso","true"); localStorage.setItem("nt:attivazioneNascosta","true"); },[n,votoCorta,votoLunga,casuale]);
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(1000);
  await p.evaluate(()=>document.querySelector('[data-tab="turni"]').click()); await p.waitForTimeout(250);
  await p.evaluate(()=>document.querySelector("#doAndamenti").click()); await p.waitForTimeout(400);
  const t=await p.evaluate(()=>document.querySelector("#andamenti").innerText); await ctx.close(); return t;
}
const vero=await testo(24, 2, 4, false);
ok(/Dopo le notti in cui dormi almeno 45 minuti meno del previsto, il tuo voto scende in media a 2,0 \(contro 4,0 dopo le altre\)/.test(vero), "un legame vero (notti corte → voto 2, le altre → 4, 24 giorni): la frase compare con i numeri giusti");
const contrario=await testo(24, 4, 2, false);
ok(!/Curioso|voto scende|Dopo le notti in cui/.test(contrario), "legame contrario (dopo le notti corte il voto è più alto): niente, nemmeno «Curioso»");
const pochi=await testo(10, 2, 4, false);
ok(!/Dopo le notti in cui/.test(pochi), "meno di 14 giorni con voto: niente");
let falsi=0; for(const n of [20,24,28]){ const t=await testo(n,0,0,true); if(/Dopo le notti in cui|Curioso/.test(t)) falsi++; }
ok(falsi===0, "voti casuali, scollegati dal sonno: nessuna frase (prima compariva circa una volta su tre) → "+falsi+" su 3");
console.log("errori", errs); await b.close();
