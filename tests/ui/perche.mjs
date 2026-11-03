// Il foglio di una voce in tre strati: in breve (aperto), «Perché» (chiuso), le fonti in una riga. «Ancora mercoledì»
// spiegato sotto la data. Il «Momento di sonnolenza» dice da dove viene la stima. «Piano essenziale» in un tocco.
import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const URL=process.env.URL||"http://localhost:8765/index.html";
const b=await pw.chromium.launch(); const errs=[];
const SH={M:{n:"Mattino",s:360,e:840},P:{n:"Pomeriggio",s:840,e:1320},N:{n:"Notte",s:1320,e:1800}};
const st={turniConfigurati:true,repeat:true,firstSeenAt:"2026-09-01",anchor:"2026-11-02",pattern:"NNNSRRR",shifts:SH,freeBed:"23:30",freeWake:"07:30"};
const apri=async(ora, extra={})=>{
  const ctx=await b.newContext({locale:"it-IT",viewport:{width:390,height:844}});
  await ctx.addInitScript(([st])=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
    localStorage.setItem("nt:state",JSON.stringify(st)); localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:backupDone","true");
    localStorage.setItem("nt:firstPlanBannerChiuso","true"); localStorage.setItem("nt:attivazioneNascosta","true"); localStorage.setItem("nt:novitaViste",JSON.stringify("2099")); },[Object.assign({},st,extra)]);
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message)); await p.clock.install({time:ora}); await p.goto(URL); await p.clock.runFor(2500); return p;
};
// 4 novembre, terza notte; alle 3:10 del 5 il giorno dell'app è ancora il 4
let p=await apri(new Date(2026,10,5,3,10));
const nota=await p.evaluate(()=>{ const n=document.querySelector("#ancoraNota"); return n && !n.hidden && n.offsetParent!==null ? n.textContent : ""; });
ok(/^Ancora mercoledì/.test(await p.textContent("#dateLabel")) && /già giovedì/.test(nota), "«Ancora mercoledì 4» con la riga che spiega → "+nota);
const nap=await p.evaluate(()=>[...document.querySelectorAll("#essenziale [data-row]")].map(r=>r.dataset.row).find(x=>x.startsWith("nap")));
await p.click(`#essenziale [data-row="${nap}"]`); await p.clock.runFor(600);
const f=await p.evaluate(()=>{ const c=document.querySelector("#infoCorpo"), d=c.querySelector("details.perche"), fo=c.querySelector(".fonti");
  return {d:!!d, aperto:d&&d.open, fonti:fo?fo.textContent:"", citeFuori:[...c.querySelectorAll("cite")].length, prima:c.firstElementChild&&c.firstElementChild.tagName}; });
ok(f.d && !f.aperto && /^Fonti/.test(f.fonti) && f.citeFuori===0, "foglio del pisolino: «Perché» chiuso e le fonti in una riga → "+JSON.stringify(f));
await p.click("#infoCorpo details.perche > summary"); await p.clock.runFor(200);
ok(await p.evaluate(()=>document.querySelector("#infoCorpo details.perche").open && document.querySelector("#infoCorpo details.perche .why").offsetHeight>0), "un tocco su «Perché» lo apre");
await p.click("#infoChiudi"); await p.clock.runFor(400);
await p.context().close();
// rotazione M-P-N: nella notte del 4 il momento di sonnolenza cade in turno (alle 3 del 5 il giorno è ancora il 4)
p=await apri(new Date(2026,10,5,3,0), {pattern:"MPNSRR"});
const sn=await p.evaluate(()=>{ const r=document.querySelector('#essenziale [data-row="sonnolenza"]'); return r ? r.innerText.replace(/\s+/g," ") : ""; });
ok(/Momento di sonnolenza/.test(sn) && /stima dai tuoi orari/.test(sn), "momento di sonnolenza con la fonte della stima → "+sn);
const m=sn.match(/(\d\d):(\d\d).*?(\d\d):(\d\d)/); const larg=m ? ((((+m[3])*60+(+m[4]))-((+m[1])*60+(+m[2])))+1440)%1440 : 0;
ok(larg>=150 && larg<=240, "senza diario la finestra è larga (dagli orari del piano): "+larg+" minuti");
// Piano essenziale: un interruttore nasconde pasti, tempo libero e luce bassa; spento, tornano
const voci=()=>p.evaluate(()=>[...document.querySelectorAll("#essenziale [data-row]")].map(r=>r.dataset.row));
const prima=await voci();
await p.click("#doOpzioni"); await p.clock.runFor(500); await p.click('[data-opzg-vai="voci"]'); await p.clock.runFor(300);
ok(await p.evaluate(()=>!!document.querySelector("#pv-_essenziale") && !document.querySelector("#pv-_essenziale").checked), "in Cosa vedi nel piano, «Piano essenziale» spento all'inizio");
await p.click('label[for="pv-_essenziale"]'); await p.clock.runFor(400);
const dopo=await voci();
ok(prima.includes("pasti") && !dopo.includes("pasti") && !dopo.includes("liberi") && !dopo.includes("penombra") && dopo.includes("turno") && dopo.includes("luce"), "Piano essenziale: restano turno e luce, spariscono pasti, libero e luce bassa → "+dopo.join(","));
await p.click('label[for="pv-_essenziale"]'); await p.clock.runFor(400);
ok((await voci()).includes("pasti"), "spento, il piano completo torna");
await p.context().close();
console.log("errori", errs); ok(errs.length===0, "nessun errore di pagina"); await b.close();
