// Il giorno dell'app, a ogni ora, per tanti tipi di turno: quale giorno mostra Oggi e se il sonno
// in corso o in arrivo è nel piano che si vede. Non ha un esito "verde": scrive le anomalie in un
// file JSON (argomento 1) e un riepilogo, da leggere a mano.
//   node tests/verifica/giorno.mjs esito.json [filtro-pattern] [passo-minuti]
// Serve un server su :8765 (python3 -m http.server 8765).
import pw from "../ui/_pw.mjs";
import fs from "fs";
const OUT=process.argv[2]||"/tmp/giorno.json", FILTRO=process.argv[3]||"", PASSO=+(process.argv[4]||60);
const T={M:[360,840],D:[420,1140],P:[840,1320],N:[1320,1800],K:[1140,1860],Z:[1200,1680],X:[960,1560],A:[240,720],W:[0,480],Q:[1380,1920],G:[480,1920],L:[780,1380],V:[660,1380],E:[300,780],F:[1080,1500]};
const sh=l=>Object.fromEntries([...new Set(l)].filter(c=>T[c]).map(c=>[c,{n:c,s:T[c][0],e:T[c][1]}]));
// nome, schema, ripete?
const CASI=[
 ["Notte 22-06 ×3","NNNRR"],["Notte 22-06 alterna","NR"],["Notte 22-06 ×7","NNNNNNNRRRRRRR"],["Notte singola","NRRR"],["Prima notte dopo riposi","RRRRN"],
 ["Rotazione M-P-N-smonto","MPNSR"],["Rotazione lunga","MMPPNNSRR"],["12h giorno/notte","DKSR"],["12h 2-2","DDKKSRRR"],
 ["Notte 19-07 ×2","KKRR"],["Notte 20-04","ZZZRR"],["Sera 16-02","XXXRR"],["Sera 18-01:40","FFFRR"],["Alba 04-12","AAAAARR"],["Alba 05-13","EEEEERR"],
 ["Notte tarda 00-08","WWWRR"],["Notte 23-07","QQQRR"],["Guardia 24h","GRR"],["Guardia 24h + 3 riposi","GRRR"],["Lungo 13-23","LLLLLRR"],["Spezzato 11-23","VVVVRR"],
 ["Giorno 06-14","MMMMMRR"],["Pomeriggio 14-22","PPPPPRR"],["Ritorno rapido P→M","PMRR"],["Ritorno rapido N→P","NPMRR"],["Misto irregolare","MNRPNR"],["Notti corte N+R","NNRRRRR"],["Giorno e notte alterni","DKDKRR"]
];
const ANCORA="2026-11-02";   // lunedì
const NOW0=new Date("2026-11-03T00:00:00+01:00").getTime();
const b=await pw.chromium.launch();
const out={anomalie:[], campioni:0, errori:[]};
const snapshot=()=>{ const q=s=>document.querySelector(s);
  const t=q('#essenziale [data-row="sonno"]'); const tl=t&&t.closest(".tl");
  const rows=[...document.querySelectorAll("#essenziale .tl")];
  const turno=rows.find(x=>(x.querySelector(".el")||{}).textContent==="Turno");
  const num=e=>e&&e.dataset.a!=null?{a:+e.dataset.a,z:e.dataset.z!=null?+e.dataset.z:null,cls:e.className}:null;
  return {label:(q("#dateLabel")||{}).textContent, pill:((q("#shiftPill")||{}).textContent||"").trim(), ora:((q("#ora")||{}).innerText||"").replace(/\s+/g," ").trim(),
    sonno:num(tl), turno:num(turno), n:rows.length, nan:/NaN|undefined|Invalid Date/.test(document.body.innerText)}; };
