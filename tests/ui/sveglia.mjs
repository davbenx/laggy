// Sveglia nell'Orologio del telefono: una riga nella scheda «Il tuo sonno» (la zona delle azioni di Oggi), solo nell'app Android,
// da 4 ore prima del sonno fino alla sua fine, solo su oggi. Dopo il tocco si ricorda che è messa (l'Orologio non lo dice).
import pw from "./_pw.mjs";
import { nativo } from "./_nativo.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const ST={turniConfigurati:true,pattern:"MPNSR",anchor:iso(new Date()),repeat:true,firstSeenAt:"2026-01-01",
  shifts:{M:{n:"Mattino",s:420,e:840},P:{n:"Pomeriggio",s:840,e:1260},N:{n:"Notte",s:1260,e:1860}}};
async function apri(porta, app, alarm, ora=[10,0], stato=ST){
  const ctx=await b.newContext({locale:"it-IT",viewport:{width:360,height:740}});
  if(app) await ctx.addInitScript(nativo);
  if(alarm) await ctx.addInitScript(rifiuta=>{ window.__sveglie=[];
    window.Capacitor.Plugins.NTAlarm={set:async x=>{ if(rifiuta) throw new Error("no"); window.__sveglie.push(x); return {}; }}; }, alarm==="rifiuta");
  await ctx.addInitScript(st=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
    localStorage.setItem("nt:state",JSON.stringify(st)); localStorage.setItem("nt:turniConfigurati","true");
    localStorage.setItem("nt:firstPlanBannerChiuso","true"); localStorage.setItem("nt:attivazioneNascosta","true"); }, stato);
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  const dieci=new Date(); dieci.setHours(ora[0],ora[1],0,0); await p.clock.setFixedTime(dieci);
  await p.goto("http://localhost:"+porta+"/index.html"); await p.waitForTimeout(1500);
  return p;
}
const riga=p=>p.evaluate(()=>{ const x=document.querySelector("#essenziale .drem [data-sveglia]"); if(!x) return null; const r=x.getBoundingClientRect(), c=x.closest(".drem").getBoundingClientRect(), s=document.querySelector('#essenziale [data-row="sonno"]');
  return {ora:x.dataset.sveglia, testo:x.textContent.trim(), visibile:r.height>0 && r.right<=c.right+1, fine:s ? s.querySelector(".essrow").textContent : "", ovunque:document.querySelectorAll("[data-sveglia]").length}; });

{ const p=await apri(8766, true, true, [20,30]);
  const s=await riga(p);
  ok(s && /^\d\d:\d\d$/.test(s.ora) && s.fine.includes(s.ora) && s.visibile && s.ovunque===1, "app, di sera: «Metti» nella scheda «Il tuo sonno», all'ora di fine sonno, e in nessun altro posto → "+JSON.stringify(s));
  ok(await p.evaluate(()=>!document.querySelector("#ora [data-sveglia]") && !document.querySelector("#essenziale .tl [data-sveglia]")), "non nella scheda «Adesso» né sotto «Dormi»");
  await p.click("[data-sveglia]"); await p.waitForTimeout(400);
  const [h,m]=s.ora.split(":").map(Number), sv=await p.evaluate(()=>window.__sveglie);
  ok(sv.length===1 && sv[0].hour===h && sv[0].minutes===m && sv[0].message==="Notturnisti", "tocco: sveglia chiesta all'Orologio → "+JSON.stringify(sv));
  ok(await p.evaluate(()=>[...document.querySelectorAll(".toast,#toast")].some(t=>/Sveglia delle .* messa nell'Orologio/.test(t.textContent))), "conferma: «Sveglia delle … messa nell'Orologio»");
  ok(await p.evaluate(()=>/✓\s*Sveglia\s*\d\d:\d\d/.test(document.querySelector("#essenziale .sv-riga").textContent) && /Rimettila/.test(document.querySelector("#essenziale .sv-riga").textContent)), "dopo il tocco la riga dice «✓ Sveglia 07:20» con «Rimettila»");
  await p.click("[data-sveglia]"); await p.waitForTimeout(300);
  ok(await p.evaluate(()=>window.__sveglie.length===2), "«Rimettila» la rimanda all'Orologio");
  await p.click("#next"); await p.waitForTimeout(300);
  ok(!(await riga(p)), "su un altro giorno non c'è (è una cosa di stanotte)");
  await p.context().close(); }

{ const p=await apri(8766, true, true, [10,0]);
  ok(!(await riga(p)), "alle 10, lontano dal sonno: niente (starebbe lì inutilmente tutto il giorno)");
  await p.context().close(); }

// il primo giorno non c'è la domanda del diario: resta la scheda con la sola riga della sveglia
{ const p=await apri(8766, true, true, [20,30], {...ST, firstSeenAt:iso(new Date())});
  const o=await p.evaluate(()=>{ const c=document.querySelector("#essenziale .drem"); return c ? {sveglia:!!c.querySelector("[data-sveglia]"), domande:c.querySelectorAll(".dq,.dq-az").length} : null; });
  ok(o && o.sveglia && o.domande===0, "senza diario da fare: la scheda «Il tuo sonno» ha solo la riga della sveglia → "+JSON.stringify(o));
  await p.context().close(); }

{ const p=await apri(8766, true, "rifiuta", [20,30]);
  await p.click("[data-sveglia]"); await p.waitForTimeout(300);
  ok(await p.evaluate(()=>[...document.querySelectorAll(".toast,#toast")].some(t=>/usa l'app Orologio/.test(t.textContent))), "senza app Orologio: lo dice, niente errori");
  ok(await p.evaluate(()=>!localStorage.getItem("nt:svegliaMessa")), "e non la ricorda come messa");
  await p.context().close(); }

{ const p=await apri(8765, false, false, [20,30]);
  ok(!(await riga(p)), "sito: niente (la sveglia c'è solo nell'app)");
  await p.context().close(); }

// sonno in corso e ultima voce del piano: la riga c'è, la linea dell'ora non va oltre «Dormi»
{ const ieri=new Date(); ieri.setDate(ieri.getDate()-1);
  const p=await apri(8766, true, true, [3,43], {turniConfigurati:true,pattern:"NR",anchor:iso(ieri),repeat:true,firstSeenAt:"2026-01-01",shifts:{N:{n:"Notte",s:1320,e:1575}}});
  const o=await p.evaluate(()=>{ const t=document.querySelector('#essenziale [data-row="sonno"]'); if(!t) return null; const v=t.closest(".tl");
    return {riga:v.className, sveglia:!!document.querySelector("#essenziale .drem [data-sveglia]"), sottoDormi:!!(v.nextElementSibling&&v.nextElementSibling.querySelector("[data-sveglia]")), linee:document.querySelectorAll(".tl-adesso").length}; });
  ok(o && /\bora\b/.test(o.riga) && o.sveglia && !o.sottoDormi && o.linee===0, "sonno in corso (03:43): «Il tuo sonno» ha la sveglia, «Dormi» è solo informazione, nessuna linea dell'ora oltre il sonno → "+JSON.stringify(o));
  await p.context().close(); }

console.log("errori", errs); await b.close();
