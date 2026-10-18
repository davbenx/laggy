// L'app vera con 13 cicli × 4 orari (anche il cambio d'ora) × ripetuti/non ripetuti:
// niente errori, schermate vuote o testi rotti. Uso: un server su :8765 (vedi
// tests/ui/run.sh), poi node tests/verifica/app.mjs.
import pw from "../ui/_pw.mjs";
const T={A:{n:"Alba",s:300,e:780},M:{n:"Mattino",s:360,e:840},D:{n:"Giorno 12h",s:420,e:1140},P:{n:"Pomeriggio",s:840,e:1320},X:{n:"Sera tardi",s:1140,e:1500},N:{n:"Notte",s:1320,e:1860},K:{n:"Notte 12h",s:1140,e:1860},Z:{n:"Notte fonda",s:0,e:480},G:{n:"24 ore",s:480,e:1920}};
const pats=["MPNSR","MMPPNNSRR","DDNNSRRR","NNNNNNNRRRRRRR","PMRRRRR","PZRRRRR","XMRRRR","GRRR","KKKSRRRR","ZZZZZRR","AAMMPPRR","DKSRR","MMMMMRRPPPPPRRNNNNNRRRRR"];
const b=await pw.chromium.launch(); const probs=[];
for(const ora of ["2026-10-18T10:00:00","2026-10-25T02:30:00","2026-10-25T16:00:00","2026-10-18T03:00:00"]) for(const pat of pats) for(const rep of [true,false]){
  const ctx=await b.newContext({locale:"it-IT",timezoneId:"Europe/Rome",viewport:{width:360,height:740}});
  await ctx.addInitScript(([pat,rep,sh,ora])=>{ const t0=new Date(ora).getTime(), d0=Date.now(); const RD=Date;
    class FD extends RD{ constructor(...a){ if(a.length) super(...a); else super(t0+(RD.now()-d0)); } static now(){ return t0+(RD.now()-d0); } }
    window.Date=FD;
    localStorage.setItem("nt:state", JSON.stringify({turniConfigurati:true,pattern:pat,anchor:ora.slice(0,10),shifts:sh,repeat:rep,firstSeenAt:"2026-10-01"}));
    localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:firstPlanBannerChiuso","true"); }, [pat,rep,T,ora]);
  const p=await ctx.newPage(); const errs=[]; p.on("pageerror",e=>errs.push(e.message)); p.on("console",m=>{ if(m.type()==="error" && !/404|Failed to load/.test(m.text())) errs.push(m.text()); });
  await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(1200);
  const r=await p.evaluate(()=>{ const t=document.body.innerText; return { nan:/NaN|undefined|Invalid Date|null:null/.test(t), ess:!!document.querySelector("#essenziale")&&document.querySelector("#essenziale").innerText.length>20 }; });
  await p.evaluate(()=>document.querySelector('[data-tab="turni"]').click()); await p.waitForTimeout(400);
  const r2=await p.evaluate(()=>({ righe:document.querySelectorAll("#cyc .crow").length, nan:/NaN|undefined|Invalid Date/.test(document.body.innerText) }));
  const pdf=await p.evaluate(()=>{ try{ document.querySelector("#doPrint").click(); return /NaN|undefined/.test(document.querySelector("#printSheet").innerText) ? "testo rotto" : "ok"; }catch(e){ return "errore "+e.message; } });
  if(errs.length||r.nan||!r.ess||r2.nan||r2.righe<5||pdf!=="ok") probs.push(ora+" "+pat+(rep?"":" non-ripete")+" → "+JSON.stringify({errs:errs.slice(0,2),r,r2,pdf}));
  await ctx.close();
}
console.log("casi", 4*pats.length*2, "problemi", probs.length); console.log(probs.slice(0,15).join("\n")); await b.close();
