// Grafici: le barre del tempo hanno i riferimenti orari (e le etichette non
// escono dal riquadro), il picco di sonnolenza è un punto distinguibile dal
// turno, il voto per giorno ha i nomi interi e il valore in fondo alla barra,
// il debito di sonno è senza segno ridondante, il tempo libero un giorno per riga.
import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const fa=n=>{ const d=new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()-n); return iso(d); };
const pat="MPNSR", w={}, bd={}, diary={};
for(let i=1;i<=30;i++){ const c=pat[((-i)%5+5)%5]; w[fa(i)]= c==="N"?"13:30": c==="S"?"08:30":"05:45"; bd[fa(i)]= c==="N"?"08:15": c==="M"?"21:45":"23:30"; diary[fa(i)]= c==="N"?2: c==="S"?3: 4; }
const ST={turniConfigurati:true,pattern:pat,anchor:fa(0),repeat:true,firstSeenAt:fa(40),freeBed:"00:30",freeWake:"08:30",
  shifts:{M:{n:"Mattino",s:360,e:840},P:{n:"Pomeriggio",s:840,e:1320},N:{n:"Notte",s:1320,e:1800}},pPattern:"MPNSR"};
const ctx=await b.newContext({locale:"it-IT",viewport:{width:360,height:740}});
await ctx.addInitScript(([st,ex])=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
  localStorage.setItem("nt:state",JSON.stringify(st)); localStorage.setItem("nt:turniConfigurati","true");
  for(const k in ex) localStorage.setItem(k,ex[k]); },
  [ST,{"nt:wakes":JSON.stringify(w),"nt:beds":JSON.stringify(bd),"nt:diary":JSON.stringify(diary),"nt:firstPlanBannerChiuso":"true","nt:attivazioneNascosta":"true"}]);
const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
const dieci=new Date(); dieci.setHours(10,0,0,0); await p.clock.setFixedTime(dieci);
await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(1200);
const clic=s=>p.evaluate(s=>document.querySelector(s).click(),s);

// Oggi: la striscia della giornata
const fg=await p.evaluate(()=>{ const svg=document.querySelector("#formaGiorno svg"), r=svg.getBoundingClientRect();
  const testi=[...svg.querySelectorAll("text")].map(t=>({t:t.textContent, l:t.getBoundingClientRect().left, rr:t.getBoundingClientRect().right}));
  return {ore:testi.map(x=>x.t), dentro:testi.every(x=>x.l>=r.left-1 && x.rr<=r.right+1), picco:!!svg.querySelector('circle[fill="var(--picco)"]')}; });
ok(fg.ore.length>=3 && fg.ore.every(t=>/^(00|06|12|18):00$/.test(t)), "Oggi: la striscia ha le ore di riferimento → "+fg.ore.join(" "));
ok(fg.dentro, "Oggi: nessuna etichetta oraria esce dalla striscia");
ok(fg.picco, "Oggi: il picco di sonnolenza è un punto ad anello, non un tratto del colore del turno");

// Turni: la griglia del ciclo
await clic('[data-tab="turni"]'); await p.waitForTimeout(300);
const cy=await p.evaluate(()=>{ const box=document.querySelector("#cyc").getBoundingClientRect();
  const et=[...document.querySelectorAll("#cyc .caxis .crail span")].map(s=>({t:s.textContent, r:s.getBoundingClientRect()}));
  return {ore:et.map(x=>x.t), dentro:et.every(x=>x.r.left>=box.left && x.r.right<=box.right), linee:document.querySelectorAll("#cyc .cgrid i").length}; });
