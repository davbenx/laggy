// Widget Android (Capacitor finto): cosa riceve il widget (voci, prossimo turno anche fra giorni, domanda del
// diario, calendario con le persone) e le risposte date dal widget, applicate senza sovrascrivere.
import pw from "./_pw.mjs";
import { nativo } from "./_nativo.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const tra=n=>{ const d=new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()+n); return iso(d); };
const SH={M:{n:"Mattino",s:420,e:840},P:{n:"Pomeriggio",s:840,e:1260},N:{n:"Notte",s:1260,e:1860}};
const apri=async(st, extra={}, risposte=null, ora=[16,0])=>{
  const ctx=await b.newContext({locale:"it-IT",viewport:{width:360,height:740}});
  await ctx.addInitScript(nativo);
  await ctx.addInitScript(([st,extra,risposte])=>{ if(risposte) window.__risposte=risposte;
    if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
    localStorage.setItem("nt:state",JSON.stringify(st)); localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:firstPlanBannerChiuso","true");
    for(const k in extra) localStorage.setItem("nt:"+k, JSON.stringify(extra[k])); }, [st,extra,risposte]);
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  // alle 16: finito il sonno dopo l'eventuale notte di ieri, «oggi» è il giorno di calendario
  const sera=new Date(); sera.setHours(ora[0],ora[1],0,0); await p.clock.setFixedTime(sera);
  await p.goto("http://localhost:8766/index.html"); await p.waitForTimeout(2600);
  return p;
};
// riposo per 4 giorni, poi una notte; ferie e reperibilità nella settimana
let p=await apri({turniConfigurati:true,pattern:"RRRRN",anchor:tra(0),shifts:SH,repeat:true,firstSeenAt:tra(-30),
  ecc:{[tra(1)]:"R"}, giorni:{[tra(1)]:{t:"ferie"}, [tra(2)]:{t:"reperibile"}}});
let W=await p.evaluate(()=>window.__widget);
ok(W && W.v===3 && W.voci.length>0, "il widget riceve le voci delle prossime 48 ore");
ok(W.turno && /Notte/.test(W.turno.t) && W.turno.s>Date.now()+3*864e5, "il prossimo turno c'è anche se è fra 4 giorni → "+(W.turno&&W.turno.t));
ok(W.diario && W.diario.d===tra(0) && /^\d\d:\d\d$/.test(W.diario.bed) && W.diario.a-W.diario.da===14*3600e3 && !W.diario.sonno && !W.diario.voto, "domanda del diario: orari del piano, per 8 ore dalla sveglia → "+JSON.stringify(W.diario));
await p.context().close();

// i miei cambi di un giorno (scambio, ferie) non si applicano alla persona seguita
{ const gi=n=>{ const d=new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()+n); return iso(d); };
  const q=await apri({turniConfigurati:true,pattern:"MMNRR",anchor:tra(0),shifts:SH,repeat:true,firstSeenAt:tra(-30),
    people:[{name:"Anna",pattern:"MMRR",anchor:gi(0)}], ecc:{[tra(3)]:"N"}, giorni:{[tra(1)]:{t:"ferie"}}});
  const M=(await q.evaluate(()=>window.__widget)).mese;
  const lun=new Date(); lun.setHours(12,0,0,0); lun.setDate(lun.getDate()-((lun.getDay()+6)%7)-28);
  const o=Math.round((new Date(tra(0)+"T12:00:00")-lun)/864e5);   // dov'è oggi nei dati
  ok(M.io[o+1].startsWith("Fe:") && M.io[o+3].startsWith("N:"), "le mie ferie (giorno 1) e il mio cambio in N (giorno 3) ci sono per me → "+M.io.slice(o,o+5).join(" "));
  ok(M.p[0].g.slice(o,o+6).join(" ")==="M:m M:m R:r R:r M:m M:m", "per Anna contano solo i suoi turni, non i miei cambi → "+M.p[0].g.slice(o,o+6).join(" "));
  await q.context().close(); }

