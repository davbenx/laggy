// «Sonno e carico»: sezioni chiuse con una riga che dice l'essenziale; le notti dormite di giorno (dopo il turno) non si
// mescolano a quelle di notte nella regolarità; l'asse delle 24 ore ha le cinque ore di riferimento distinte e dentro il disegno.
import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const oggi=new Date(); oggi.setHours(12,0,0,0);
const ST={turniConfigurati:true,pattern:"MMPPNNRR",anchor:iso(oggi),shifts:{M:{n:"Mattino",s:360,e:855},P:{n:"Pomeriggio",s:840,e:1335},N:{n:"Notte",s:1320,e:1815}},repeat:true,firstSeenAt:"2026-01-01",freeBed:"00:30",freeWake:"09:45"};
const ctx=await b.newContext({locale:"it-IT",viewport:{width:390,height:844}});
await ctx.addInitScript(st=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
  const w={},bd={},dia={}; for(let i=1;i<=16;i++){ const d=new Date(); d.setDate(d.getDate()-i); const k=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
    if(i%3===0){ bd[k]="07:50"; w[k]="15:40"; } else { bd[k]=["00:20","00:50","23:50","00:35"][i%4]; w[k]=["07:10","06:30","08:00","07:40"][i%4]; } dia[k]=2+(i%4); }
  localStorage.setItem("nt:state",JSON.stringify(st)); localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:wakes",JSON.stringify(w)); localStorage.setItem("nt:beds",JSON.stringify(bd)); localStorage.setItem("nt:diary",JSON.stringify(dia));
  localStorage.setItem("nt:firstPlanBannerChiuso","true"); localStorage.setItem("nt:attivazioneNascosta","true"); },ST);
const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(1000);
await p.evaluate(()=>document.querySelector('[data-tab="turni"]').click()); await p.waitForTimeout(300);
await p.evaluate(()=>document.querySelector("#doAndamenti").click()); await p.waitForTimeout(500);
const voci=await p.evaluate(()=>[...document.querySelectorAll("#andamenti .and-hub .opz-hub-r")].map(b=>({id:b.dataset.andSez, t:b.querySelector("b").textContent, r:b.querySelector(".opz-val").textContent})));
ok(voci.length===4 && voci.every(v=>v.r.length>3), "un elenco di quattro voci come le Impostazioni, ognuna con la sua riga: "+voci.map(v=>v.t+" — "+v.r).join(" | "));
ok(await p.evaluate(()=>!!document.querySelector("#andamenti .andamento-hero") && !document.querySelector(".and-det")), "in alto resta il sonno che ti manca; niente fisarmoniche");
// una voce si apre nella sua pagina, con il titolo, e la freccia riporta all'elenco
await p.click('[data-and-sez="orari"]'); await p.waitForTimeout(250);
ok(await p.evaluate(()=>document.querySelector("#andamentiPagina .tab-title").textContent==="Gli orari del tuo sonno" && !document.querySelector("#andamenti .and-hub")), "aprendo una voce il titolo della pagina è il suo e l'elenco non c'è");
const g=await p.evaluate(()=>{ const d=document.querySelector("#andamenti #orari");
  return {nota:d.querySelector(".hint").textContent, pt:d.querySelectorAll("circle.g-punto").length, ass:[...d.querySelectorAll("svg.grf text")].filter(t=>/^\d\d:\d\d$/.test(t.textContent)).map(t=>+t.getAttribute("x"))}; });
ok(/notti dormite di notte/.test(g.nota) && /di giorno, dopo il turno/.test(g.nota), "le notti di giorno sono a parte: "+g.nota.slice(0,100));
ok(g.pt===22, "il grafico mostra solo il gruppo più numeroso (11 notti × letto e sveglia)");
ok(new Set(g.ass).size===5 && g.ass[0]>=15 && g.ass[4]<=285 && g.ass.every((x,i)=>!i||x>g.ass[i-1]), "asse: cinque ore distinte, in ordine e dentro il disegno → "+g.ass.join(","));
await p.click("#chiudiAndamenti"); await p.waitForTimeout(200);
ok(await p.evaluate(()=>document.body.classList.contains("andamenti-aperta") && !!document.querySelector("#andamenti .and-hub") && document.querySelector("#andamentiPagina .tab-title").textContent==="Sonno e carico"), "la freccia torna all'elenco; una seconda chiude la pagina");
await p.click("#chiudiAndamenti"); await p.waitForTimeout(200);
ok(await p.evaluate(()=>!document.body.classList.contains("andamenti-aperta")), "e si torna a Turni");
ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), "niente scorrimento laterale");
console.log("errori", errs); await b.close();
