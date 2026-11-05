// Il piano della giornata come timeline: l'ora a sinistra, il nodo sulla
// linea, titolo e dettaglio; le voci passate sbiadiscono, il segno «ora» sta
// fra passato e futuro, «Poi» sotto «Adesso», le scelte sul sonno attaccate a
// «Dormi». Niente schede (bordo, ombra, sfondo) per voce.
import pw from "./_pw.mjs";
import { apriVoce, testoVoce, chiudiVoce } from "./_info.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const TURNI={M:{n:"Mattino",s:360,e:840},P:{n:"Pomeriggio",s:840,e:1320},N:{n:"Notte",s:1320,e:1800}};
async function apri(st, ora=10, w=360){
  const ctx=await b.newContext({locale:"it-IT",viewport:{width:w,height:740}});
  await ctx.addInitScript(st=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
    localStorage.setItem("nt:state",JSON.stringify(st)); localStorage.setItem("nt:turniConfigurati","true");
    localStorage.setItem("nt:firstPlanBannerChiuso","true"); localStorage.setItem("nt:attivazioneNascosta","true"); }, st);
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  const d=new Date(); d.setHours(ora,0,0,0); await p.clock.setFixedTime(d);
  await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(1200);
  return p;
}
const base={turniConfigurati:true,pattern:"MPNSR",anchor:iso(new Date()),repeat:true,firstSeenAt:"2026-01-01",shifts:TURNI};

{ const p=await apri(base, 10);
  const g=await p.evaluate(()=>{ const t=[...document.querySelectorAll("#essenziale .tl")];
    return t.map(x=>{ const e=x.querySelector(".en").getBoundingClientRect(), n=x.querySelector(".enodo").getBoundingClientRect(), v=x.querySelector(".ev").getBoundingClientRect();
      const r=x.querySelector(".essrow"), cs=getComputedStyle(r);
      return {titolo:x.querySelector(".el").textContent, ora:x.querySelector(".en").innerText.replace(/\s+/g," ").trim(), cls:x.className, sotto:(x.querySelector(".es")||{}).textContent||"",
        ordine:e.right<=n.left && n.right<=v.left, scheda:cs.boxShadow!=="none" || cs.borderTopWidth!=="0px" || cs.backgroundColor!=="rgba(0, 0, 0, 0)"}; }); });
  ok(g.length>=5, "il piano è una timeline di voci → "+g.map(x=>x.titolo).join(", "));
  ok(g.every(x=>x.ordine), "ogni voce: ora, poi nodo, poi testo, da sinistra a destra");
  ok(g.every(x=>!x.scheda), "nessuna scheda per voce: niente bordo, ombra o sfondo");
  const luce=g.find(x=>x.titolo==="Luce"), turno=g.find(x=>x.titolo==="Turno"), caffe=g.find(x=>x.titolo==="Caffeina"), dormi=g.find(x=>x.titolo==="Dormi");
  ok(luce && /\bpast\b/.test(luce.cls), "alle 10 la Luce delle 05:05 è passata (sbiadita)");
  ok(turno && /\bora\b/.test(turno.cls) && !/\bpast\b/.test(turno.cls), "il turno 06:00–14:00 è in corso");
  ok(caffe && !/\b(past|ora)\b/.test(caffe.cls), "il caffè delle 14:20 è ancora da venire");
  ok(/fino alle 14:00/.test(turno.sotto) && /^06:00$/.test(turno.ora), "intervallo: l'inizio nella colonna dell'ora, la fine sotto il titolo → "+turno.ora+" | "+turno.sotto);
  ok(/^Stanotte 22:20$/.test(dormi.ora) && /^fino alle 06:20 · 8h$/.test(dormi.sotto), "Dormi: «Stanotte 22:20» e «fino alle 06:20 · 8h» → "+dormi.ora+" | "+dormi.sotto);
  const pos=await p.evaluate(()=>{ const a=document.querySelector(".tl-adesso"); if(!a) return null;
    const prima=[...document.querySelectorAll("#essenziale .tl")].filter(x=>x.getBoundingClientRect().bottom<=a.getBoundingClientRect().top+1).map(x=>x.querySelector(".el").textContent);
    return {ora:a.querySelector(".en").textContent, prima}; });
  ok(pos && pos.ora==="10:00" && pos.prima.join()==="Risveglio lento,Luce,Turno", "il segno «ora» (10:00) sta dopo ogni voce già cominciata (anche il turno in corso), prima delle altre → "+JSON.stringify(pos));
  const poi=await p.evaluate(()=>{ const e=document.querySelector("#ora .ora-poi"); return e ? e.textContent : null; });
  ok(poi==="Poi · ultima caffeina entro le 14:20", "sotto «Adesso»: il passo dopo → "+poi);
  ok(await p.evaluate(()=>document.querySelector(".tl-first .el").textContent==="Risveglio lento" && document.querySelector(".tl-last .el").textContent==="Dormi"), "la linea comincia sulla prima voce e finisce sull'ultima");
  // la linea è continua: le voci si toccano, senza spazi che la spezzano
  const buchi=await p.evaluate(()=>{ const t=[...document.querySelectorAll("#essenziale .tl")].map(x=>x.getBoundingClientRect()); return t.slice(1).map((r,i)=>Math.round(r.top-t[i].bottom)).filter(d=>d>2); });
  ok(buchi.length<=1, "nessuno spazio fra le voci tranne al più il segno «ora» → "+JSON.stringify(buchi));
  await p.click("#next"); await p.waitForTimeout(250);
  const altro=await p.evaluate(()=>({adesso:!!document.querySelector(".tl-adesso"), poi:!!document.querySelector(".ora-poi"), passate:document.querySelectorAll("#essenziale .tl.past").length}));
  ok(!altro.adesso && !altro.poi && altro.passate===0, "su un altro giorno niente «ora», «Poi» né voci sbiadite");
  await p.context().close(); }

