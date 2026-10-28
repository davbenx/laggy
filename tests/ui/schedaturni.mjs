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
ok(await p.evaluate(()=>{ const g=document.querySelector("#strumenti"); return !!g && ["doPartner","doAndamenti","doFerie","doScambioTurno"].every(i=>g.contains(document.getElementById(i))); }), "gli strumenti stanno in una griglia sola");
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
