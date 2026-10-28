// Riepilogo da mandare: del mese guardato e degli ultimi 12 mesi, in testo semplice (numeri da
// «Turni › il mese», più il sonno annotato nel diario se c'è).
import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const ST={turniConfigurati:true,pattern:"MPNSR",anchor:"2026-11-02",repeat:true,firstSeenAt:"2026-01-01",
  shifts:{M:{n:"Mattino",s:420,e:840},P:{n:"Pomeriggio",s:840,e:1260},N:{n:"Notte",s:1260,e:1860}}};
async function apri(diario){
  const ctx=await b.newContext({locale:"it-IT",timezoneId:"Europe/Rome",viewport:{width:360,height:740}});
  await ctx.addInitScript(([st,diario])=>{ window.__sh=[]; navigator.share=async o=>{ window.__sh.push(o); };
    if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
    localStorage.setItem("nt:state",JSON.stringify(st)); localStorage.setItem("nt:turniConfigurati","true");
    localStorage.setItem("nt:firstPlanBannerChiuso","true"); localStorage.setItem("nt:attivazioneNascosta","true");
    if(diario){ localStorage.setItem("nt:beds",JSON.stringify({"2026-11-03":"23:00","2026-11-04":"23:00","2026-11-05":"22:30"}));
      localStorage.setItem("nt:wakes",JSON.stringify({"2026-11-03":"07:00","2026-11-04":"07:00","2026-11-05":"06:30"}));
      localStorage.setItem("nt:diary",JSON.stringify({"2026-11-03":4,"2026-11-04":3})); } }, [ST,diario]);
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.clock.setFixedTime(new Date("2026-11-15T12:00:00+01:00"));
  await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(900);
  await p.click('[data-tab="turni"]'); await p.waitForTimeout(300);
  return p;
}
{ const p=await apri(true);
  await p.evaluate(()=>document.querySelector("#meseBox .mese-det").open=true); await p.click("[data-mese-manda]"); await p.waitForTimeout(300);
  const t=(await p.evaluate(()=>window.__sh))[0]; const x=t&&t.text||"";
  ok(/^Il mio novembre 2026 in turno:\n/.test(x), "il mese: titolo → "+x.split("\n")[0]);
  ok(/• 18 turni, 144 ore\n/.test(x) && /• 6 notti\n/.test(x) && /• 12 giorni senza turno/.test(x), "i numeri sono quelli della scheda del mese (18 turni, 144 ore, 6 notti, 12 liberi)");
  ok(/• Sonno annotato: 3 notti, in media 8h · energia 3,5 su 5/.test(x), "sonno e energia dal diario → "+(x.match(/• Sonno annotato.*/)||[""])[0]);
  ok(/\nhttps:\/\/app\.notturnisti\.club\/\?s=mese$/.test(x) && !/[*_#]|[\u{1F300}-\u{1FAFF}]/u.test(x), "testo semplice, firma con ?s=mese, niente emoji né markdown");
  const t0=Date.now(); await p.click("[data-anno-manda]"); await p.waitForTimeout(200);
  const y=((await p.evaluate(()=>window.__sh))[1]||{}).text||"";
  ok(/^I miei ultimi 12 mesi in turno:\n/.test(y) && /• Il mese più pesante: \w+ 20\d\d \(/.test(y) && /\?s=anno$/.test(y), "12 mesi: titolo, mese più pesante, firma → "+y.split("\n").slice(0,4).join(" | "));
  console.log("   12 mesi calcolati e mandati in", Date.now()-t0, "ms");
  await p.context().close(); }
{ const p=await apri(false);
  await p.evaluate(()=>document.querySelector("#meseBox .mese-det").open=true); await p.click("[data-mese-manda]"); await p.waitForTimeout(300);
  const x=((await p.evaluate(()=>window.__sh))[0]||{}).text||"";
  ok(x && !/Sonno annotato/.test(x), "senza diario: nessuna riga sul sonno");
  await p.context().close(); }
console.log("errori", errs); await b.close();