// «Poi» non ripete quello che «Adesso» dice già: alle 08:30 prima di un turno di mezzogiorno
{ const p=await apri({...base, pattern:"MMMMM", shifts:{M:{n:"Mattino",s:780,e:1260}}}, 9);
  const t=await p.evaluate(()=>({sub:document.querySelector("#ora .ora-sub").textContent, poi:(document.querySelector("#ora .ora-poi")||{}).textContent||""}));
  const ore=(t.poi.match(/\d\d:\d\d/)||[])[0];
  ok(!ore || !t.sub.includes(ore), "«Poi» non ripete un orario che «Adesso» ha già detto → «"+t.sub+"» / «"+t.poi+"»");
  await p.context().close(); }

// le scelte sul sonno stanno nella scheda «Il tuo sonno» (riposo prima di un mattino alle 06:00), non sotto «Dormi»
{ const p=await apri({turniConfigurati:true,pattern:"RM",anchor:iso(new Date()),shifts:{M:{n:"Mattino",s:360,e:840}},repeat:true,firstSeenAt:"2026-01-01"}, 10);
  const o=await p.evaluate(()=>({nellaScheda:!!document.querySelector("#essenziale .drem .dopo-notte [data-mattinobif]"), sottoDormi:!!document.querySelector('#essenziale [data-row="sonno"]').closest(".tl").nextElementSibling.querySelector(".dopo-notte"), card:!!document.querySelector("#essenziale .drem")}));
  ok(o.card && o.nellaScheda && !o.sottoDormi, "«Tutto stanotte / Più tardi + pisolino» sta nella scheda «Il tuo sonno», non sotto «Dormi» → "+JSON.stringify(o));
  await p.context().close(); }

// telefono stretto: niente scorrimento orizzontale, testo non tagliato
{ const p=await apri(base, 10, 320);
  const w=await p.evaluate(()=>({sc:document.documentElement.scrollWidth, iw:innerWidth, fuori:[...document.querySelectorAll("#essenziale .tl")].filter(x=>x.getBoundingClientRect().right>innerWidth+1).length}));
  ok(w.sc<=w.iw && w.fuori===0, "320 px: nessuno scorrimento orizzontale → "+w.sc+"/"+w.iw);
  await p.context().close(); }

// il dettaglio si apre sul posto, sotto il nodo (più largo, per leggere il perché)
{ const p=await apri(base, 10);
  const altezza=()=>p.evaluate(()=>document.querySelector("#essenziale").getBoundingClientRect().height);
  await apriVoce(p,"caffe"); await chiudiVoce(p);   // la prima volta sparisce la frase «Tocca una voce…»
  const h0=await altezza(); await apriVoce(p,"caffe");
  const d=await p.evaluate(()=>{ const m=document.querySelector("#infoModal"), c=document.querySelector("#infoCorpo");
    return {visibile:!m.hidden, titolo:document.querySelector("#infoTitolo").textContent, testo:c.innerText.length, larg:Math.round(c.getBoundingClientRect().width), info:!!document.querySelector('#essenziale [data-row="caffe"] .einfo svg')}; });
  ok(d.visibile && d.titolo.length>2 && d.testo>40 && d.larg>=240 && d.info, "il perché si apre in un foglio («"+d.titolo+"», largo "+d.larg+" px) e la voce ha l'icona ⓘ");
  ok(await altezza()===h0, "la timeline non cambia altezza: il dettaglio non è dentro la lista");
  await chiudiVoce(p); ok(await p.evaluate(()=>document.querySelector("#infoModal").hidden), "✕ chiude il foglio");
  await p.context().close(); }

