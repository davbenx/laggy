// Due turni con lo stesso nome si distinguono (orari nel nome), e un turno fuori dal ciclo si elimina (con «Annulla»).
import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const oggi=new Date(); oggi.setHours(12,0,0,0); const g=n=>{ const d=new Date(oggi); d.setDate(d.getDate()+n); return iso(d); };
const ST={turniConfigurati:true,pattern:"MMGRR",anchor:g(0),repeat:true,firstSeenAt:"2026-09-01",
  shifts:{M:{n:"Mattino",s:360,e:840},G:{n:"Giornata",s:540,e:1080},A:{n:"Giornata",s:480,e:960}}, ecc:{[g(3)]:"A",[g(4)]:"A"}};
const ctx=await b.newContext({locale:"it-IT",viewport:{width:390,height:844}});
await ctx.addInitScript(st=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1"); localStorage.setItem("nt:state",JSON.stringify(st)); localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:firstPlanBannerChiuso","true"); localStorage.setItem("nt:novitaViste",JSON.stringify("2099")); }, ST);
const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(1200);
const sh=await p.evaluate(()=>JSON.parse(localStorage.getItem("nt:state")).shifts);
ok(sh.G.n==="Giornata" && sh.A.n==="Giornata 8–16", "nomi doppi: quello nel ciclo resta «Giornata», l'altro diventa «Giornata 8–16» → "+sh.A.n);
await p.click('[data-tab="turni"]'); await p.waitForTimeout(250); await p.click("#tEdit"); await p.waitForTimeout(250); await p.click('[data-mod="ciclo"]'); await p.waitForTimeout(400);
const righe=await p.evaluate(()=>[...document.querySelectorAll("#ttOrari .qh-ore-riga > b")].map(x=>x.innerText.replace(/\s+/g," ")));
ok(righe.some(x=>/Giornata 8–16.*Elimina/.test(x)) && righe.some(x=>/^G\s*Giornata nel tuo ciclo/.test(x)), "in «Orari dei turni» ci sono tutti; quello fuori dal ciclo si elimina, quello nel ciclo no → "+righe.join(" | "));
await p.evaluate(()=>document.querySelector('[data-tt-elimina="A"]').click()); await p.waitForTimeout(400);
let st=await p.evaluate(()=>JSON.parse(localStorage.getItem("nt:state")));
ok(!st.shifts.A && !Object.values(st.ecc||{}).includes("A"), "eliminato: sparisce, e i 2 giorni dove l'avevi messo tornano al ciclo");
ok(/2 giorni tornano al ciclo/.test(await p.textContent("#toast")), "lo dice → "+(await p.textContent("#toast")));
await p.click("#toast .toast-undo"); await p.waitForTimeout(400);
st=await p.evaluate(()=>JSON.parse(localStorage.getItem("nt:state")));
ok(st.shifts.A && Object.values(st.ecc).filter(x=>x==="A").length===2, "«Annulla»: torna tutto com'era");
console.log("errori", errs); ok(errs.length===0, "nessun errore di pagina"); await b.close();