// il calendario: da quattro lunedì fa per 20 settimane (140 giorni), la mia sigla e quella delle persone (la stellina sempre dentro, al massimo 4)
{ const gi=n=>{ const d=new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()+n); return iso(d); };
  const pers=[0,1,2,3,4,5].map(i=>({name:"P"+i, pattern:["MMRR","NNRR","MPRR","RRMM","PPNR","MRMR"][i], anchor:gi(i)}));
  const q=await apri({turniConfigurati:true,pattern:"MMNRR",anchor:tra(0),shifts:SH,repeat:true,firstSeenAt:tra(-30),people:pers,personaGlance:5,giorni:{[tra(1)]:{t:"ferie"}}});
  const M=(await q.evaluate(()=>window.__widget)).mese;
  const lun=new Date(); lun.setHours(12,0,0,0); lun.setDate(lun.getDate()-((lun.getDay()+6)%7)-28);
  ok(M && M.da===iso(lun) && M.io.length===140, "calendario: da quattro lunedì fa, 20 settimane (140 giorni)");
  ok(Math.round((new Date(tra(0)+"T12:00:00")-lun)/864e5)===28+((new Date().getDay()+6)%7), "calendario: oggi cade nella quinta settimana (quattro prima, quindici dopo)");
  ok(M.io.every(x=>/^[^:]+:[nlrmps?]$/.test(x)), "calendario: ogni giorno è «sigla:tipo» → "+M.io.slice(0,7).join(" "));
  const i1=Math.round((new Date(tra(1)+"T12:00:00")-lun)/864e5);
  ok(/^Fe:/.test(M.io[i1]), "calendario: le mie ferie compaiono con la sigla Fe");
  ok(M.p.length===4 && M.p.some(x=>x.n==="P5"), "calendario: al massimo 4 persone e la stellina (P5) c'è sempre → "+M.p.map(x=>x.n));
  ok(M.p[M.sel].n==="P5" && M.star==="5|P5", "calendario: sel punta alla stellina e la chiave la riconosce → "+M.sel+" "+M.star);
  ok(M.p.every(x=>x.g.length===140 && x.g.every(y=>/^[^:]+:[nlrmps?]$/.test(y))), "calendario: ogni persona ha 140 giorni");
  await q.context().close();
  const r=await apri({turniConfigurati:true,pattern:"MMNRR",anchor:tra(0),shifts:SH,repeat:true,firstSeenAt:tra(-30)});
  const M2=(await r.evaluate(()=>window.__widget)).mese;
  ok(M2 && M2.p.length===0 && M2.star==="" && M2.io.length===140, "calendario senza persone: solo le mie sigle");
  await r.context().close();
}
// risposte dal widget: sonno e energia arrivano nel diario
const k=tra(0);
p=await apri({turniConfigurati:true,pattern:"MPNSR",anchor:tra(-2),shifts:SH,repeat:true,firstSeenAt:tra(-30)}, {}, {[k]:{sonno:true,bed:"23:10",wake:"06:40",voto:4,at:Date.now()}});
let st=await p.evaluate(k=>({w:JSON.parse(localStorage.getItem("nt:wakes")||"{}")[k], b:JSON.parse(localStorage.getItem("nt:beds")||"{}")[k], v:JSON.parse(localStorage.getItem("nt:diary")||"{}")[k], W:window.__widget}), k);
ok(st.w==="06:40" && st.b==="23:10" && st.v===4, "le risposte del widget finiscono nel diario: "+JSON.stringify({w:st.w,b:st.b,v:st.v}));
ok(st.W.diario && st.W.diario.sonno && st.W.diario.voto, "poi il widget sa che è già annotato (niente più domanda)");
await p.context().close();
// già annotato nell'app: il widget non lo sovrascrive
p=await apri({turniConfigurati:true,pattern:"MPNSR",anchor:tra(-2),shifts:SH,repeat:true,firstSeenAt:tra(-30)}, {wakes:{[k]:"07:15"}, beds:{[k]:"23:45"}, diary:{[k]:2}}, {[k]:{sonno:true,bed:"23:10",wake:"06:40",voto:4}});
st=await p.evaluate(k=>({w:JSON.parse(localStorage.getItem("nt:wakes"))[k], v:JSON.parse(localStorage.getItem("nt:diary"))[k]}), k);
ok(st.w==="07:15" && st.v===2, "quello annotato nell'app vince su quello del widget");
await p.context().close();
// alle 06:38 dopo una notte: il sonno che sta per cominciare (nel piano del giorno prima) è fra le voci del widget
{ const ctx=await b.newContext({locale:"it-IT",viewport:{width:360,height:740}});
  await ctx.addInitScript(nativo);
  await ctx.addInitScript(([st])=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
    localStorage.setItem("nt:state",JSON.stringify(st)); localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:firstPlanBannerChiuso","true"); },
    [{turniConfigurati:true,pattern:"NNRRRPP",anchor:tra(-1),shifts:{N:{n:"Notte",s:1320,e:1860},P:{n:"Pomeriggio",s:840,e:1320}},repeat:true,firstSeenAt:tra(-30),freeBed:"00:30",freeWake:"08:30"}]);
  const q=await ctx.newPage(); q.on("pageerror",e=>errs.push(e.message));
  const t=new Date(); t.setHours(6,38,0,0); await q.clock.setFixedTime(t);
  await q.goto("http://localhost:8766/index.html"); await q.waitForTimeout(2600);
  const sonno=await q.evaluate(()=>{ const v=window.__widget.voci.find(v=>/^sonno/.test(v.k) && v.s>Date.now() && v.s<Date.now()+4*3600e3); return v ? new Date(v.s).toTimeString().slice(0,5) : null; });
  ok(!!sonno, "alle 06:38 dopo la notte il widget ha il sonno che sta per cominciare → "+(sonno||"manca"));
  await ctx.close(); }
// la sveglia vera già annotata (07:00) chiude il sonno: alle 07:15 il widget non deve dire «Sonno» fino alle 07:30 previste
{ const st={turniConfigurati:true,pattern:"R",anchor:tra(-3),shifts:SH,repeat:true,firstSeenAt:tra(-30),freeBed:"23:30",freeWake:"07:30"};
  const inCorso=async extra=>{ const q=await apri(st, extra, null, [7,15]); const r=await q.evaluate(()=>{ const n=Date.now(); return (window.__widget.voci||[]).filter(v=>v.k==="sonno" && v.s<=n && v.e>n).map(v=>new Date(v.e).toTimeString().slice(0,5)); }); await q.context().close(); return r; };
  const senza=await inCorso({}), con=await inCorso({wakes:{[tra(0)]:"07:00"}, beds:{[tra(0)]:"23:30"}});
  ok(senza.length===1 && senza[0]==="07:30", "senza sveglia annotata: alle 07:15 il sonno prosegue fino alle 07:30 → "+JSON.stringify(senza));
  ok(con.length===0, "con la sveglia annotata alle 07:00: il sonno non è più in corso per il widget → "+JSON.stringify(con)); }
ok(!errs.length, "nessun errore di pagina "+JSON.stringify(errs));
await b.close();
