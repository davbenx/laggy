// Scheda Turni: gli strumenti in una griglia con una riga di stato, «Modifica turni» e «Condividi» sono fogli,
// il mese è una riga sola che si apre; «Segna» e «Importa» mostrano solo la propria metà.
import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const SH={M:{n:"Mattino",s:360,e:840},P:{n:"Pomeriggio",s:840,e:1320},N:{n:"Notte",s:1320,e:1800}};
const oggi=new Date(); oggi.setHours(12,0,0,0);
const ST={turniConfigurati:true,pattern:"MMPPNNRR",anchor:iso(oggi),shifts:SH,repeat:true,firstSeenAt:"2026-01-01",freeBed:"23:30",freeWake:"07:30"};
const apri=async()=>{
  const ctx=await b.newContext({locale:"it-IT",viewport:{width:390,height:844}});
  await ctx.addInitScript(st=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1"); localStorage.setItem("nt:state",JSON.stringify(st)); localStorage.setItem("nt:turniConfigurati","true"); },ST);
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(900);
  await p.evaluate(()=>document.querySelector('[data-tab="turni"]').click()); await p.waitForTimeout(300);
  return p;
};
const vis=(p,s)=>p.evaluate(s=>{ const e=document.querySelector(s); return !!e && !e.hidden && getComputedStyle(e).display!=="none"; }, s);
const p=await apri();
ok(await p.evaluate(()=>{ const g=document.querySelector("#strumenti"), a=document.getElementById("doAndamenti"), tl=document.getElementById("doPartner"); return !!g && ["doFerie","doScambioTurno"].every(i=>g.contains(document.getElementById(i))) && !g.contains(a) && !g.contains(tl) && !!(a.compareDocumentPosition(tl)&Node.DOCUMENT_POSITION_FOLLOWING) && !!(tl.compareDocumentPosition(g)&Node.DOCUMENT_POSITION_FOLLOWING); }), "due righe in alto (Sonno e carico, Tempo libero), poi la griglia con Ferie e Cambio turno");
ok(await p.evaluate(()=>[...document.querySelectorAll("#strumenti .tsec")].every(t=>t.querySelector(".tsec-t") && t.offsetHeight>=44)), "ogni strumento ha titolo e una riga di stato, ed è un bersaglio comodo");
// Modifica turni: un foglio con quattro azioni
await p.click("#tEdit"); await p.waitForTimeout(250);
ok(await vis(p,"#modificaModal") && await p.evaluate(()=>document.querySelectorAll("#modificaModal [data-mod]").length===4), "«Modifica turni» apre un foglio con quattro azioni");
await p.click("#modificaChiudi"); await p.waitForTimeout(250);
ok(!(await vis(p,"#modificaModal")), "si chiude");
// Segna: solo il calendario; Importa: solo l'importazione
await p.click("#tEdit"); await p.waitForTimeout(250); await p.click('[data-mod="segna"]'); await p.waitForTimeout(300);
ok(await p.evaluate(()=>document.body.classList.contains("sg-segna-solo") && !document.body.classList.contains("sg-importa-sola")) && await vis(p,"#segnaOut"), "«Segna» mostra il calendario");
ok(await p.evaluate(()=>{ const i=document.querySelector("#segnaPagina .sg-importa"); return !i || i.offsetParent===null; }), "…senza l'importazione");
// fase 2: intervallo, «come 7 giorni prima», annulla
{ const st=()=>p.evaluate(()=>JSON.parse(localStorage.getItem("nt:state")));
  const dd=n=>{ const d=new Date(oggi.getTime()+n*864e5); return iso(d); };
  const t=n=>p.evaluate(k=>{ const e=document.querySelector('[data-sg="'+k+'"]'); return e?e.querySelector("b").textContent:null; }, dd(n));
  const mese=oggi.getMonth(); const ok2=[1,2,3].every(n=>new Date(oggi.getTime()+n*864e5).getMonth()===mese);
  if(ok2){
    await p.click('[data-pen="ferie"]'); await p.click("[data-sg-intervallo]"); await p.waitForTimeout(100);
    await p.click('[data-sg="'+dd(1)+'"]'); ok(await p.evaluate(()=>/ultimo giorno/.test(document.querySelector("#segnaOut .hint").textContent)), "intervallo: dopo il primo tocco chiede l'ultimo");
    await p.click('[data-sg="'+dd(3)+'"]'); await p.waitForTimeout(150);
    const s1=await st(); ok([1,2,3].every(n=>s1.giorni[dd(n)] && s1.giorni[dd(n)].t==="ferie"), "intervallo: tre giorni di ferie con due tocchi");
    ok(await p.evaluate(()=>!document.querySelector("[data-sg-annulla]").disabled), "«Annulla» si accende");
    await p.click("[data-sg-annulla]"); await p.waitForTimeout(150);
    const s2=await st(); ok([1,2,3].every(n=>!(s2.giorni&&s2.giorni[dd(n)])), "«Annulla» riporta i tre giorni com'erano");
    await p.click("[data-sg-intervallo]"); await p.click('[data-pen="copia"]'); await p.click('[data-sg="'+dd(1)+'"]'); await p.waitForTimeout(150);
    ok(await p.evaluate(()=>/7 giorni prima/.test(document.querySelector("#segnaOut .hint").textContent)), "«Come 7 giorni prima»: spiega cosa fa");
  }
  await p.click("[data-sg-annulla]").catch(()=>{});
}
await p.evaluate(()=>document.querySelector("#chiudiSegna").click()); await p.waitForTimeout(250);
ok(await p.evaluate(()=>!document.body.classList.contains("sg-segna-solo") && !document.body.classList.contains("sg-importa-sola")), "chiudendo, le due modalità si spengono");
await p.click("#tEdit"); await p.waitForTimeout(250); await p.click('[data-mod="importa"]'); await p.waitForTimeout(300);
ok(await p.evaluate(()=>document.body.classList.contains("sg-importa-sola")) && !(await vis(p,"#segnaOut")), "«Importa» nasconde il calendario");
await p.evaluate(()=>document.querySelector("#chiudiSegna").click()); await p.waitForTimeout(250);
// Mese: una riga, si apre
ok(await p.evaluate(()=>{ const d=document.querySelector("#meseBox .mese-det"); return !!d && !d.open && /turn/.test(d.querySelector("summary").textContent); }), "il mese è una riga sola (ore, turni, notti)");
await p.click("#meseBox .mese-det summary"); await p.waitForTimeout(200);
ok(await p.evaluate(()=>document.querySelector("#meseBox .mese-det").open && !!document.querySelector("#meseBox .mese-num")), "toccandola si aprono i numeri");
// Condividi: un foglio
await p.click("#doCondividi"); await p.waitForTimeout(250);
ok(await vis(p,"#condividiModal") && await p.evaluate(()=>document.querySelector("#condividiCorpo").children.length>0), "«Condividi» apre un foglio con le azioni");
console.log("errori", errs); await b.close();
