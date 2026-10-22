// Sveglia nell'Orologio del telefono: nel dettaglio di «Dormi», solo
// nell'app Android e solo se la fine del sonno cade entro 24 ore (l'Orologio
// la mette alla prossima volta che arriva quell'ora).
import pw from "./_pw.mjs";
import { nativo } from "./_nativo.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const ST={turniConfigurati:true,pattern:"MPNSR",anchor:iso(new Date()),repeat:true,firstSeenAt:"2026-01-01",
  shifts:{M:{n:"Mattino",s:420,e:840},P:{n:"Pomeriggio",s:840,e:1260},N:{n:"Notte",s:1260,e:1860}}};
async function apri(porta, app, alarm){
  const ctx=await b.newContext({locale:"it-IT",viewport:{width:360,height:740}});
  if(app) await ctx.addInitScript(nativo);
  if(alarm) await ctx.addInitScript(rifiuta=>{ window.__sveglie=[];
    window.Capacitor.Plugins.NTAlarm={set:async x=>{ if(rifiuta) throw new Error("no"); window.__sveglie.push(x); return {}; }}; }, alarm==="rifiuta");
  await ctx.addInitScript(st=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
    localStorage.setItem("nt:state",JSON.stringify(st)); localStorage.setItem("nt:turniConfigurati","true");
    localStorage.setItem("nt:firstPlanBannerChiuso","true"); localStorage.setItem("nt:attivazioneNascosta","true"); }, ST);
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  const dieci=new Date(); dieci.setHours(10,0,0,0); await p.clock.setFixedTime(dieci);
  await p.goto("http://localhost:"+porta+"/index.html"); await p.waitForTimeout(1500);
  return p;
}
// il pulsante sta sotto «Dormi», sempre visibile (non nel dettaglio a scomparsa)
const bottone=p=>p.evaluate(()=>{ const t=document.querySelector('#essenziale [data-row="sonno"]'); if(!t) return null; const v=t.closest(".tl");
  const s=v.querySelector(".tl-extra [data-sveglia]"); if(!s) return null; const r=s.getBoundingClientRect(), q=s.parentElement.getBoundingClientRect();
  return {ora:s.dataset.sveglia, testo:s.textContent, fine:v.querySelector(".essrow").textContent, visibile:r.height>0&&!t.open, largo:Math.abs((r.left+r.right)-(q.left+q.right))<=2}; });

{ const p=await apri(8766, true, true);
  const s=await bottone(p);
  ok(s && /^\d\d:\d\d$/.test(s.ora) && s.fine.includes(s.ora) && s.visibile && s.largo, "app: «Metti la sveglia» nel dettaglio di Dormi, all'ora di fine sonno → "+JSON.stringify(s));
  await p.click("[data-sveglia]"); await p.waitForTimeout(300);
  const [h,m]=s.ora.split(":").map(Number), sv=await p.evaluate(()=>window.__sveglie);
  ok(sv.length===1 && sv[0].hour===h && sv[0].minutes===m && sv[0].message==="Notturnisti", "tocco: sveglia chiesta all'Orologio → "+JSON.stringify(sv));
  ok(await p.evaluate(()=>[...document.querySelectorAll(".toast,#toast")].some(t=>/Sveglia delle .* messa nell'Orologio/.test(t.textContent))), "conferma: «Sveglia delle … messa nell'Orologio»");
  for(let i=0;i<3;i++){ await p.click("#next"); await p.waitForTimeout(250); }
  ok(!(await bottone(p)), "fra tre giorni: niente sveglia (l'Orologio la metterebbe domani)");
  await p.context().close(); }

{ const p=await apri(8766, true, "rifiuta");
  await bottone(p); await p.click("[data-sveglia]"); await p.waitForTimeout(300);
  ok(await p.evaluate(()=>[...document.querySelectorAll(".toast,#toast")].some(t=>/usa l'app Orologio/.test(t.textContent))), "senza app Orologio: lo dice, niente errori");
  await p.context().close(); }

{ const p=await apri(8765, false, false);
  ok(!(await bottone(p)), "sito: niente pulsante (la sveglia c'è solo nell'app)");
  await p.context().close(); }

console.log("errori", errs); await b.close();
