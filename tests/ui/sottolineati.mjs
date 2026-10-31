// Regola: la sottolineatura è dei collegamenti veri (Termini, Privacy, Licenze…). Nessun pulsante, né un elemento
// che fa qualcosa al tocco, ha il testo sottolineato: un'azione dentro l'app non deve sembrare un link.
import pw from "./_pw.mjs";
import { nativo } from "./_nativo.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const fa=n=>{ const d=new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()-n); return iso(d); };
const pat="MPNSR", w={}, bd={}, diary={};
for(let i=1;i<=30;i++){ const c=pat[((-i)%5+5)%5]; w[fa(i)]= c==="N"?"13:30":"05:45"; bd[fa(i)]= c==="N"?"08:15":"23:30"; diary[fa(i)]=[2,3,4,5,3][i%5]; }
const ST={turniConfigurati:true,pattern:pat,anchor:fa(0),repeat:true,firstSeenAt:fa(40),freeBed:"23:30",freeWake:"07:30",
  shifts:{M:{n:"Mattino",s:360,e:840},P:{n:"Pomeriggio",s:840,e:1320},N:{n:"Notte",s:1320,e:1800}},people:[{name:"Anna",pattern:"MMRR",anchor:fa(2)}],ecc:{[fa(-1)]:"N"}};
const sott=p=>p.evaluate(()=>{ const out=[]; for(const el of document.querySelectorAll("button, [role=button], [data-act], input[type=button]")){
    const r=el.getBoundingClientRect(); if(!r.width || !r.height) continue;
    const dec=getComputedStyle(el).textDecorationLine; if(dec.includes("underline")) out.push((el.id||el.className||el.tagName)+": "+el.textContent.trim().slice(0,40)); }
  return out; });
async function apri(nativoOn, stato){
  const ctx=await b.newContext({locale:"it-IT",viewport:{width:390,height:844}});
  if(nativoOn) await ctx.addInitScript(nativo);
  if(stato) await ctx.addInitScript(([st,ex])=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1"); localStorage.setItem("nt:state",JSON.stringify(st)); localStorage.setItem("nt:turniConfigurati","true"); for(const k in ex) localStorage.setItem(k,ex[k]); },
    [ST,{"nt:wakes":JSON.stringify(w),"nt:beds":JSON.stringify(bd),"nt:diary":JSON.stringify(diary),"nt:firstPlanBannerChiuso":"true","nt:attivazioneNascosta":"true","nt:backupDone":"true"}]);
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.goto("http://localhost:"+(nativoOn?8766:8765)+"/index.html"); await p.waitForTimeout(1300);
  return p;
}
const clic=(p,q)=>p.evaluate(q=>document.querySelector(q)?.click(),q);
{ const p=await apri(false,false); const s=await sott(p); ok(s.length===0, "primo avvio: nessun pulsante sottolineato "+JSON.stringify(s)); await p.context().close(); }
{ const p=await apri(true,true);
  for(const [nome,passi] of [["Oggi",[]],["Turni",['[data-tab="turni"]']],["Persone",["#doOpzioni","[data-opzg-vai=\"persone\"]"]],["Sonno e carico",['[data-tab="turni"]',"#doAndamenti"]],["Impostazioni",["#doOpzioni"]]]){
    for(const q of passi){ await clic(p,q); await p.waitForTimeout(450); }
    const s=await sott(p); ok(s.length===0, nome+": nessun pulsante sottolineato "+JSON.stringify(s));
    if(nome==="Persone"||nome==="Sonno e carico"||nome==="Impostazioni") { await clic(p,"#chiudiOpzioni"); await p.waitForTimeout(200); }
  }
  await p.context().close(); }
// il controllo trova davvero un difetto: forzo la sottolineatura e deve accorgersene
{ const p=await apri(true,true); await clic(p,'[data-tab="turni"]'); await p.waitForTimeout(400);
  await p.addStyleTag({content:".btn,.lnk,.ibtn{text-decoration:underline!important}"}); await p.waitForTimeout(100);
  const s=await sott(p); ok(s.length>0, "prova del test: con la sottolineatura forzata ne trova "+s.length); await p.context().close(); }
console.log("errori", errs); await b.close();