async function campione(caso, quando){
  const [nome,pat]=caso;
  const ctx=await b.newContext({locale:"it-IT",timezoneId:"Europe/Rome",viewport:{width:360,height:740}});
  await ctx.addInitScript(([st])=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
    localStorage.setItem("nt:state",JSON.stringify(st)); localStorage.setItem("nt:turniConfigurati","true");
    localStorage.setItem("nt:firstPlanBannerChiuso","true"); localStorage.setItem("nt:attivazioneNascosta","true"); },
    [{turniConfigurati:true,pattern:pat,anchor:ANCORA,shifts:sh(pat),repeat:true,firstSeenAt:"2026-01-01"}]);
  const p=await ctx.newPage(); const errs=[]; p.on("pageerror",e=>errs.push(e.message));
  await p.clock.setFixedTime(new Date(quando));
  await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(450);
  const S0=await p.evaluate(snapshot);
  await p.click("#prev"); await p.waitForTimeout(120); const Sp=await p.evaluate(snapshot);
  await p.click("#next"); await p.click("#next"); await p.waitForTimeout(120); const Sn=await p.evaluate(snapshot);
  await ctx.close();
  return {S0,Sp,Sn,errs};
}
function valuta(caso, quando, r){
  const d=new Date(quando), h=+d.toLocaleString("en-GB",{hour:"2-digit",hour12:false,timeZone:"Europe/Rome"})%24, m=d.getMinutes();
  const {S0,Sp,Sn,errs}=r, A=[];
  const ancora=/^Ancora/.test(S0.label||""), off=ancora?1440:0, nowT=off+h*60+m, TOL=10;
  const push=(tipo,det)=>A.push({caso:caso[0],pat:caso[1],quando:new Date(quando).toLocaleString("sv-SE",{timeZone:"Europe/Rome"}),tipo,label:S0.label,det});
  if(errs.length) push("ERRORE_JS",errs[0]);
  if(S0.nan) push("TESTO_ROTTO","NaN/undefined in pagina");
  if(!S0.ora) push("ADESSO_VUOTO","");
  const F=S0.sonno, P=Sp.sonno&&{a:Sp.sonno.a-1440,z:Sp.sonno.z-1440}, N=Sn.sonno&&{a:Sn.sonno.a+1440,z:Sn.sonno.z+1440};
  if(F && F.z!=null && F.z<nowT-TOL) push("TARDI","il sonno del giorno mostrato è già finito ("+F.z+" < "+nowT+"); prossimo giorno: "+(N?N.a+"–"+N.z:"-"));
  if(P && P.z!=null && P.z>nowT+TOL && !ancora) push("PRESTO","il giorno prima ha ancora il sonno in corso/davanti (fine "+P.z+" > "+nowT+")");
  // sonno in corso o in arrivo nelle prossime 10 ore, e non è quello del giorno mostrato
  const vicino=[["prima",P],["questo",F],["dopo",N]].filter(([k,s])=>s&&s.z!=null&&s.z>=nowT-TOL&&s.a<=nowT+600).sort((x,y)=>x[1].a-y[1].a);
  if(vicino.length && vicino[0][0]!=="questo" && !(vicino.some(([k])=>k==="questo"))) push("SONNO_NON_VISTO","il sonno in corso/in arrivo è nel giorno «"+vicino[0][0]+"» ("+vicino[0][1].a+"–"+vicino[0][1].z+"), ora "+nowT);
  if(F && F.a!=null && F.z!=null && nowT>=F.a && nowT<F.z && !/dorm|sonno|letto|riposo|sveglia|pisolino|buio|luce|Rischio|Calo|Minimo/i.test(S0.ora)) push("ADESSO_NEL_SONNO","in pieno sonno («"+S0.ora.slice(0,70)+"»)");
  const T0=S0.turno; if(T0 && T0.z!=null && nowT>=T0.a && nowT<T0.z && !/turno|Rientro|Rischio|Calo|caff|Mancano|Minimo|Rischi|Fatica|vigil/i.test(S0.ora)) push("ADESSO_NEL_TURNO","in turno («"+S0.ora.slice(0,70)+"»)");
  return A;
}
const lavori=[];
for(const caso of CASI){ if(FILTRO && !caso[1].includes(FILTRO)) continue;
  const L=Math.min(caso[1].length,7); const giorni=L*1440*60e3;
  for(let t=NOW0; t<NOW0+giorni; t+=PASSO*60e3) lavori.push([caso,t]); }
let i=0, fatti=0; const N=lavori.length;
await Promise.all(Array.from({length:8},async()=>{ for(;;){ const k=i++; if(k>=N) return; const [caso,t]=lavori[k];
  try{ const r=await campione(caso,t); out.campioni++; out.anomalie.push(...valuta(caso,t,r)); }catch(e){ out.errori.push(caso[0]+" "+new Date(t).toISOString()+" "+e.message.slice(0,80)); }
  if(++fatti%200===0) console.error(fatti+"/"+N); } }));
fs.writeFileSync(OUT, JSON.stringify(out));
const per={}; for(const a of out.anomalie){ const k=a.tipo; per[k]=per[k]||{n:0,casi:new Set()}; per[k].n++; per[k].casi.add(a.caso); }
console.log("campioni",out.campioni,"anomalie",out.anomalie.length,"errori strumento",out.errori.length);
for(const k in per) console.log(k.padEnd(20), String(per[k].n).padStart(5), "in", per[k].casi.size, "casi");
await b.close();
