// Movimento fatto: «L'ho fatto» dal popup, annulla, avviso se un allenamento intenso finisce a ridosso del letto, insight sul voto.
import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const fa=n=>{ const d=new Date(); d.setDate(d.getDate()-n); return iso(d); };
const SH={M:{n:"Mattino",s:420,e:840},P:{n:"Pomeriggio",s:840,e:1260},N:{n:"Notte",s:1320,e:1800}};
const b=await pw.chromium.launch(); const errs=[];
async function apri(extra={}, diary=null){
  const ctx=await b.newContext({locale:"it-IT",viewport:{width:360,height:900}});
  const st={turniConfigurati:true,pattern:"RRRR",anchor:fa(0),shifts:SH,repeat:true,firstSeenAt:fa(60),freeBed:"23:30",freeWake:"07:30",piano:{leggera:true,intensa:true}};
  await ctx.addInitScript(([st,extra,diary])=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1"); localStorage.setItem("nt:state",JSON.stringify(st)); for(const k of ["turniConfigurati","firstPlanBannerChiuso","attivazioneNascosta","backupDone","novitaProva"]) localStorage.setItem("nt:"+k,"true"); localStorage.setItem("nt:novitaViste",JSON.stringify("2099-01-01"));
    for(const k in extra) localStorage.setItem("nt:"+k,JSON.stringify(extra[k])); if(diary) localStorage.setItem("nt:diary",JSON.stringify(diary)); },[st,extra,diary]);
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(3500);
  await p.evaluate(()=>{ const o=document.querySelector("#novitaOk"); if(o&&!document.querySelector("#novitaModal").hidden) o.click(); });
  return p;
}
{ const p=await apri();
  const righe=await p.evaluate(()=>[...document.querySelectorAll(".erow[data-row]")].map(e=>e.dataset.row));
  ok(righe.includes("fin-leggera") && righe.includes("fin-intensa"), "Movimento e Allenamento sono nel piano → "+righe.filter(r=>/fin-/.test(r)).join(","));
  await p.evaluate(()=>document.querySelector('.erow[data-row="fin-intensa"]').click()); await p.waitForTimeout(300);
  ok(await p.evaluate(()=>!!document.querySelector("#infoModal [data-att-ora]") && !!document.querySelector("#infoModal [data-att-salva]")), "il popup ha l'ora di fine e «L'ho fatto»");
  await p.evaluate(()=>{ document.querySelector("#infoModal [data-att-ora]").value="23:00"; document.querySelector("#infoModal [data-att-salva]").click(); }); await p.waitForTimeout(400);
  const a=await p.evaluate(()=>JSON.parse(localStorage.getItem("nt:attivita")||"{}"));
  ok(Object.values(a)[0] && Object.values(a)[0][0].t==="intensa" && Object.values(a)[0][0].fine==="23:00", "salvato per giorno → "+JSON.stringify(a));
  ok(await p.evaluate(()=>/Finito tardi/.test(document.querySelector("#toast").textContent)), "allenamento intenso finito a ridosso del letto: l'avviso");
  await p.evaluate(()=>document.querySelector('.erow[data-row="fin-intensa"]').click()); await p.waitForTimeout(300);
  ok(await p.evaluate(()=>/Fatto, finito alle 23:00/.test(document.querySelector("#infoModal").innerText)), "riaprendo: «Fatto, finito alle 23:00»");
  await p.evaluate(()=>document.querySelector("#infoModal [data-att-annulla]").click()); await p.waitForTimeout(300);
  ok(await p.evaluate(()=>!JSON.parse(localStorage.getItem("nt:attivita")||"{}")[Object.keys(JSON.parse(localStorage.getItem("nt:attivita")||"{}"))[0]]), "«Annulla» toglie la voce");
  await p.evaluate(()=>document.querySelector('.erow[data-row="fin-leggera"]').click()); await p.waitForTimeout(300);
  await p.evaluate(()=>{ document.querySelector("#infoModal [data-att-ora]").value="12:00"; document.querySelector("#infoModal [data-att-salva]").click(); }); await p.waitForTimeout(400);
  ok(await p.evaluate(()=>document.querySelector("#toast").textContent.trim()==="Segnato"), "movimento leggero a mezzogiorno: nessun avviso");
  await p.context().close(); }
// insight: 24 giorni, voto 4-5 nei giorni di movimento, 2-3 negli altri
{ const att={}, dia={}; for(let i=1;i<=24;i++){ const k=fa(i), mosso=i%2===0; if(mosso) att[k]=[{t:"leggera",fine:"18:00"}]; dia[k]=mosso?5:2; }
  const p=await apri({attivita:att}, dia);
  await p.evaluate(()=>document.querySelector('[data-tab="turni"]').click()); await p.waitForTimeout(300);
  await p.evaluate(()=>document.querySelector("#doAndamenti").click()); await p.waitForTimeout(500);
  const t=await p.evaluate(()=>document.querySelector("#andamenti").innerText);
  ok(/Nei giorni in cui ti muovi il tuo voto è in media 5,0 \(contro 2,0 negli altri\)/.test(t), "con 24 giorni: l'insight sul movimento compare con i numeri giusti");
  await p.context().close(); }
{ const att={}, dia={}; for(let i=1;i<=24;i++){ const k=fa(i), mosso=i%2===0; if(mosso) att[k]=[{t:"leggera",fine:"18:00"}]; dia[k]=mosso?2:5; }
  const p=await apri({attivita:att}, dia);
  await p.evaluate(()=>document.querySelector('[data-tab="turni"]').click()); await p.waitForTimeout(300);
  await p.evaluate(()=>document.querySelector("#doAndamenti").click()); await p.waitForTimeout(500);
  ok(!(await p.evaluate(()=>/Nei giorni in cui ti muovi/.test(document.querySelector("#andamenti").innerText))), "legame contrario: nessuna frase");
  await p.context().close(); }
console.log("errori",errs); ok(errs.length===0,"nessun errore di pagina"); await b.close();
