// Touch & feel su un telefono vero (touch, niente mouse): dopo un tocco un pulsante non resta «evidenziato» (hover
// appiccicoso), le parti dell'interfaccia non si selezionano col tocco lungo, la pagina dietro un foglio resta ferma,
// la tab già aperta riporta in cima.
import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const ctx=await b.newContext({locale:"it-IT",viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2});
await ctx.addInitScript(()=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
  localStorage.setItem("nt:state",JSON.stringify({turniConfigurati:true,pattern:"MMPPNNRR",anchor:"2026-11-02",shifts:{M:{n:"Mattino",s:360,e:840},P:{n:"Pomeriggio",s:840,e:1320},N:{n:"Notte",s:1320,e:1800}},repeat:true,firstSeenAt:"2026-09-01"}));
  localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:firstPlanBannerChiuso","true"); localStorage.setItem("nt:novitaViste",JSON.stringify("2099")); });
const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(1500);
ok(!(await p.evaluate(()=>matchMedia("(hover:hover)").matches)), "telefono: nessun mouse (hover:none)");
// nessuna regola :hover vale sui telefoni: tutte stanno sotto @media (hover:hover), così un pulsante toccato non resta evidenziato
const fuori=await p.evaluate(()=>{ const out=[]; const giro=(rules, dentro)=>{ for(const r of rules){ if(r.media){ giro(r.cssRules, dentro || /hover:\s*hover/.test(r.media.mediaText)); continue; }
    if(r.selectorText && r.selectorText.includes(":hover") && !dentro) out.push(r.selectorText); } };
  for(const sh of document.styleSheets){ try{ giro(sh.cssRules, false); }catch(e){} } return out; });
ok(fuori.length===0, "nessuno stile «hover» sui telefoni (niente pulsanti che restano evidenziati dopo il tocco) → "+fuori.join(", "));
ok(await p.evaluate(()=>{ const x=document.querySelector("#essenziale .erow"); return x && getComputedStyle(x).userSelect==="none"; }), "le righe del piano non si selezionano col tocco lungo");
ok(await p.evaluate(()=>{ const x=document.querySelector(".tabbtn"); return getComputedStyle(x).userSelect==="none"; }), "neanche la barra delle tab");
// foglio aperto: la pagina dietro non scorre
await p.tap('#essenziale .erow'); await p.waitForTimeout(500);
ok(await p.evaluate(()=>getComputedStyle(document.body).overflow==="hidden"), "con un foglio aperto la pagina dietro resta ferma");
ok(await p.evaluate(()=>getComputedStyle(document.querySelector("#infoCorpo")).userSelect!=="none"), "il testo dei fogli si può ancora copiare");
await p.tap("#infoChiudi"); await p.waitForTimeout(400);
ok(await p.evaluate(()=>getComputedStyle(document.body).overflow!=="hidden"), "chiuso il foglio, la pagina scorre di nuovo");
// la tab già aperta riporta in cima
await p.evaluate(()=>window.scrollTo(0,600)); await p.waitForTimeout(200);
await p.tap('[data-tab="oggi"]'); await p.waitForTimeout(900);
ok(await p.evaluate(()=>window.scrollY)===0, "toccare «Oggi» mentre sei già lì riporta in cima");
console.log("errori", errs); ok(errs.length===0, "nessun errore di pagina"); await b.close();
