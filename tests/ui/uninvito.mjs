// Un invito alla volta per canale in Oggi (in alto ciò che va fatto, in fondo una cosa da scoprire): al primo giorno
// il banner del piano pronto, la lista «Rendi automatico» e l'invito a dire i tuoi orari vorrebbero comparire insieme.
import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const ALTO=["#firstPlanBanner","#setupChecklist","#adattaCard","#medicoCard","#setupNudge"], FONDO=["#loSapevi","#essenziale .essnudge"];
const apri=async(extra)=>{
  const ctx=await b.newContext({locale:"it-IT",viewport:{width:390,height:844}});
  await ctx.addInitScript(([x])=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
    const d=new Date(), I=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
    localStorage.setItem("nt:state",JSON.stringify({turniConfigurati:true,pattern:"MPNSRR",anchor:I,repeat:true,firstSeenAt:I}));
    localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:novitaViste",JSON.stringify("2099"));
    for(const k in x) localStorage.setItem(k,x[k]); }, [extra||{}]);
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(1500); return p;
};
const vis=(p,S)=>p.evaluate(S=>S.filter(s=>{ const e=document.querySelector(s); return e && e.offsetParent!==null; }), S);
const visibili=async p=>{ const a=await vis(p,ALTO), f=await vis(p,FONDO); return {a,f,ok:a.length<=1&&f.length<=1}; };
{ const p=await apri(); const v=await visibili(p);
  ok(v.ok && v.a.length===1, "primo giorno: un invito in alto e al più uno in fondo → "+v.a.concat(v.f).join(", "));
  const corn=await p.evaluate(()=>{ const e=document.querySelector(".cornice"); return e && e.offsetParent!==null ? e.textContent : ""; });
  ok(/spunti, non regole/i.test(corn), "in fondo a Oggi la cornice: spunti, non regole");
  await p.context().close(); }
{ const p=await apri({"nt:firstPlanBannerChiuso":"true"}); const v=await visibili(p);
  ok(v.ok, "chiuso il banner, ancora al più uno per canale → "+v.a.concat(v.f).join(", "));
  await p.context().close(); }
console.log("errori", errs); ok(errs.length===0, "nessun errore di pagina"); await b.close();