// La linea «adesso» fra passato e futuro su molti giorni e ore (bug del 05/11/2026: alle 15:42 di un giorno libero
// la «Luce bassa» delle 08:00 di domattina risultava «passata» e la linea finiva in fondo, dopo «Dormi»).
// Il caso del 05/11/2026 riprodotto: il calcolo della luce (worker finto) dice per oggi luce forte 18:00–22:00 e
// luce bassa 08:00–11:00, cioè stamattina appena sveglio. Alle 15:42 la «Luce bassa» va in testa (passata), non dopo «Dormi».
{ const ctx=await b.newContext({locale:"it-IT",viewport:{width:360,height:740}});
  await ctx.route("**/luce-worker.js", r=>r.fulfill({contentType:"text/javascript",
    body:"self.onmessage=e=>postMessage({chiave:e.data.chiave, giorni:[{g:0, cerca:[1080,1320], evita:[480,660]}]});"}));
  await ctx.addInitScript(st=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
    localStorage.setItem("nt:state",JSON.stringify(st)); localStorage.setItem("nt:turniConfigurati","true");
    localStorage.setItem("nt:firstPlanBannerChiuso","true"); localStorage.setItem("nt:attivazioneNascosta","true"); },
    {...base,pattern:"RRNNNN",anchor:iso(new Date()),freeBed:"23:20",freeWake:"09:20",piano:{luce:true,penombra:true,pasti:true,liberi:true}});
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  const d=new Date(); d.setHours(15,42,0,0); await p.clock.setFixedTime(d);
  await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(6000);
  const r=await p.evaluate(()=>[...document.querySelectorAll("#essenziale .tl, #essenziale .tl-adesso")].map(x=>x.classList.contains("tl-adesso")?"ADESSO":(x.dataset.row||x.querySelector("[data-row]")?.dataset.row||"?")+(x.classList.contains("past")?"·p":"")));
  const iO=r.findIndex(x=>x.startsWith("penombra")), iA=r.indexOf("ADESSO"), iS=r.findIndex(x=>x.startsWith("sonno"));
  ok(iO>=0 && iO<iA && iO<iS && r[iO].endsWith("·p"), "luce bassa di stamattina (08:00–11:00) in testa e passata, la linea «adesso» prima di Luce e Dormi → "+r.join(" "));
  await ctx.close(); }

// Invariante: prima della linea solo voci passate o in corso, dopo nessuna voce passata.
{ const fa=n=>{ const d=new Date(); d.setDate(d.getDate()+n); return iso(d); };
  const casi=[]; 
  for (const [pat,anc] of [["MPNSR",0],["MPNSR",-3],["MPNSR",-4],["NNNRR",-3],["NNNRR",-4],["RRRRR",0]])
    for (const ora of [9,12,15.7,19,22]) casi.push([pat,anc,ora]);
  const male=[];
  for (const [pat,anc,ora] of casi){
    const p=await apri({...base,pattern:pat,anchor:fa(anc),freeBed:"23:20",freeWake:"09:20"}, Math.floor(ora));
    if(ora%1){ const d=new Date(); d.setHours(Math.floor(ora),Math.round(ora%1*60),0,0); await p.clock.setFixedTime(d); await p.reload(); await p.waitForTimeout(1000); }
    const r=await p.evaluate(()=>{ const el=[...document.querySelectorAll("#essenziale .tl, #essenziale .tl-adesso")];
      const k=el.findIndex(x=>x.classList.contains("tl-adesso")); if(k<0) return null;
      const prima=el.slice(0,k).filter(x=>!x.classList.contains("past") && !x.classList.contains("ora")).map(x=>x.querySelector(".en")?.textContent);
      const dopo=el.slice(k+1).filter(x=>x.classList.contains("past")).map(x=>x.querySelector(".en")?.textContent);
      return {prima,dopo}; });
    if(r && (r.prima.length || r.dopo.length)) male.push(pat+"/"+anc+" "+ora+": "+JSON.stringify(r));
    await p.context().close(); }
  ok(!male.length, "la linea «adesso» sta fra passato e futuro in "+casi.length+" casi (giorni del ciclo × ore) → "+male.slice(0,3).join(" | "));
}

console.log("errori", errs); await b.close();
