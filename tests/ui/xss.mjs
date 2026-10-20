// Testi esterni (link condivisi, dati salvati da versioni vecchie o
// importati) non diventano mai codice: nomi di turni e persone con markup
// arrivano da link e da stato salvato, si aprono tutte le schermate e
// nessun gestore inline deve partire.
import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const X='<img src=x onerror="window.__x=(window.__x||0)+1">';
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const fa=n=>{ const d=new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()-n); return iso(d); };
const SH={M:{n:"Mat"+X,s:420,e:840},N:{n:X,s:1260,e:1860}};
const tab0=(p,t)=>p.evaluate(t=>document.querySelector('[data-tab="'+t+'"]').click(), t);
const giro=async p=>{
  const tab=t=>p.evaluate(t=>document.querySelector('[data-tab="'+t+'"]').click(), t);
  for(const t of ["oggi","turni","oggi"]){ await tab(t); await p.waitForTimeout(250); }
  await p.evaluate(()=>document.querySelector("#doOpzioni").click()); await p.waitForTimeout(250);
  await p.evaluate(()=>{ for(const b of document.querySelectorAll("[data-opz]")) b.click(); }); await p.waitForTimeout(250);
  await p.evaluate(()=>{ const c=document.querySelector("#chiudiOpzioni"); if(c) c.click(); }); await p.waitForTimeout(250); await tab("turni");
  await p.evaluate(()=>{ const r=document.querySelector('#cyc .crow[data-off="1"]'); if(r) r.click(); }); await p.waitForTimeout(250);
  await p.evaluate(()=>{ const c=document.querySelector("#qsClose"); if(c) c.click(); });
  // le pagine di Turni: ognuna si apre e si richiude
  for(const sel of ["#doPartner","#doFerie","#doAndamenti","#doScambioTurno"]){
    await p.evaluate(s=>{ const b=document.querySelector(s); if(b) b.click(); }, sel); await p.waitForTimeout(300);
    await p.evaluate(()=>{ const b=[...document.querySelectorAll("button")].find(x=>x.offsetParent && /^(←|Indietro|Chiudi)/.test((x.getAttribute("aria-label")||x.textContent).trim())); if(b) b.click(); }); await p.waitForTimeout(200);
  }
};
// 1. dallo stato salvato
let ctx=await b.newContext({locale:"it-IT",viewport:{width:360,height:740}});
await ctx.addInitScript(([st])=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
  localStorage.setItem("nt:state",JSON.stringify(st)); localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:firstPlanBannerChiuso","true"); },
  [{turniConfigurati:true,pattern:"MNRR",anchor:fa(1),shifts:SH,repeat:true,firstSeenAt:fa(30),pName:X,pPattern:"MMRR",pAnchor:fa(2),
    people:[{name:X,pattern:"NNRR",anchor:fa(3),shifts:SH}]}]);
let p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message)); p.on("dialog",d=>d.dismiss());
await p.goto(process.env.URL||"http://localhost:8765/index.html"); await p.waitForTimeout(1000);
await giro(p);
ok(!(await p.evaluate(()=>window.__x)), "stato salvato con markup nei nomi: nessuno script parte");
await tab0(p,"turni");
ok(await p.evaluate(()=>/&lt;img src=x onerror/.test(document.body.innerHTML)), "i nomi ci sono, come testo (il controllo sopra non è a vuoto)");
await ctx.close();
// 2. da un link condiviso (configurazione e persona)
ctx=await b.newContext({locale:"it-IT",viewport:{width:360,height:740}});
p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message)); p.on("dialog",d=>d.dismiss());
const sh="M:"+encodeURIComponent("A"+X)+":420:840|N:"+encodeURIComponent(X)+":1260:1860";
const ppl=encodeURIComponent(JSON.stringify([{p:"NNRR",a:fa(3),n:X,s:{N:{n:X,s:1260,e:1860}}}]));
await p.goto((process.env.URL||"http://localhost:8765/index.html")+"#p=MNRR&a="+fa(1)+"&s="+sh+"&pn="+encodeURIComponent(X)+"&pp=MMRR&ppl="+ppl);
await p.waitForTimeout(1200);
await p.evaluate(()=>{ for(const id of ["linkReplace","linkAsPerson"]){ const b=document.getElementById(id); if(b && b.offsetParent){ b.click(); break; } } }); await p.waitForTimeout(400);
await giro(p);
ok(!(await p.evaluate(()=>window.__x)), "link con markup nei nomi: nessuno script parte");
await ctx.close();
ok(!errs.length, "nessun errore di pagina "+JSON.stringify(errs));
await b.close();
