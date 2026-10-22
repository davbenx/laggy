// Il piano della giornata come timeline: l'ora a sinistra, il nodo sulla
// linea, titolo e dettaglio; le voci passate sbiadiscono, il segno «ora» sta
// fra passato e futuro, «Poi» sotto «Adesso», le scelte sul sonno attaccate a
// «Dormi». Niente schede (bordo, ombra, sfondo) per voce.
import pw from "./_pw.mjs";
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
  const luce=g.find(x=>x.titolo==="Luce"), turno=g.find(x=>x.titolo==="Turno"), caffe=g.find(x=>x.titolo==="Caffè"), dormi=g.find(x=>x.titolo==="Dormi");
  ok(luce && /\bpast\b/.test(luce.cls), "alle 10 la Luce delle 05:05 è passata (sbiadita)");
  ok(turno && /\bora\b/.test(turno.cls) && !/\bpast\b/.test(turno.cls), "il turno 06:00–14:00 è in corso");
  ok(caffe && !/\b(past|ora)\b/.test(caffe.cls), "il caffè delle 14:20 è ancora da venire");
  ok(/fino alle 14:00/.test(turno.sotto) && /^06:00$/.test(turno.ora), "intervallo: l'inizio nella colonna dell'ora, la fine sotto il titolo → "+turno.ora+" | "+turno.sotto);
  ok(/^Stanotte 22:20$/.test(dormi.ora) && /^fino alle 06:20 · 8h$/.test(dormi.sotto), "Dormi: «Stanotte 22:20» e «fino alle 06:20 · 8h» → "+dormi.ora+" | "+dormi.sotto);
  const pos=await p.evaluate(()=>{ const a=document.querySelector(".tl-adesso"); if(!a) return null;
    const prima=[...document.querySelectorAll("#essenziale .tl")].filter(x=>x.getBoundingClientRect().bottom<=a.getBoundingClientRect().top+1).map(x=>x.querySelector(".el").textContent);
    return {ora:a.querySelector(".en").textContent, prima}; });
  ok(pos && pos.ora==="10:00" && pos.prima.join()==="Luce", "il segno «ora» (10:00) sta fra le voci passate e le altre → "+JSON.stringify(pos));
  const poi=await p.evaluate(()=>{ const e=document.querySelector("#ora .ora-poi"); return e ? e.textContent : null; });
  ok(poi==="Poi · ultimo caffè entro le 14:20", "sotto «Adesso»: il passo dopo → "+poi);
  ok(await p.evaluate(()=>document.querySelector(".tl-first .el").textContent==="Luce" && document.querySelector(".tl-last .el").textContent==="Dormi"), "la linea comincia sulla prima voce e finisce sull'ultima");
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

// le scelte sul sonno stanno attaccate a Dormi (riposo prima di un mattino alle 06:00)
{ const p=await apri({turniConfigurati:true,pattern:"RM",anchor:iso(new Date()),shifts:{M:{n:"Mattino",s:360,e:840}},repeat:true,firstSeenAt:"2026-01-01"}, 10);
  const dentro=await p.evaluate(()=>{ const s=document.querySelector('[data-row="sonno"]').closest(".tl"); const x=s.querySelector(".tl-extra .dopo-notte"); return !!x && x.querySelectorAll("[data-mattinobif]").length===2; });
  ok(dentro, "«Tutto stanotte / Più tardi + pisolino» sta dentro la voce Dormi, sempre visibile");
  await p.context().close(); }

// telefono stretto: niente scorrimento orizzontale, testo non tagliato
{ const p=await apri(base, 10, 320);
  const w=await p.evaluate(()=>({sc:document.documentElement.scrollWidth, iw:innerWidth, fuori:[...document.querySelectorAll("#essenziale .tl")].filter(x=>x.getBoundingClientRect().right>innerWidth+1).length}));
  ok(w.sc<=w.iw && w.fuori===0, "320 px: nessuno scorrimento orizzontale → "+w.sc+"/"+w.iw);
  await p.context().close(); }

// il dettaglio si apre sul posto, sotto il nodo (più largo, per leggere il perché)
{ const p=await apri(base, 10);
  await p.click('[data-row="caffe"] summary'); await p.waitForTimeout(200);
  const d=await p.evaluate(()=>{ const ed=document.querySelector('[data-row="caffe"] .ed'), nodo=document.querySelector('[data-row="caffe"] .enodo');
    return {aperto:document.querySelector('[data-row="caffe"]').open, testo:ed.innerText.length, larg:Math.round(ed.getBoundingClientRect().width-parseFloat(getComputedStyle(ed).paddingLeft)),
      sx:Math.round(ed.getBoundingClientRect().left+parseFloat(getComputedStyle(ed).paddingLeft)-nodo.getBoundingClientRect().left)}; });
  ok(d.aperto && d.testo>40 && Math.abs(d.sx)<=2 && d.larg>=240, "il dettaglio si apre sul posto, allineato al nodo, largo "+d.larg+" px (scarto "+d.sx+" px)");
  await p.context().close(); }

console.log("errori", errs); await b.close();
