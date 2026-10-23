// «I momenti migliori»: testa, movimento, allenamento come voci della timeline di Oggi, ognuna al suo
// orario, con il perché nel dettaglio. Fuori dal turno, mai a ridosso del sonno; quella in corso si evidenzia.
import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
async function apri(pat, sh, quando, w=360){
  const ctx=await b.newContext({locale:"it-IT",timezoneId:"Europe/Rome",viewport:{width:w,height:780}});
  await ctx.addInitScript(([pat,sh])=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
    localStorage.setItem("nt:state",JSON.stringify({turniConfigurati:true,pattern:pat,anchor:"2026-11-03",shifts:sh,repeat:true,firstSeenAt:"2026-01-01",piano:{testa:true,leggera:true,intensa:true}}));
    localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:firstPlanBannerChiuso","true"); localStorage.setItem("nt:attivazioneNascosta","true"); },[pat,sh]);
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.clock.setFixedTime(new Date(quando));
  await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(900);
  return p;
}
const righe=p=>p.evaluate(()=>["testa","leggera","intensa"].map(k=>{ const d=document.querySelector('#essenziale [data-row="fin-'+k+'"]'); const tl=d&&d.closest(".tl"); if(!tl) return null;
  return {k, a:+tl.dataset.a, z:+tl.dataset.z, cls:tl.className, testo:tl.querySelector(".essrow").innerText.replace(/\s+/g," ").trim(), det:(d.querySelector(".ed")||{}).innerText||""}; }));
const P={P:{n:"Pomeriggio",s:840,e:1320}}, N={N:{n:"Notte",s:1320,e:1800}};

{ const p=await apri("RRRR",N,"2026-11-03T10:00:00+01:00"), r=await righe(p);
  ok(r.every(Boolean), "giorno libero: tre voci nella timeline → "+r.map(x=>x&&x.testo).join(" | "));
  ok(/Allenamento.*fino alle \d\d:\d\d · più impegnativo/.test(r[2].testo) && r[2].a>=14*60 && r[2].z<=20.5*60, "l'allenamento sta nel pomeriggio-sera, scritto come le altre voci («fino alle … · …»)");
  ok(await p.evaluate(()=>!document.querySelector("#finestre")), "niente più riquadro a parte: un solo posto per il piano");
  ok(await p.evaluate(()=>{ const t=[...document.querySelectorAll("#essenziale .tl")].map(x=>x.dataset.a?+x.dataset.a:null).filter(x=>x!==null); return t.every((x,i)=>i===0||x>=t[i-1]-0); }), "le voci restano in ordine di orario");
  await p.click('[data-row="fin-testa"] summary'); await p.waitForTimeout(200);
  ok(/né un consiglio medico/.test(await p.evaluate(()=>document.querySelector('[data-row="fin-testa"] .ed').innerText)), "il dettaglio spiega il perché e dice che non è un consiglio medico");
  ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), "niente scorrimento laterale");
  await p.context().close(); }
{ const p=await apri("PPPPPRR",P,"2026-11-03T09:00:00+01:00"), r=(await righe(p)).filter(Boolean);
  ok(r.length>0 && r.every(x=>x.z<=840-70), "giorno di turno 14–22: tutte finite prima del viaggio ("+r.map(x=>x.k+" "+x.a+"-"+x.z).join(" | ")+")");
  await p.context().close(); }
{ const p=await apri("RRRR",N,"2026-11-03T11:45:00+01:00"), r=await righe(p);
  ok(/\bora\b/.test(r[0].cls) && !/\bpast\b/.test(r[2].cls), "alle 11:45 la finestra «Testa» è in corso, l'allenamento deve ancora venire");
  await p.context().close(); }
{ const p=await apri("RRRR",N,"2026-11-03T10:00:00+01:00");
  await p.click("#prev"); await p.waitForTimeout(200);
  ok(await p.evaluate(()=>!document.querySelector('#essenziale [data-row^="fin-"]')), "su un giorno passato non compaiono");
  await p.context().close(); }
{ const p=await apri("RRRR",N,"2026-11-03T10:00:00+01:00",320);
  ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth && [...document.querySelectorAll("#essenziale .tl")].every(x=>x.getBoundingClientRect().right<=innerWidth+1)), "320 px: niente scorrimento laterale");
  await p.context().close(); }
console.log("errori", errs); await b.close();
