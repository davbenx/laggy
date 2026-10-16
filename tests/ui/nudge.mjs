import pw from "./_pw.mjs";
const ok=(c,m)=>{ console.log((c?"✔ ":"✘ ")+m); };
const b=await pw.chromium.launch();
const visibili = p => p.evaluate(()=>["firstPlanBanner","setupChecklist","backupNudge","installBanner","shareNudge","icsNudge","icsExpireNudge","statsNudge","clubBanner","donateNudge"].filter(id=>{ const e=document.getElementById(id); return e && !e.hidden && getComputedStyle(e).display!=="none"; }));
// giorno 1, ciclo appena impostato
let ctx=await b.newContext({locale:"it-IT"}); let p=await ctx.newPage(); const errs=[]; p.on("pageerror",e=>errs.push(e.message));
await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(800);
await p.click("text=Conosco già il mio schema"); await p.click("[data-preset-ob='0']"); await p.click("[data-pos='0']"); await p.click("#qhConfermaOrari"); await p.waitForTimeout(500);
ok(JSON.stringify(await visibili(p))==='["firstPlanBanner"]', "giorno 1: solo il banner del primo piano → "+JSON.stringify(await visibili(p)));
await p.click("#doChiudiPrimoPiano"); await p.waitForTimeout(300);
ok(JSON.stringify(await visibili(p))==='["setupChecklist"]', "giorno 1, chiuso il banner: solo la lista di attivazione → "+JSON.stringify(await visibili(p)));
// giorno 5: un invito, chiuso → nient'altro fino a domani
const stato = await p.evaluate(()=>localStorage.getItem("nt:state"));
ctx=await b.newContext({locale:"it-IT"}); p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
await ctx.addInitScript(s=>{ if(!localStorage.getItem("nt:state")){ const st=JSON.parse(s); const d=new Date(); d.setDate(d.getDate()-5); st.firstSeenAt=d.toISOString().slice(0,10); localStorage.setItem("nt:state",JSON.stringify(st)); localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:firstPlanBannerChiuso","true"); } }, stato);
await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(800);
const v1=await visibili(p);
ok(v1.length===1, "giorno 5: un invito alla volta → "+JSON.stringify(v1));
await p.evaluate(id=>{ const x=document.querySelector(id==="setupChecklist"?"#nascondiAttivazione":"#"+id+" button"); x && x.click(); }, v1[0]); await p.waitForTimeout(300);
ok((await visibili(p)).length===0, "giorno 5, chiuso '"+v1[0]+"': gli altri aspettano domani → "+JSON.stringify(await visibili(p)));
await p.reload(); await p.waitForTimeout(800);
ok((await visibili(p)).length===0, "anche dopo aver riaperto l'app, oggi nessun altro invito");
console.log("errori", errs); await b.close();
