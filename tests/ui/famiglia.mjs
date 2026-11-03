// P3: chi guida per lavoro vede le pause di guida nel turno; con le notti fisse, nei giorni liberi l'idea del «compromesso»;
// il primo piano spiega l'app in tre punti; «Copia una settimana» in un tocco; un figlio a scuola si aggiunge in un tocco.
import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const URL=process.env.URL||"http://localhost:8765/index.html";
const b=await pw.chromium.launch(); const errs=[];
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const SH={N:{n:"Notte",s:1320,e:1800}};
const oggi=new Date(); oggi.setHours(12,0,0,0);
const apri=async(st, extra={}, ora)=>{
  const ctx=await b.newContext({locale:"it-IT",viewport:{width:390,height:844}});
  await ctx.addInitScript(([st,extra])=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
    localStorage.setItem("nt:state",JSON.stringify(st)); localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:backupDone","true"); localStorage.setItem("nt:novitaViste",JSON.stringify("2099"));
    for(const k in extra) localStorage.setItem(k,extra[k]); },[st,extra]);
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  if(ora) await p.clock.install({time:ora});
  await p.goto(URL); if(ora) await p.clock.runFor(2500); else await p.waitForTimeout(1200); return p;
};
const foglio=async(p,row)=>{ await p.click(`#essenziale [data-row="${row}"]`); await p.waitForTimeout(500);
  const t=await p.evaluate(()=>{ document.querySelectorAll("#infoCorpo details").forEach(d=>d.open=true); return document.querySelector("#infoCorpo").innerText; });
  await p.click("#infoChiudi"); await p.waitForTimeout(300); return t; };
const CHIUSO={"nt:firstPlanBannerChiuso":"true","nt:attivazioneNascosta":"true"};
// notti fisse 5+2, oggi (lunedì 2 novembre 2026, ore 15) è una notte
const notti={turniConfigurati:true,repeat:true,firstSeenAt:"2026-09-01",anchor:"2026-11-02",pattern:"NNNNNRR",shifts:SH,freeBed:"23:30",freeWake:"07:30"};
let p=await apri(Object.assign({guidaLavoro:true},notti), CHIUSO, new Date(2026,10,2,15,0));
let t=await foglio(p,"turno");
ok(/45 minuti di pausa/.test(t) && /561\/2006/.test(t), "guida per lavoro: nel turno le pause di guida, con la fonte");
await p.context().close();
p=await apri(notti, CHIUSO, new Date(2026,10,2,15,0));
t=await foglio(p,"turno");
ok(!/Pause di guida/.test(t), "chi non guida per lavoro non le vede");
await p.context().close();
// domenica 8: riposo
p=await apri(notti, CHIUSO, new Date(2026,10,8,15,0));
t=await foglio(p,"liberi");
ok(/Con le notti fisse/.test(t) && /verso le 3/.test(t) && /Smith, Fogg/.test(t), "notti fisse, giorno libero: l'idea del compromesso con la fonte");
await p.context().close();
// rotazione con poche notti: niente
p=await apri(Object.assign({}, notti, {pattern:"MPNRR", shifts:{M:{n:"Mattino",s:360,e:840},P:{n:"Pomeriggio",s:840,e:1320},N:{n:"Notte",s:1320,e:1800}}}), CHIUSO, new Date(2026,10,6,11,0));
t=await foglio(p,"liberi");
ok(!/Con le notti fisse/.test(t), "in una rotazione l'idea delle notti fisse non c'è");
await p.context().close();
// il primo piano in tre punti
p=await apri(notti, {}, new Date(2026,10,2,15,0));
const tour=await p.evaluate(()=>{ const o=document.querySelector("#firstPlanBanner .tour3"); return o && o.offsetParent!==null ? o.querySelectorAll("li").length : 0; });
ok(tour===3, "il banner del primo piano spiega l'app in tre punti");
await p.context().close();
// Copia una settimana: pennello «Come 7 giorni prima» + intervallo, in un tocco
const ST={turniConfigurati:true,pattern:"R",anchor:"2000-01-01",shifts:{M:{n:"Mattino",s:420,e:840},N:{n:"Notte",s:1260,e:1860}},repeat:false,firstSeenAt:"2026-01-01",ecc:{}};
const lun=new Date(oggi); lun.setDate(lun.getDate()-((lun.getDay()+6)%7)+7);
const g=n=>{ const d=new Date(lun); d.setDate(d.getDate()+n); return iso(d); };
ST.ecc={[g(0)]:"M",[g(1)]:"M",[g(2)]:"N",[g(3)]:"N",[g(4)]:"R",[g(5)]:"R",[g(6)]:"M"};
p=await apri(ST, {"nt:firstPlanBannerChiuso":"true"});
await p.click('[data-tab="turni"]'); await p.waitForTimeout(250); await p.click("#tEdit"); await p.waitForTimeout(250); await p.click('[data-mod="segna"]'); await p.waitForTimeout(300);
await p.click("[data-sg-settimana]"); await p.waitForTimeout(150);
ok(await p.evaluate(()=>document.querySelector('[data-pen="copia"]').getAttribute("aria-pressed")==="true" && document.querySelector("[data-sg-intervallo]").getAttribute("aria-pressed")==="true"), "«Copia una settimana»: pennello «Come 7 giorni prima» e intervallo insieme");
const vai=async k=>{ for(let i=0;i<3 && !(await p.$('[data-sg="'+k+'"]'));i++){ await p.click('[data-sg-mese="1"]'); await p.waitForTimeout(150); } await p.click('[data-sg="'+k+'"]'); await p.waitForTimeout(150); };
await vai(g(7)); await vai(g(13)); await p.waitForTimeout(500);
const st=await p.evaluate(()=>JSON.parse(localStorage.getItem("nt:state")).ecc);
ok([0,1,2,3,6].every(n=>st[g(n+7)]===st[g(n)]), "la settimana dopo prende i turni di quella prima → "+[7,8,9,10,11,12,13].map(n=>st[g(n)]||"·").join(""));
await p.context().close();
// un figlio a scuola, in un tocco
p=await apri(notti, CHIUSO);
await p.evaluate(()=>document.querySelector('[data-tab="turni"]').click()); await p.waitForTimeout(300);
await p.evaluate(()=>{ document.querySelector("#doOpzioni").click(); document.querySelector('[data-opzg-vai="persone"]').click(); }); await p.waitForTimeout(400);
await p.fill("#personaName","Marco"); await p.click('[data-pvia="scuola"]'); await p.waitForTimeout(200);
ok(await p.evaluate(()=>document.querySelector("#pvManuale").hidden), "scuola: niente da scrivere");
await p.click("#doConfirmPersona"); await p.waitForTimeout(500);
const per=await p.evaluate(()=>{ const s=JSON.parse(localStorage.getItem("nt:state")); return s.pPattern ? {name:s.pName, pattern:s.pPattern, shifts:s.pShifts} : (s.people||[]).find(x=>x.name==="Marco"); });
ok(per && per.name==="Marco" && per.pattern==="AAAAARR" && per.shifts.A.s===480 && per.shifts.A.e===810, "Marco va a scuola lun–ven 8–13:30 → "+JSON.stringify(per&&per.shifts));
await p.context().close();
console.log("errori", errs); ok(errs.length===0, "nessun errore di pagina"); await b.close();
