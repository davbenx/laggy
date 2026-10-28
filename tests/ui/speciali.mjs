// Giorni speciali dal foglio del giorno: ferie e malattia come riposo (col
// turno di prima che torna togliendole), reperibilità col pisolino
// preventivo, formazione e orari veri (straordinario) nei numeri del mese,
// un turno scelto che toglie l'assenza, «Torna alla sequenza» che pulisce.
import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const oggi=new Date(); oggi.setHours(12);
const SH={M:{n:"Mattino",s:420,e:840},P:{n:"Pomeriggio",s:840,e:1260},N:{n:"Notte",s:1260,e:1860}};
const ctx=await b.newContext({locale:"it-IT",viewport:{width:360,height:740}});
await ctx.addInitScript(st=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
  localStorage.setItem("nt:state",JSON.stringify(st)); localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:firstPlanBannerChiuso","true"); },
  {turniConfigurati:true,pattern:"MPNSR",anchor:iso(oggi),shifts:SH,repeat:true,firstSeenAt:"2026-01-01"});
const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(900);
await p.click('[data-tab="turni"]'); await p.waitForTimeout(300);
const stato=()=>p.evaluate(()=>JSON.parse(localStorage.getItem("nt:state")));
const apri=async off=>{ await p.click('#cyc .crow[data-off="'+off+'"]'); await p.waitForTimeout(250); };
const chip=async t=>{ if(!(await p.$('[data-qs-spec="'+t+'"]'))){ await p.click("[data-qs-altro]"); await p.waitForTimeout(150); } await p.click('[data-qs-spec="'+t+'"]'); await p.waitForTimeout(250); };
const d2=iso(new Date(oggi.getTime()+2*864e5)), d0=iso(oggi), d1=iso(new Date(oggi.getTime()+864e5));
// 1. ferie sulla notte (giorno +2): riposo, sigla nella striscia; toglierla riporta la notte
await apri(2);
ok(await p.evaluate(()=>document.querySelectorAll("[data-qs-spec]").length===2), "nel foglio del giorno ferie e malattia sono in vista, il resto dietro «Altro»");
await p.click("[data-qs-altro]"); await p.waitForTimeout(150);
ok(await p.evaluate(()=>document.querySelectorAll("[data-qs-spec]").length===5), "…e con «Altro» ci sono tutti e 5 i giorni speciali");
await chip("ferie");
let st=await stato();
ok(st.ecc[d2]==="R" && st.giorni[d2].t==="ferie" && !st.giorni[d2].w, "Ferie: il giorno diventa riposo → "+JSON.stringify(st.giorni[d2]));
ok(await p.evaluate(()=>document.querySelector('[data-qs-spec="ferie"]').getAttribute("aria-pressed")==="true" && !document.querySelector(".qs-btn.active")), "il chip Ferie resta premuto e nessun turno risulta scelto");
await p.click("#qsClose"); await p.waitForTimeout(200);
ok(await p.evaluate(()=>document.querySelector('#cyc .crow[data-off="2"] .ccode').textContent==="Fe"), "nella striscia del ciclo il giorno porta «Fe»");
await apri(2); await chip("malattia"); st=await stato();
ok(st.giorni[d2].t==="malattia" && st.ecc[d2]==="R", "da Ferie a Malattia: resta riposo");
await chip("malattia"); st=await stato();
ok(!st.giorni[d2] && !st.ecc[d2], "togliendo la malattia torna la notte del ciclo");
await p.click("#qsClose"); await p.waitForTimeout(150);
// 2. un turno segnato a mano torna dopo le ferie
await apri(1); await p.click('[data-qs="N"]'); await p.waitForTimeout(250);
await apri(1); await chip("ferie"); await chip("ferie"); st=await stato();
ok(st.ecc[d1]==="N" && !st.giorni[d1], "il turno segnato a mano (Notte) torna togliendo le ferie");
await p.click("#qsClose"); await p.waitForTimeout(150);
// 3. reperibilità oggi (Mattino): pisolino preventivo nel piano, pillola
await apri(0); await chip("reperibile");
ok(await p.evaluate(()=>/pisolino nel pomeriggio/.test(document.querySelector("#qsSpec").textContent)), "Reperibilità: il foglio spiega il pisolino preventivo");
// orari veri: il mattino finisce alle 16:00 invece delle 14:00
await p.evaluate(()=>{ const i=document.querySelector('[data-qs-ora="e"]'); i.value="16:00"; i.dispatchEvent(new Event("change",{bubbles:true})); });
await p.waitForTimeout(250); st=await stato();
ok(st.giorni[d0].t==="reperibile" && st.giorni[d0].s===420 && st.giorni[d0].e===960, "orari veri salvati insieme alla reperibilità → "+JSON.stringify(st.giorni[d0]));
await p.click("#qsClose"); await p.waitForTimeout(150);
await p.click('[data-tab="oggi"]'); await p.waitForTimeout(400);
const oggiTxt=await p.evaluate(()=>document.body.innerText);
ok(/sei reperibile/.test(oggiTxt), "Oggi: la riga del pisolino dice «sei reperibile»");
ok(await p.evaluate(()=>/reperibile/.test(document.querySelector("#shiftPill").textContent)), "Oggi: la pillola dice «reperibile» → "+await p.evaluate(()=>document.querySelector("#shiftPill").textContent));
await p.click('[data-tab="turni"]'); await p.waitForTimeout(300);
// 4. numeri del mese
const mese=await p.evaluate(()=>{ document.querySelector("#meseBox .mese-det").open=true; return document.querySelector("#meseBox").innerText; });
ok(/\+2h oltre l'orario/.test(mese) && /1 giorno di reperibilità/.test(mese), "Il tuo mese: straordinario e reperibilità contati → "+(mese.match(/\+.*$/m)||[""])[0]);
// 5. formazione su un riposo (giorno +4, R), poi un turno scelto la toglie
await apri(4); await chip("formazione"); st=await stato();
const d4=iso(new Date(oggi.getTime()+4*864e5));
ok(st.giorni[d4].t==="formazione" && st.giorni[d4].s===540 && st.giorni[d4].e===1020, "Formazione: 09:00–17:00 di partenza");
ok(await p.evaluate(()=>!!document.querySelector('[data-qs-ora="s"]')), "con la formazione si possono cambiare gli orari");
await p.click('[data-qs="P"]'); await p.waitForTimeout(250); st=await stato();
ok(st.ecc[d4]==="P" && !st.giorni[d4], "scegliere un turno toglie la formazione");
// 6. Torna alla sequenza pulisce anche i giorni speciali
await apri(0); await p.click("#qsReset"); await p.waitForTimeout(250); st=await stato();
ok(!st.giorni[d0], "«Torna alla sequenza» toglie reperibilità e orari veri");
ok(!errs.length, "nessun errore di pagina "+JSON.stringify(errs));
await b.close();
