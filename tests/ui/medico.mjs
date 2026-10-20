// Riepilogo di 12 mesi per il medico competente: numeri giusti su cicli
// noti, riposi brevi, il sonno annotato, e su iPhone un PDF vero.
import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const UA="Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const apri=async(st, extra={}, opz={})=>{
  const ctx=await b.newContext({locale:"it-IT",viewport:{width:390,height:844},...opz});
  await ctx.addInitScript(([st,extra])=>{ window.__printed=0; window.print=()=>{ window.__printed++; };
    if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
    localStorage.setItem("nt:state",JSON.stringify(st)); localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:firstPlanBannerChiuso","true");
    for(const k in extra) localStorage.setItem("nt:"+k, JSON.stringify(extra[k])); }, [st,extra]);
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(900);
  await p.click('[data-tab="turni"]'); await p.waitForTimeout(300);
  // il riepilogo sta in «Sonno e carico», in fondo
  await p.click("#doAndamenti"); await p.waitForTimeout(300);
  return p;
};
const foglio=p=>p.evaluate(()=>{ const s=document.querySelector("#printSheet .ps-doc"); if(!s) return null;
  const sint={}; s.querySelectorAll("table")[0].querySelectorAll("tbody tr").forEach(tr=>{ sint[tr.children[0].textContent]=tr.children[1].textContent; });
  return {sint, mesi:s.querySelectorAll("table")[1].querySelectorAll("tbody tr").length, testo:s.innerText}; });
const anno=new Date(); anno.setFullYear(anno.getFullYear()-1);
const SH={M:{n:"Mattino",s:420,e:840},P:{n:"Pomeriggio",s:840,e:1260},N:{n:"Notte",s:1260,e:1860}};
// MPNSR da più di un anno: 1 notte ogni 5 giorni, nessun riposo breve
let p=await apri({turniConfigurati:true,pattern:"MPNSR",anchor:iso(anno),shifts:SH,repeat:true,firstSeenAt:iso(anno)});
await p.click("#andamenti [data-riepilogo-medico]"); await p.waitForTimeout(500);
let f=await foglio(p);
const giorni=Math.round((new Date()-new Date(new Date().getFullYear(), new Date().getMonth()-11, 1))/864e5)+1;
const notti=+f.sint["Notti (almeno 3 ore fra le 22 e le 6)"], turni=+f.sint["Turni"];
ok(f && f.mesi===13, "12 mesi più la riga del totale");
ok(Math.abs(notti-giorni/5)<=1 && Math.abs(turni-3*giorni/5)<=2, "MPNSR: una notte ogni 5 giorni ("+notti+" su "+giorni+" giorni), 3 turni ogni 5 ("+turni+")");
ok(f.sint["Riposi sotto le 11 ore fra due turni"]==="0" && f.sint["Notti di fila, al massimo"]==="1", "nessun riposo breve, una notte alla volta");
ok(+f.sint["Ore lavorate fra le 22 e le 6"]===notti*8, "ore fra le 22 e le 6: 8 per notte ("+f.sint["Ore lavorate fra le 22 e le 6"]+")");
ok(/D\.Lgs 66\/2003/.test(f.testo) && /non è un registro delle presenze/.test(f.testo) && !/NaN|undefined/.test(f.testo), "riferimento di legge, avvertenza, nessun testo rotto");
ok(!/Il sonno annotato/.test(f.testo), "senza diario niente sezione sul sonno");
await p.context().close();
// pomeriggio fino alle 22 e mattino alle 6: riposo di 8 ore; con diario
const dia={}, wk={}, bd={};
for(let i=1;i<=10;i++){ const d=new Date(); d.setDate(d.getDate()-i); const k=iso(d); dia[k]=2+(i%3); wk[k]="06:00"; bd[k]=i%2?"23:00":"02:00"; }
p=await apri({turniConfigurati:true,pattern:"PMRR",anchor:iso(anno),shifts:{P:{n:"Pomeriggio",s:840,e:1320},M:{n:"Mattino",s:360,e:840}},repeat:true,firstSeenAt:iso(new Date(Date.now()-60*864e5))},{diary:dia,wakes:wk,beds:bd});
await p.click("#andamenti [data-riepilogo-medico]"); await p.waitForTimeout(500);
f=await foglio(p);
const brevi=+f.sint["Riposi sotto le 11 ore fra due turni"];
ok(Math.abs(brevi-giorni/4)<=1, "pomeriggio → mattino: un riposo breve ogni ciclo ("+brevi+")");
ok(/Su 10 notti annotate/.test(f.testo) && /5 sotto le 5 ore/.test(f.testo) && /su 5/.test(f.testo), "sonno annotato: notti, sotto le 5 ore, voto medio");
ok(/i turni sono ricostruiti dal ciclo/.test(f.testo), "dice da quando i turni sono quelli veri dell'app");
await p.context().close();
// iPhone: un PDF vero
p=await apri({turniConfigurati:true,pattern:"MPNSR",anchor:iso(anno),shifts:SH,repeat:true,firstSeenAt:iso(anno)},{},{userAgent:UA,isMobile:true,hasTouch:true});
await p.evaluate(()=>{ window.__files=[]; navigator.canShare=()=>true;
  navigator.share=async(o)=>{ for(const f of o.files||[]){ const t=await f.text(); window.__files.push({type:f.type, head:t.slice(0,8), pagine:(t.match(/\/Type \/Page /g)||[]).length, testo:/\(Riepilogo\)/.test(t) && /\(medico\)/.test(t) && /\(Totale\)/.test(t)}); } }; });
await p.evaluate(()=>document.querySelector("#andamenti [data-riepilogo-medico]").click()); await p.waitForTimeout(900);
const pdf=await p.evaluate(()=>({f:window.__files, printed:window.__printed}));
ok(pdf.printed===0 && pdf.f.length===1 && pdf.f[0].head.startsWith("%PDF") && pdf.f[0].pagine>=1 && pdf.f[0].testo, "iPhone: il riepilogo diventa un PDF da condividere → "+JSON.stringify(pdf.f));
await p.context().close();
console.log("errori", errs); await b.close();
