// Il momento di sonnolenza: in turno o nel tragitto (scheda), appena sveglio prima di uscire (scheda con consigli
// pratici), nei giorni liberi niente. L'avviso arancione usa la stessa stima della scheda.
import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const apri=async(st, ora)=>{ const ctx=await b.newContext({locale:"it-IT",viewport:{width:390,height:844}});
  await ctx.addInitScript(st=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
    localStorage.setItem("nt:state",JSON.stringify(st)); localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:firstPlanBannerChiuso","true"); localStorage.setItem("nt:novitaViste",JSON.stringify("2099")); }, st);
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message)); await p.clock.install({time:ora});
  await p.goto("http://localhost:8765/index.html"); await p.clock.runFor(2500); return p; };
const riga=p=>p.evaluate(()=>{ const r=document.querySelector('#essenziale [data-row="sonnolenza"]'); return r ? r.innerText.replace(/\s+/g," ") : ""; });
const BASE={turniConfigurati:true,repeat:true,firstSeenAt:"2026-09-01",anchor:"2026-11-02",freeBed:"23:30",freeWake:"07:30",cTo:30,cFrom:30};
// mattino alle 6: sveglia verso le 5, il punto più basso (circa 5:30) prima di uscire
let p=await apri({...BASE, pattern:"MMMMMRR", shifts:{M:{n:"Mattino",s:360,e:840}}}, new Date(2026,10,4,4,30));
let t=await riga(p);
ok(/Momento di sonnolenza/.test(t) && /appena sveglio/.test(t), "mattino presto: il punto basso appena sveglio, prima di uscire → "+t);
// le ore a sinistra sono in ordine (prima la voce finiva dopo «Luce» con un orario precedente)
const ore=await p.evaluate(()=>[...document.querySelectorAll("#essenziale .tl:not(.tl-stessa) .essrow > .en")].map(e=>e.textContent.trim()).filter(x=>/^\d\d:\d\d$/.test(x)));
const min=ore.map(x=>+x.slice(0,2)*60+ +x.slice(3)), ordinate=min.every((m,i)=>i===0 || m>=min[i-1] || min[i-1]-m>720);
ok(ordinate, "le ore della giornata sono in ordine → "+ore.join(" "));
const sveglia=await p.evaluate(()=>{ const r=document.querySelector('#essenziale [data-row="sonnolenza"] .en'); return r ? r.textContent.trim() : ""; });
const dormi=await p.evaluate(()=>(document.querySelector("#essenziale .drem")||document.body).innerText.match(/(\d\d:\d\d) → (\d\d:\d\d)/));
ok(dormi && sveglia>=dormi[2], "«appena sveglio» comincia quando ti svegli, non mentre dormi → "+sveglia+" (sveglia "+(dormi&&dormi[2])+")");
await p.click('#essenziale [data-row="sonnolenza"]'); await p.clock.runFor(500);
const f=await p.evaluate(()=>document.querySelector("#infoCorpo").innerText);
ok(/i primi 20-30 minuti sono i più lenti/.test(f) && /acqua fresca/.test(f) && !/luce forte/i.test(f), "consigli pratici per svegliarsi, senza dire della luce (decide la voce «Luce»)");
await p.context().close();
// «Adesso» prima del turno: solo quello che viene prima, in ordine, e «Poi» non ripete il turno
p=await apri({...BASE, pattern:"MMMMMRR", shifts:{M:{n:"Mattino",s:360,e:840}}}, new Date(2026,10,4,5,0));
const ad=await p.evaluate(()=>document.querySelector("#ora").innerText.replace(/\s+/g," "));
ok(/Tra 1h entri in turno|Tra 1 ora entri in turno|entri in turno/.test(ad) && /Esci alle 05:30 · turno alle 06:00/.test(ad) && !/caffeina|pisolino prima/.test(ad) && !/Poi · entri in turno/.test(ad), "prima del turno: «Esci alle 05:30 · turno alle 06:00», senza il pomeriggio né il «Poi» doppio → "+ad);
await p.context().close();
// notte: il punto basso in turno, come prima
p=await apri({...BASE, pattern:"MPNSRR", shifts:{M:{n:"Mattino",s:360,e:840},P:{n:"Pomeriggio",s:840,e:1320},N:{n:"Notte",s:1320,e:1800}}}, new Date(2026,10,5,3,0));
t=await riga(p); ok(/Momento di sonnolenza/.test(t) && !/appena sveglio/.test(t), "notte: la scheda in turno → "+t);
await p.context().close();
// giorno libero: niente scheda
p=await apri({...BASE, pattern:"RRRRRRR", shifts:{}}, new Date(2026,10,4,10,0));
ok(!(await riga(p)), "giorno libero: niente scheda"); await p.context().close();
console.log("errori", errs); ok(errs.length===0, "nessun errore di pagina"); await b.close();
