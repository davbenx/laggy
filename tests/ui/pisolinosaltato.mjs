// Pisolino saltato ieri: dopo un sonno lungo non chiede recupero; dopo un sonno corto il piano lo dice e spiega perché.
import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const fa=n=>{ const d=new Date(); d.setDate(d.getDate()-n); return iso(d); };
async function apri(wake){
  const ctx=await b.newContext({locale:"it-IT",viewport:{width:360,height:740}});
  const st={turniConfigurati:true,pattern:"PRRMMRR",anchor:fa(0),shifts:{P:{n:"Pomeriggio",s:840,e:1260},M:{n:"Mattino",s:420,e:840}},repeat:true,
    firstSeenAt:fa(20),freeBed:"00:30",freeWake:"08:30",beds:{[fa(0)]:"00:30"},wakes:{[fa(0)]:wake},pisolini:{[fa(1)]:{"15:00":{no:true,min:90}}}};
  await ctx.addInitScript(st=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
    localStorage.setItem("nt:state",JSON.stringify(st)); for(const k of ["turniConfigurati","firstPlanBannerChiuso","attivazioneNascosta","backupDone","novitaProva"]) localStorage.setItem("nt:"+k,"true");
    localStorage.setItem("nt:novitaViste",JSON.stringify("2099-01-01")); }, st);
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(4600);
  return p;
}
{ const p=await apri("10:30");
  const m=await p.evaluate(()=>{ const t=document.body.innerText, i=t.search(/pisolino di recupero/i); return i<0?"":t.slice(Math.max(0,i-80),i+60); });
  ok(!m, "10 ore di sonno: nessun pisolino di recupero");
  await p.context().close(); }
{ const p=await apri("08:30");
  const t=await p.evaluate(()=>(document.querySelector(".drem-rec")||{}).textContent||"");
  ok(/ieri hai saltato un pisolino/i.test(t) && /ti chiedo se l'hai fatto/.test(t), "sonno corto: il piano dice che ha aggiunto il pisolino e perché → "+t.slice(0,150));
  await p.context().close(); }
console.log("errori",errs); ok(errs.length===0,"nessun errore di pagina"); await b.close();
