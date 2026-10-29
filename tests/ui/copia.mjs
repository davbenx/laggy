// Copia completa su file: contiene turni e diario; si riapre da «Ripristina da un file» (con conferma) e ritrova tutto.
import pw from "./_pw.mjs";
import { writeFileSync, mkdtempSync, readFileSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const oggi=new Date(); oggi.setHours(12,0,0,0);
const ST={turniConfigurati:true,pattern:"MMPPNNRR",anchor:iso(oggi),shifts:{M:{n:"Mattino",s:360,e:840},P:{n:"Pomeriggio",s:840,e:1320},N:{n:"Notte",s:1320,e:1800}},repeat:true,firstSeenAt:"2026-01-01",freeBed:"23:30",freeWake:"07:30",festivi:{extra:["3-9"]},piano:{quando:{intensa:"mattina"}}};
const tmp=mkdtempSync(join(tmpdir(),"nt-"));
async function pagina(extra){
  const ctx=await b.newContext({locale:"it-IT",viewport:{width:390,height:844},acceptDownloads:true});
  await ctx.addInitScript(([st,ex])=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1"); if(st){ localStorage.setItem("nt:state",JSON.stringify(st)); localStorage.setItem("nt:turniConfigurati","true"); for(const k in ex) localStorage.setItem("nt:"+k,JSON.stringify(ex[k])); }
    localStorage.setItem("nt:firstPlanBannerChiuso","true"); localStorage.setItem("nt:attivazioneNascosta","true"); },[extra?ST:null, extra||{}]);
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(900);
  return [p,ctx];
}
const [p,ctx]=await pagina({diary:{"2026-10-01":4,"2026-10-02":2}, wakes:{"2026-10-01":"07:10"}, beds:{"2026-10-01":"23:40"}});
await p.click("#doOpzioni"); await p.waitForTimeout(300); await p.click('[data-opzg-vai="dati"]'); await p.waitForTimeout(250);
ok(await p.evaluate(()=>["doCopiaFile","doRipristina","doLink"].every(i=>{ const e=document.getElementById(i); return e && !e.hidden && e.offsetParent!==null; })), "tre azioni: copia completa, ripristina, link per un altro telefono");
const [dl]=await Promise.all([p.waitForEvent("download"), p.click("#doCopiaFile")]);
const file=join(tmp,"copia.json"); await dl.saveAs(file);
const R=JSON.parse(readFileSync(file,"utf8"));
ok(R.app==="notturnisti" && R.v===1 && R.dati.state.pattern==="MMPPNNRR" && R.dati.diary["2026-10-02"]===2 && R.dati.wakes["2026-10-01"]==="07:10" && R.dati.state.festivi.extra[0]==="3-9" && R.dati.state.piano.quando.intensa==="mattina", "il file ha turni, diario, sveglie, festivi e preferenze");
ok(!("dispositivo" in R.dati) && !("analytics-consent" in R.dati), "niente che dipenda dal dispositivo o dalle statistiche");
ok(await p.evaluate(()=>/Ultima copia/.test(document.querySelector("#copiaFileSub").textContent)), "dopo il salvataggio dice quando è l'ultima copia");
await ctx.close();
// telefono nuovo: vuoto, si ripristina dal file (con conferma)
{ const [q,c2]=await pagina(null);
  q.on("dialog",d=>d.accept());
  await q.evaluate(()=>{ const d=document.querySelector("body > [role=dialog] [data-x]"); d&&d.click(); });
  await q.evaluate(()=>document.querySelector('[data-tab="opzioni"]') && document.querySelector('[data-tab="opzioni"]').click());
  await q.evaluate(()=>{ const i=document.querySelector("#doOpzioni"); i&&i.click(); }); await q.waitForTimeout(300);
  await q.evaluate(()=>{ const g=document.querySelector('[data-opzg-vai="dati"]'); g&&g.click(); }); await q.waitForTimeout(250);
  await q.setInputFiles("#copiaFile", file); await q.waitForTimeout(1500);
  const s=await q.evaluate(()=>({st:JSON.parse(localStorage.getItem("nt:state")), d:JSON.parse(localStorage.getItem("nt:diary")), conf:localStorage.getItem("nt:turniConfigurati")}));
  ok(s.st && s.st.pattern==="MMPPNNRR" && s.d["2026-10-02"]===2 && s.conf==="true", "ripristino: turni e diario tornano come nella copia");
  await c2.close(); }
// file sbagliati
{ const [q,c2]=await pagina({}); let msg="";
  q.on("dialog",d=>{ msg=d.message(); d.dismiss(); });
  await q.evaluate(()=>document.querySelector("#doOpzioni").click()); await q.waitForTimeout(300); await q.evaluate(()=>document.querySelector('[data-opzg-vai="dati"]').click()); await q.waitForTimeout(250);
  const prima=await q.evaluate(()=>localStorage.getItem("nt:state"));
  writeFileSync(join(tmp,"x.json"),'{"ciao":1}'); await q.setInputFiles("#copiaFile", join(tmp,"x.json")); await q.waitForTimeout(500);
  ok(await q.evaluate(()=>/non è una copia/.test(document.querySelector("#toast").textContent)) && !msg, "un file che non è una copia: avviso, nessuna conferma, niente cambia");
  await q.setInputFiles("#copiaFile", file); await q.waitForTimeout(500);
  ok(/Sostituisco i dati/.test(msg) && await q.evaluate(p=>localStorage.getItem("nt:state")===p, prima), "una copia vera chiede conferma; se rifiuti non cambia nulla");
  await c2.close(); }
// il link di backup porta anche «da quando usi l'app»: su un telefono nuovo non si diventa «nuovi» (vale la data più vecchia)
{ const ctx=await b.newContext({locale:"it-IT",viewport:{width:390,height:844}});
  await ctx.addInitScript(([st])=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1"); localStorage.setItem("nt:state",JSON.stringify(st)); localStorage.setItem("nt:turniConfigurati","true");
    localStorage.setItem("nt:firstPlanBannerChiuso","true"); localStorage.setItem("nt:attivazioneNascosta","true"); window.__sh=[]; navigator.share=async o=>{ window.__sh.push(o); }; },[{...ST,firstSeenAt:"2026-03-15"}]);
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(900);
  await p.click("#doOpzioni"); await p.waitForTimeout(300); await p.click('[data-opzg-vai="dati"]'); await p.waitForTimeout(250);
  await p.click("#doLink"); await p.waitForTimeout(400);
  const url=await p.evaluate(()=>(window.__sh[0]||{}).url||"");
  ok(/[#&]fs=2026-03-15\b/.test(url), "il link di backup contiene la data del primo uso");
  await ctx.close();
  const c2=await b.newContext({locale:"it-IT",viewport:{width:390,height:844}});
  const q=await c2.newPage(); q.on("pageerror",e=>errs.push(e.message));
  await q.goto("http://localhost:8765/index.html"+url.slice(url.indexOf("#"))); await q.waitForTimeout(1200);
  const fs=await q.evaluate(()=>JSON.parse(localStorage.getItem("nt:state")||"{}").firstSeenAt);
  ok(fs==="2026-03-15", "aprendo il link su un telefono nuovo, la data di primo uso torna quella vecchia → "+fs);
  await c2.close(); }
console.log("errori", errs); await b.close();
