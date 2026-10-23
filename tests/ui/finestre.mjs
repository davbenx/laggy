// «I momenti migliori di oggi»: testa, movimento, allenamento sotto la striscia della giornata.
// Fuori dal turno, mai a ridosso del sonno; per l'ora in corso la casella si evidenzia.
import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
async function apri(pat, sh, quando, w=360){
  const ctx=await b.newContext({locale:"it-IT",timezoneId:"Europe/Rome",viewport:{width:w,height:780}});
  await ctx.addInitScript(([pat,sh])=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
    localStorage.setItem("nt:state",JSON.stringify({turniConfigurati:true,pattern:pat,anchor:"2026-11-03",shifts:sh,repeat:true,firstSeenAt:"2026-01-01"}));
    localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:firstPlanBannerChiuso","true"); localStorage.setItem("nt:attivazioneNascosta","true"); },[pat,sh]);
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.clock.setFixedTime(new Date(quando));
  await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(900);
  return p;
}
const leggi=p=>p.evaluate(()=>[...document.querySelectorAll("#finestre .fin")].map(x=>({l:x.querySelector(".fin-l").textContent, o:x.querySelector(".fin-o").textContent, cls:x.className})));
const min=s=>{ const m=/(\d\d):(\d\d)/.exec(s); return +m[1]*60+ +m[2]; };
const P={P:{n:"Pomeriggio",s:840,e:1320}}, N={N:{n:"Notte",s:1320,e:1800}};

{ const p=await apri("RRRR",N,"2026-11-03T10:00:00+01:00"), f=await leggi(p);
  ok(f.length===3 && f.map(x=>x.l).join()==="Testa,Movimento,Allenamento", "giorno libero: tre caselle → "+f.map(x=>x.l+" "+x.o).join(" | "));
  const all=f[2].o.split("–").map(min); ok(all[0]>=14*60 && all[1]<=20.5*60, "l'allenamento sta nel pomeriggio-sera");
  ok(await p.evaluate(()=>document.querySelector("#finestre").getBoundingClientRect().top > document.querySelector("#formaGiorno").getBoundingClientRect().bottom-2), "sono sotto la striscia della giornata");
  ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), "niente scorrimento laterale");
  await p.context().close(); }
{ const p=await apri("PPPPPRR",P,"2026-11-03T09:00:00+01:00"), f=await leggi(p);
  const turnoInizio=840-70;
  ok(f.every(x=>min(x.o.split("–")[1])<=turnoInizio), "giorno di turno 14–22: tutte finite prima del viaggio ("+f.map(x=>x.o).join(" | ")+")");
  await p.context().close(); }
{ const p=await apri("RRRR",N,"2026-11-03T11:45:00+01:00"), f=await leggi(p);
  ok(f[0].cls.includes("ora") || f[0].cls.includes("past") || f.some(x=>/ora|past/.test(x.cls)), "alle 11:45 la casella in corso o passata si distingue → "+f.map(x=>x.o+":"+x.cls.replace("fin","").trim()).join(" | "));
  await p.context().close(); }
{ const p=await apri("RRRR",N,"2026-11-03T10:00:00+01:00");
  await p.click("[data-fin-perche]"); await p.waitForTimeout(200);
  ok(await p.evaluate(()=>/non un consiglio medico/.test(document.querySelector(".fin-perche").innerText)), "«Come lo calcolo» spiega e dice che non è un consiglio medico");
  await p.click("#prev"); await p.waitForTimeout(200);
  ok(await p.evaluate(()=>document.querySelector("#finestre").innerHTML===""), "su un giorno passato non compaiono");
  await p.context().close(); }
{ const p=await apri("RRRR",N,"2026-11-03T10:00:00+01:00",320);
  ok(await p.evaluate(()=>{ const r=[...document.querySelectorAll("#finestre .fin")]; return r.every(x=>x.scrollWidth<=x.clientWidth+1) && document.documentElement.scrollWidth<=innerWidth; }), "320 px: il testo non esce dalle caselle");
  await p.context().close(); }
console.log("errori", errs); await b.close();
