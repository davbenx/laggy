// Verifica completa del motore su tutte le turnazioni (lenta, ~1 min: fuori da
// run.sh). Uso: TZ=Europe/Rome node tests/verifica/turni.mjs — deve dire
// "nessun problema" (lo stato «Domani» nei riposi è voluto e non viene mostrato).
import { createEngine, resolveNextAction } from "../../engine.js";
import { buildSchedule, TIPI_TUTTI } from "../../notifications.js";
const T={A:{n:"Alba",s:300,e:780},M:{n:"Mattino",s:360,e:840},L:{n:"Mattino tardi",s:480,e:960},D:{n:"Giorno 12h",s:420,e:1140},P:{n:"Pomeriggio",s:840,e:1320},S:{n:"Sera",s:1080,e:1440},X:{n:"Sera tardi",s:1140,e:1500},N:{n:"Notte",s:1320,e:1860},K:{n:"Notte 12h",s:1140,e:1860},Z:{n:"Notte fonda",s:0,e:480},G:{n:"24 ore",s:480,e:1920}};
const codes=Object.keys(T).concat(["R"]);
const probs={}; const add=(k,v)=>{ (probs[k]=probs[k]||[]).push(v); };
const base0=new Date(); base0.setHours(12,0,0,0);
let piani=0, notif=0, eventi=0;
function controlla(cfg, nome, giorni){
  const e=createEngine(cfg);
  const f0=new Date(cfg.focus);
  for(let o=0;o<giorni;o++){
    const d=new Date(f0); d.setDate(d.getDate()+o); e.state.focus=d;
    if(e.codeAt(0)==="?") continue;
    let P; try{ P=e.plan(); }catch(err){ add("crash plan", nome+" g"+o+" "+err.message); continue; } piani++;
    const s=P.s, fine=s.onset+s.dur;
    if(!isFinite(s.onset)||!(s.dur>=0)) add("sonno non valido", nome+" g"+o);
    if(s.dur>14*60) add("sonno > 14h", nome+" g"+o+" "+s.dur);
    for(const n of P.naps||[]){
      if(!(n.b>n.a)) add("pisolino invertito", nome+" g"+o);
      if(n.b-n.a>150) add("pisolino > 2h30", nome+" g"+o+" "+(n.b-n.a));
      if(s.dur>0 && n.a<fine && n.b>s.onset) add("pisolino nel sonno", nome+" g"+o+" "+n.a+"-"+n.b+" vs "+s.onset+"-"+fine);
      const sp=P.sp; if(sp && sp.dur>0){ const a=sp.onset-1440, z=a+sp.dur; if(n.a<z && n.b>a) add("pisolino nel sonno di ieri", nome+" g"+o); }
    }
    if(isFinite(P.cut) && s.dur>0 && P.cut>s.onset) add("caffè dopo l'ora di dormire", nome+" g"+o);
    for(let m=0;m<1440;m+=30){ try{ const r=resolveNextAction({nowMins:m,P}); if(!r||!r.status) add("stato vuoto", nome+" g"+o+" m"+m); if(r&&r.next&&r.next.at!=="Domani"&&!/^\d\d:\d\d$/.test(r.next.at)) add("ora non valida", nome+" g"+o+" "+r.next.at); }catch(err){ add("crash stato", nome+" g"+o+" m"+m+" "+err.message); break; } }
  }
  e.state.focus=new Date(f0);
  let ev=[]; try{ ev=e.buildEvents(giorni); }catch(err){ add("crash eventi", nome+" "+err.message); }
  eventi+=ev.length;
  const uid=new Set();
  for(const x of ev){ if(!(x.end>x.start) && !x.allDay) add("evento invertito", nome+" "+x.uid); if(uid.has(x.uid)) add("evento doppio", nome+" "+x.uid); uid.add(x.uid); }
  const turni=ev.filter(x=>x.tipo==="turno"), sonni=ev.filter(x=>x.tipo==="sonno");
  for(const sx of sonni) for(const t of turni) if(sx.start<t.end && sx.end>t.start) add("evento sonno sovrapposto a turno", nome+" "+sx.uid+" / "+t.uid);
  let L=[]; try{ L=buildSchedule(cfg,{days:giorni, types:TIPI_TUTTI}); }catch(err){ add("crash notifiche", nome+" "+err.message); }
  notif+=L.length;
  const per={}, ids=new Set();
  for(const n of L){ const k=n.at.toDateString(); per[k]=(per[k]||0)+1; if(ids.has(n.id)) add("notifica id doppio", nome+" "+n.id+" "+n.kind); ids.add(n.id); if(!(n.at instanceof Date)||isNaN(n.at)) add("notifica senza ora", nome); if(/undefined|NaN/.test(n.title+n.body)) add("testo rotto", nome+" "+n.title+" "+n.body); }
  for(const k in per) if(per[k]>4) add("più di 4 al giorno", nome+" "+k+" "+per[k]);
}
// 1. tutte le terne di giorni
for(const a of codes) for(const b of codes) for(const c of codes){
  const seq=[a,b,c]; let ok=true; for(let i=0;i<2;i++){ const x=T[seq[i]], y=T[seq[i+1]]; if(x&&y && 1440+y.s-x.e<120) ok=false; } if(!ok) continue;
  controlla({pattern:a+b+c+"RRRR", anchor:base0.toISOString().slice(0,10), shifts:T, repeat:true, focus:base0}, a+b+c, 7);
}
// 2. cicli reali lunghi, non ripetuti, eccezioni, impostazioni estreme
const reali=["MMPPNNSRR","MPNSR","DDNNSRRR","MMMMMRR","NNNNNNNRRRRRRR","MMMMMRRPPPPPRRNNNNNRRRRR","DNSRR","GRRR","KKKSRRRR","ZZZZZRR","AAMMPPRR"];
const varianti=[{}, {cTo:90,cFrom:90,prep:90}, {freeBed:"21:30",freeWake:"04:30"}, {freeBed:"02:00",freeWake:"11:00"}, {sonnoDiurno:"unico"}, {mattinoBifasico:true}, {napTurno:"pausa"}, {caffSens:"alta"}, {maxAdvance:30}];
for(const pat of reali) for(const v of varianti) for(const rep of [true,false]){
  const ecc={}; const d1=new Date(base0); d1.setDate(d1.getDate()+2); ecc[d1.toISOString().slice(0,10)]="N"; const d2=new Date(base0); d2.setDate(d2.getDate()+4); ecc[d2.toISOString().slice(0,10)]="R";
  controlla(Object.assign({pattern:pat, anchor:base0.toISOString().slice(0,10), shifts:T, repeat:rep, ecc, focus:base0}, v), pat+(rep?"":" (non ripete)")+" "+JSON.stringify(v), 21);
}
console.log("piani", piani, "eventi", eventi, "notifiche", notif);
for(const k in probs) console.log(k+": "+probs[k].length+"  es: "+probs[k].slice(0,3).join(" | "));
if(!Object.keys(probs).length) console.log("nessun problema");
