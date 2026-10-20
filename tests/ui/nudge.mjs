// Due canali: in alto solo ciò che va fatto adesso (banner del primo piano,
// lista di attivazione…), in fondo «Lo sapevi?» per scoprire qualcosa. Un
// consiglio alla volta; chiuso, niente altro fino a domani. Chi aveva chiuso
// un vecchio invito non lo rivede. Le statistiche: sì o no, senza ×.
import pw from "./_pw.mjs";
const ok=(c,m)=>{ console.log((c?"✔ ":"✘ ")+m); };
const b=await pw.chromium.launch(); const errs=[];
const ALTO=["firstPlanBanner","setupChecklist","adattaCard","medicoCard","setupNudge","backupNudge"];
const visibili = p => p.evaluate(ids=>ids.filter(id=>{ const e=document.getElementById(id); return e && !e.hidden && e.offsetParent!==null; }), ALTO);
const consiglio = p => p.evaluate(()=>{ const e=document.querySelector("#loSapevi"); return e && !e.hidden ? e.dataset.k : ""; });
// giorno 1, ciclo appena impostato
let ctx=await b.newContext({locale:"it-IT"}); let p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(800);
await p.click("text=Conosco già il mio schema"); await p.click("[data-preset-ob='0']"); await p.click("[data-pos='0']"); await p.click("#qhConfermaOrari"); await p.waitForTimeout(500);
ok(JSON.stringify(await visibili(p))==='["firstPlanBanner"]' && !(await consiglio(p)), "giorno 1: solo il banner del primo piano → "+JSON.stringify(await visibili(p)));
await p.click("#doChiudiPrimoPiano"); await p.waitForTimeout(300);
ok(JSON.stringify(await visibili(p))==='["setupChecklist"]' && !(await consiglio(p)), "giorno 1, chiuso il banner: solo la lista di attivazione, nessun consiglio");
const stato = await p.evaluate(()=>localStorage.getItem("nt:state"));
await ctx.close();
const giorno=async(n, extra={}, mod=null)=>{
  const c=await b.newContext({locale:"it-IT"}); const q=await c.newPage(); q.on("pageerror",e=>errs.push(e.message));
  await c.addInitScript(([s,n,extra,mod])=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
    const st=JSON.parse(s); const d=new Date(); d.setDate(d.getDate()-n); st.firstSeenAt=d.toISOString().slice(0,10); Object.assign(st, mod||{});
    localStorage.setItem("nt:state",JSON.stringify(st)); localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:firstPlanBannerChiuso","true");
    localStorage.setItem("nt:attivazioneDal", JSON.stringify(st.firstSeenAt));
    for(const k in extra) localStorage.setItem("nt:"+k, JSON.stringify(extra[k])); }, [stato, n, extra, mod]);
  await q.goto("http://localhost:8765/index.html"); await q.waitForTimeout(900);
  return q;
};
// giorno 5: le statistiche si chiedono come consiglio, con sì e no e senza ×
p=await giorno(5);
ok(await consiglio(p)==="statistiche" && await p.evaluate(()=>!document.querySelector("#loSapevi .x") && !!document.querySelector("[data-sapevi-si]")), "giorno 5: in fondo la domanda sulle statistiche, sì o no, senza ×");
ok((await visibili(p)).length<=1, "in alto al massimo una cosa: "+JSON.stringify(await visibili(p)));
await p.click("[data-sapevi-si]"); await p.waitForTimeout(300);
ok(await p.evaluate(()=>localStorage.getItem("nt:analytics-consent")==="true") && !(await consiglio(p)), "«Sì» accende le statistiche, e oggi nessun altro consiglio");
await p.reload(); await p.waitForTimeout(900);
ok(!(await consiglio(p)), "anche riaprendo l'app, oggi niente altro");
await p.context().close();
// chi aveva chiuso il vecchio invito a condividere: niente «colleghi»
p=await giorno(10, {"analytics-consent":false}, {shareNudgeOff:true, icsNudgeOff:true});
const k=await consiglio(p);
ok(k && k!=="colleghi" && k!=="calendario", "vecchi inviti chiusi (condividi, calendario) non tornano come consigli → «"+k+"»");
await p.waitForTimeout(4500);   // dopo il salvataggio i vecchi indicatori spariscono, la memoria resta
const S=await p.evaluate(()=>({sa:JSON.parse(localStorage.getItem("nt:loSapevi")), st:JSON.parse(localStorage.getItem("nt:state"))}));
ok(S.sa.visti.includes("colleghi") && S.sa.visti.includes("calendario") && S.st.shareNudgeOff===undefined, "ricordati in «Lo sapevi?», tolti dallo stato: "+JSON.stringify(S.sa.visti));
await p.context().close();
// il grazie: dopo un mese, con i link (niente pulsante «Prova»)
p=await giorno(40, {"analytics-consent":false, funzioniUsate:{mese:1,calendario:1,ferie:1,scambio:1,sonno:1}}, {people:[{name:"A",pattern:"MMRR",anchor:"2026-01-01"}]});
const g=await p.evaluate(()=>{ const e=document.querySelector("#loSapevi"); return {k:e.dataset.k, h:e.hidden, link:[...e.querySelectorAll("[data-sapevi-link]")].map(a=>a.href)}; });
ok(!g.h && g.k==="grazie" && g.link.some(h=>/notturnisti\.club/.test(h)), "dopo un mese: il grazie, con le guide su notturnisti.club → "+JSON.stringify(g));
await p.context().close();
console.log("errori", errs); await b.close();