ok(cy.ore.length>=4 && cy.ore.includes("00:00"), "Turni: asse orario sopra la griglia, con la mezzanotte → "+cy.ore.join(" "));
ok(cy.dentro, "Turni: le etichette dell'asse restano nel riquadro");
ok(cy.linee>=cy.ore.length && cy.linee<=cy.ore.length+2, "Turni: una linea sottile per ogni ora (sul bordo la linea senza etichetta)");
const vicine=await p.evaluate(()=>{ const r=[...document.querySelectorAll("#cyc .caxis .crail span")].map(s=>s.getBoundingClientRect());
  return r.some((x,i)=>i && x.left-r[i-1].right<8); });
ok(!vicine, "Turni: le etichette dell'asse non si toccano");

// Tempo libero: un giorno per riga
await clic("#doPartner"); await p.waitForTimeout(300);
const giorni=await p.evaluate(()=>{ const r=document.querySelector("#partner .rows"); return r ? [...r.querySelectorAll(".row b")].map(b=>b.textContent) : []; });
ok(giorni.length>0 && new Set(giorni).size===giorni.length, "Tempo libero: nessun giorno ripetuto → "+giorni.join(" | "));
await p.evaluate(()=>document.querySelector("#chiudiVederci")?.click());

// Sonno e carico
await clic('[data-tab="turni"]'); await clic("#doAndamenti"); await p.waitForTimeout(400);
const an=await p.evaluate(()=>{ const num=document.querySelector(".andamento-num");
  const righe=[...document.querySelectorAll(".vrow")].map(r=>({n:r.querySelector(".vlab").textContent, v:r.querySelector(".vval").textContent, giu:r.classList.contains("giu")}));
  return {num:num&&num.textContent, righe}; });
ok(an.num && /^\d/.test(an.num), "Debito di sonno: il numero senza segno (l'etichetta dice se manca) → "+an.num);
ok(an.righe.length===5 && an.righe.every(r=>r.n.length>2) && an.righe.every(r=>/^\d,\d$/.test(r.v)), "Voto per giorno: nomi interi e valori con la virgola → "+an.righe.map(r=>r.n+" "+r.v).join(", "));
ok(an.righe.filter(r=>r.giu).length===1 && an.righe.find(r=>r.giu).n==="Notte", "Voto per giorno: evidenziato solo il giorno che pesa di più (Notte)");
{ const pf=await p.evaluate(()=>{ const sez=[...document.querySelectorAll("#andamenti .eyebrow")].find(e=>/turno per turno/.test(e.textContent)); const box=sez&&sez.nextElementSibling;
    return box ? {righe:[...box.querySelectorAll(".frow")].map(r=>r.querySelector(".flab").childNodes[0].textContent), frase:(box.querySelector(".fnota")||{}).textContent||"", colori:[...box.querySelectorAll(".fbar i")].map(i=>i.style.background)} : null; });
  ok(pf && pf.righe.length>=3 && pf.righe.includes("Notte") && new Set(pf.colori).size===pf.colori.length, "Come dormi, turno per turno: una riga per ogni fascia che c'è, ciascuna con il suo colore → "+JSON.stringify(pf&&pf.righe));
  ok(pf && /meno del previsto|vicino al sonno previsto/.test(pf.frase), "e una frase su dove il sonno va protetto → "+(pf&&pf.frase)); }
// le notti del grafico e la striscia del carico portano il colore della fascia, e la legenda dice solo quelle che ci sono
ok(await p.evaluate(()=>{ const l=[...document.querySelectorAll("#andamenti .grf-leg, #andamenti .car-leg")].map(x=>x.textContent).join(" "); return /mattina/.test(l) && /pomeriggio/i.test(l) && /notte/i.test(l) && !/sera/i.test(l); }), "legende per fascia: mattina, pomeriggio e notte (il ciclo non ha la sera)");

