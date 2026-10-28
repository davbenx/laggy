// «Perché oggi è così» in una riga sopra il piano, e «Il tuo orologio» in
// Sonno e carico (con il suo «Lo sapevi?» dopo una settimana).
import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const fa=n=>{ const d=new Date(); d.setDate(d.getDate()-n); return iso(d); };
const TURNI={M:{n:"Mattino",s:360,e:840},P:{n:"Pomeriggio",s:840,e:1320},N:{n:"Notte",s:1320,e:1800}};
async function apri(st, extra={}){
  const ctx=await b.newContext({locale:"it-IT",viewport:{width:390,height:800}});
  await ctx.addInitScript(([st,ex])=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
    localStorage.setItem("nt:state",JSON.stringify(st)); localStorage.setItem("nt:turniConfigurati","true");
    localStorage.setItem("nt:firstPlanBannerChiuso","true"); localStorage.setItem("nt:attivazioneNascosta","true");
    for(const k in ex) localStorage.setItem(k, ex[k]); }, [st, extra]);
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  const dieci=new Date(); dieci.setHours(10,0,0,0); await p.clock.setFixedTime(dieci);
  await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(1200);
  return p;
}
// la frase, senza l'etichetta «Il piano, in breve»
const riga=p=>p.evaluate(()=>{ const e=document.querySelector("#essenziale .essperche"); return e ? [...e.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join("") : null; });
const avanti=async p=>{ await p.click("#next"); await p.waitForTimeout(150); };

{ const p=await apri({turniConfigurati:true,pattern:"MMPPNNSRR",anchor:fa(0),repeat:true,firstSeenAt:"2026-01-01",freeBed:"00:30",freeWake:"08:30",shifts:TURNI});
  // una spiegazione sola per giorno: la riga in breve, oppure l'avviso di rischio, oppure l'avviso in cima
  const quante=()=>p.evaluate(()=>{ const st=document.querySelector("#status");
    return document.querySelectorAll("#essenziale .essperche, #essenziale .essrischio").length + (getComputedStyle(st).display!=="none" && st.classList.contains("warn") ? 1 : 0); });
  const righe=[], conti=[]; for(let i=0;i<9;i++){ righe.push(await riga(p)); conti.push(await quante()); await avanti(p); }
  ok(conti.every(n=>n===1), "ogni giorno del ciclo ha una spiegazione, una sola → "+conti.join(","));
  ok(/^Domani attacchi alle 06:00: stasera a letto presto/.test(righe[0]), "vigilia di un mattino: a letto presto → "+righe[0]);
  ok(/^Domani attacchi la notte/.test(righe[3]), "vigilia della prima notte: più tardi del solito → "+righe[3]);
  ok(/^Prima notte: il tuo orologio non è ancora sulla notte/.test(righe[4]), "prima notte del blocco → "+righe[4]);
  ok(/^Ultima notte: dopo il turno un sonno breve.*Blocco corto/.test(righe[5]), "ultima notte: sonno breve per rientrare, blocco corto → "+righe[5]);
  ok(/^Giorno di rientro/.test(righe[6]), "dopo le notti: giorno di rientro → "+righe[6]);
  // sopra le voci, sotto «Adesso»
  for(let i=0;i<9;i++) await p.click("#prev");
  const pos=await p.evaluate(()=>{ const r=document.querySelector(".essperche"), v=document.querySelector("#essenziale .erow"), o=document.querySelector("#ora");
    return [o.getBoundingClientRect().bottom, r.getBoundingClientRect().top, v.getBoundingClientRect().top]; });
  ok(pos[0]<=pos[1] && pos[1]<pos[2], "la riga sta fra «Adesso» e la prima voce del piano");
  await p.context().close(); }

// con un impegno in vista l'avviso in cima parla solo dell'impegno: niente seconda spiegazione della giornata
{ const d=new Date(); d.setDate(d.getDate()+2);
  const p=await apri({turniConfigurati:true,pattern:"MMPPNNSRR",anchor:fa(0),repeat:true,firstSeenAt:"2026-01-01",freeBed:"00:30",freeWake:"08:30",shifts:TURNI,evento:{d:iso(d),h:"10:00"}});
  const st=await p.evaluate(()=>document.querySelector("#status").innerText.trim());
  ok(/^🎯 In vista dell'impegno/.test(st) && !!(await riga(p)), "impegno in vista: l'avviso dice solo dell'impegno, il perché resta nella riga → "+st.slice(0,40));
  await p.context().close(); }

{ const p=await apri({turniConfigurati:true,pattern:"NNNNNRR",anchor:fa(3),repeat:true,firstSeenAt:"2026-01-01",shifts:{N:{n:"Notte",s:1320,e:1800}}});
  const r=await p.evaluate(()=>[!!document.querySelector(".essrischio"), !!document.querySelector(".essperche")]);
  ok(r[0] && !r[1], "con l'avviso di rischio (4ª notte) la riga del perché non si ripete");
  await p.context().close(); }

{ const p=await apri({turniConfigurati:true,pattern:"MPNSR",anchor:fa(0),repeat:true,firstSeenAt:fa(10),freeBed:"01:00",freeWake:"09:30",shifts:TURNI,pPattern:"MPNSR",backupDone:true},
    {"nt:analytics-consent":"false","nt:backupDone":"true"});
  const sap=await p.evaluate(()=>{ const e=document.querySelector("#loSapevi"); return e && !e.hidden ? e.dataset.k+" | "+e.textContent : null; });
  ok(sap && sap.startsWith("orologio |") && /un po' gufo, con il minimo corporeo verso le 07:15/.test(sap), "dopo una settimana, «Lo sapevi?»: il tuo orologio è pronto → "+sap);
  await p.click("[data-sapevi-prova]"); await p.waitForTimeout(400);
  const o=await p.evaluate(()=>{ const e=document.querySelector("#orologio"); if(!e) return null; const r=e.getBoundingClientRect();
    return {vis:document.body.classList.contains("andamenti-aperta"), top:Math.round(r.top), testo:e.innerText}; });
  ok(o && o.vis && o.top<200, "il tocco apre Sonno e carico sull'orologio → top "+(o&&o.top));
  const usate=await p.evaluate(()=>JSON.parse(localStorage.getItem("nt:funzioniUsate")||"{}"));
  ok(usate.orologio && usate.sonno, "aperta la pagina, né «Sonno e carico» né l'orologio tornano come «Lo sapevi?»");
  ok(o && /Un po' gufo/.test(o.testo) && /Metà del sonno\s+[\s\S]*05:15/.test(o.testo) && /Minimo corporeo[\s\S]*07:15/.test(o.testo) && /dalle 23:00/.test(o.testo) && /Più lucido[\s\S]*verso le \d\d:\d\d/.test(o.testo),
    "orologio: tipo, metà del sonno 05:15, melatonina dalle 23:00, minimo 07:15, più lucido");
  ok(/01:00 → 09:30/.test(o.testo) && /Non sono una misura/.test(o.testo), "dice da dove vengono i numeri e che sono stime");
  await p.click("[data-oro-cambia]"); await p.waitForTimeout(400);
  ok(await p.evaluate(()=>document.body.classList.contains("tab-opzioni") && !document.querySelector("#opzBox3").hidden), "«Cambia come dormi» porta alla sezione giusta di Impostazioni");
  await p.context().close(); }

{ const p=await apri({turniConfigurati:true,pattern:"MPNSR",anchor:fa(0),repeat:true,firstSeenAt:fa(10),shifts:TURNI});
  await p.click('[data-tab="turni"]'); await p.click("#doAndamenti"); await p.waitForTimeout(300);
  const t=await p.evaluate(()=>{ const d=document.querySelector("#orologio"); d.open=true; return d.innerText; });
  ok(/orari di partenza/.test(t) && /Dimmi come dormi/.test(t), "con gli orari di partenza lo dice, e invita a renderlo tuo");
  ok(!(await p.evaluate(()=>JSON.parse(localStorage.getItem("nt:funzioniUsate")||"{}").orologio)), "con gli orari di partenza l'orologio non conta come visto: l'invito arriverà quando sarà suo");
  await p.context().close(); }

console.log("errori", errs); await b.close();
