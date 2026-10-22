// Widget Android (Capacitor finto): cosa riceve il widget (voci, prossimo
// turno anche fra giorni, settimana con i giorni speciali, domanda del
// diario) e le risposte date dal widget, applicate senza sovrascrivere.
import pw from "./_pw.mjs";
import { nativo } from "./_nativo.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const tra=n=>{ const d=new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()+n); return iso(d); };
const SH={M:{n:"Mattino",s:420,e:840},P:{n:"Pomeriggio",s:840,e:1260},N:{n:"Notte",s:1260,e:1860}};
const apri=async(st, extra={}, risposte=null)=>{
  const ctx=await b.newContext({locale:"it-IT",viewport:{width:360,height:740}});
  await ctx.addInitScript(nativo);
  await ctx.addInitScript(([st,extra,risposte])=>{ if(risposte) window.__risposte=risposte;
    if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
    localStorage.setItem("nt:state",JSON.stringify(st)); localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:firstPlanBannerChiuso","true");
    for(const k in extra) localStorage.setItem("nt:"+k, JSON.stringify(extra[k])); }, [st,extra,risposte]);
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.goto("http://localhost:8766/index.html"); await p.waitForTimeout(2600);
  return p;
};
// riposo per 4 giorni, poi una notte; ferie e reperibilità nella settimana
let p=await apri({turniConfigurati:true,pattern:"RRRRN",anchor:tra(0),shifts:SH,repeat:true,firstSeenAt:tra(-30),
  ecc:{[tra(1)]:"R"}, giorni:{[tra(1)]:{t:"ferie"}, [tra(2)]:{t:"reperibile"}}});
let W=await p.evaluate(()=>window.__widget);
ok(W && W.v===3 && W.voci.length>0, "il widget riceve le voci delle prossime 48 ore");
ok(W.turno && /Notte/.test(W.turno.t) && W.turno.s>Date.now()+3*864e5, "il prossimo turno c'è anche se è fra 4 giorni → "+(W.turno&&W.turno.t));
ok(W.giorni.slice(1).every(g=>/^[a-z]{3}\u00a0\d{1,2}$/.test(g.g)), "le etichette dei giorni non vanno a capo («dom 25» restava «dom») → "+W.giorni.map(g=>g.g).join(", "));
ok(W.giorni[1].c==="Fe" && /•$/.test(W.giorni[2].c) && W.giorni[4].c==="N", "settimana: Fe per le ferie, • per la reperibilità → "+W.giorni.map(g=>g.c).join(" "));
ok(W.diario && W.diario.d===tra(0) && /^\d\d:\d\d$/.test(W.diario.bed) && W.diario.a-W.diario.da===14*3600e3 && !W.diario.sonno && !W.diario.voto, "domanda del diario: orari del piano, per 8 ore dalla sveglia → "+JSON.stringify(W.diario));
await p.context().close();
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
ok(!errs.length, "nessun errore di pagina "+JSON.stringify(errs));
await b.close();