// i grafici di «Sonno e carico»: la forma dei dati, non solo il numero
const gr=await p.evaluate(()=>({
  barre:document.querySelectorAll(".andamento-hero svg.grf rect.g-notte").length, manca:document.querySelectorAll(".andamento-hero svg.grf rect.g-manca").length,
  turni:document.querySelectorAll(".andamento-hero svg.grf circle.g-turno").length, etBarre:document.querySelector(".andamento-hero svg.grf").getAttribute("aria-label"),
  oro:(document.querySelector("#orologio svg.grf")||{getAttribute:()=>""}).getAttribute("aria-label"), oroTesti:document.querySelectorAll("#orologio svg.grf text").length,
  celle:document.querySelectorAll(".car-striscia svg rect.g-gg").length, oggi:document.querySelectorAll(".car-striscia svg rect.g-oggi").length, etCar:(document.querySelector(".car-striscia svg")||{getAttribute:()=>""}).getAttribute("aria-label"),
  punti:document.querySelectorAll("svg.grf circle.g-punto").length, voti:document.querySelectorAll(".vrow .vdot").length }));
ok(gr.barre===30 && gr.manca>0 && gr.manca<gr.barre && gr.turni>0, "Sonno che ti manca: una barra per notte ("+gr.barre+"), alcune sotto il previsto ("+gr.manca+"), i puntini dei turni ("+gr.turni+")");
ok(/Ore dormite nelle ultime 30 notti: in media .* contro .* previste; \d+ notti sotto il previsto/.test(gr.etBarre||""), "Sonno che ti manca: il grafico ha un testo per chi legge lo schermo → "+gr.etBarre);
ok(/melatonina dalle \d\d:\d\d, minimo corporeo alle \d\d:\d\d/.test(gr.oro||"") && gr.oroTesti===5, "Il tuo orologio: la fascia delle 24 ore con le 5 ore di riferimento e il testo → "+gr.oro);
ok(gr.celle===60 && gr.oggi===1 && /notti, \d+ altri turni/.test(gr.etCar||""), "Carico: 60 giorni (30 passati, 30 in arrivo), oggi cerchiato → "+gr.etCar);
ok(gr.punti===60, "Orari del sonno: un punto per notte, letto e sveglia ("+gr.punti+")");
ok(gr.voti===30, "Come stai: un puntino per ogni voto ("+gr.voti+")");


// la striscia del carico segna i giorni a rischio: meno di 11 ore fra due turni, e la quarta notte di fila
for(const [pat,shifts,nome,min] of [["PMR",{M:{n:"Mattino",s:360,e:840},P:{n:"Pomeriggio",s:840,e:1320}},"meno di 11 ore",15],["NNNNRR",{N:{n:"Notte",s:1320,e:1800}},"quarta notte di fila",8]]){
  const c2=await b.newContext({locale:"it-IT",viewport:{width:360,height:740}});
  await c2.addInitScript(st=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1"); localStorage.setItem("nt:state",JSON.stringify(st)); localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:firstPlanBannerChiuso","true"); localStorage.setItem("nt:attivazioneNascosta","true"); },
    {turniConfigurati:true,pattern:pat,anchor:fa(0),repeat:true,firstSeenAt:fa(40),freeBed:"00:30",freeWake:"08:30",shifts});
  const q=await c2.newPage(); q.on("pageerror",e=>errs.push(e.message)); await q.clock.setFixedTime(dieci);
  await q.goto("http://localhost:8765/index.html"); await q.waitForTimeout(1000);
  await q.evaluate(()=>document.querySelector('[data-tab="turni"]').click()); await q.waitForTimeout(300); await q.evaluate(()=>document.querySelector("#doAndamenti").click()); await q.waitForTimeout(500);
  const rs=await q.evaluate(()=>({r:document.querySelectorAll(".car-striscia svg rect.g-rischio").length, riga:[...document.querySelectorAll(".car-r")].find(x=>/Riposi sotto/.test(x.textContent))?.textContent}));
  ok(rs.r>=min, "Carico, "+nome+": i giorni a rischio hanno il contorno rosso ("+rs.r+" nei 60 giorni)");
  await c2.close(); }

console.log("errori", errs); await b.close();
