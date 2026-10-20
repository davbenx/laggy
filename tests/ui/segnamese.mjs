// I turni del mese: pennelli (un tocco segna, il secondo toglie), «Altro…»
// che apre il foglio del giorno, importazione da .ics con Annulla, foglio di
// reparto .xlsx con la scelta della riga, calendario del telefono (app
// Android) e foto letta dall'AI solo dopo il consenso. Turni variabili.
import pw from "./_pw.mjs";
import { nativo } from "./_nativo.mjs";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const oggi=new Date(); oggi.setHours(12);
const SH={M:{n:"Mattino",s:420,e:840},P:{n:"Pomeriggio",s:840,e:1260},N:{n:"Notte",s:1260,e:1860}};
const ST={turniConfigurati:true,pattern:"R",anchor:"2000-01-01",shifts:SH,repeat:false,firstSeenAt:"2026-01-01",ecc:{}};
const nuova=async(url, nat, ai)=>{
  // senza service worker: le richieste che passano da lì non si possono simulare
  const ctx=await b.newContext({locale:"it-IT",viewport:{width:360,height:740}, serviceWorkers:"block"});
  if(nat) await ctx.addInitScript(nativo);
  await ctx.addInitScript(st=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
    localStorage.setItem("nt:state",JSON.stringify(st)); localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:firstPlanBannerChiuso","true"); }, ST);
  // il server vero non si tocca: senza AI risponde «spenta»
  await ctx.route("**/turni-ai", r=>r.request().method()==="GET" ? r.fulfill({json:{on:!!ai}, headers:{"access-control-allow-origin":"*"}}) : ai(r));
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.goto(url); await p.waitForTimeout(900);
  await p.click('[data-tab="turni"]'); await p.waitForTimeout(250);
  await p.click("#meseBox [data-mese-segna]"); await p.waitForTimeout(300);
  return p;
};
const stato=p=>p.evaluate(()=>JSON.parse(localStorage.getItem("nt:state")));
const giorno=n=>iso(new Date(oggi.getFullYear(), oggi.getMonth(), n, 12));
const tmp=mkdtempSync(join(tmpdir(),"nt-"));

// 1. web: pennelli
let p=await nuova("http://localhost:8765/index.html");
ok(await p.evaluate(()=>!document.querySelector("#segnaPagina").hidden && document.body.classList.contains("sottopagina") && getComputedStyle(document.querySelector("#cyc")).display==="none"), "la pagina si apre da Turni e nasconde il resto");
ok(await p.evaluate(()=>document.querySelectorAll("[data-pen]").length===8 && document.querySelector('[data-pen="M"]').getAttribute("aria-pressed")==="true"), "8 pennelli, il primo turno scelto");
ok(await p.evaluate(()=>document.querySelector("#sgDaCalendario").hidden && document.querySelector("#sgDaFoto").hidden), "sul web senza AI: niente calendario del telefono né foto");
await p.click('[data-pen="N"]');
await p.click('[data-sg="'+giorno(10)+'"]'); await p.click('[data-sg="'+giorno(11)+'"]');
let st=await stato(p);
ok(st.ecc[giorno(10)]==="N" && st.ecc[giorno(11)]==="N", "Notte segnata con un tocco per giorno");
ok(await p.evaluate(k=>{ const c=document.querySelector('[data-sg="'+k+'"]'); return c.classList.contains("mio") && c.classList.contains("notte") && /Notte/.test(c.getAttribute("aria-label")); }, giorno(10)), "la casella si colora e dice «Notte» a chi usa lo screen reader");
await p.click('[data-sg="'+giorno(11)+'"]'); st=await stato(p);
ok(!st.ecc[giorno(11)], "un secondo tocco con lo stesso pennello toglie");
await p.click('[data-pen="ferie"]'); await p.click('[data-sg="'+giorno(12)+'"]'); st=await stato(p);
ok(st.ecc[giorno(12)]==="R" && st.giorni[giorno(12)].t==="ferie", "Ferie col pennello");
await p.click('[data-pen="dettagli"]');
ok(/malattia, formazione/.test(await p.evaluate(()=>document.querySelector("#segnaOut .hint").textContent)), "«Altro…» spiega cosa fa");
await p.click('[data-sg="'+giorno(13)+'"]'); await p.waitForTimeout(250);
ok(await p.evaluate(()=>!document.querySelector("#quickShiftModal").hidden), "«Altro…» apre il foglio del giorno");
await p.click('[data-qs-spec="malattia"]'); await p.click("#qsClose"); await p.waitForTimeout(250);
ok(await p.evaluate(k=>/Malattia/.test(document.querySelector('[data-sg="'+k+'"]').getAttribute("aria-label")), giorno(13)), "chiuso il foglio, la griglia mostra la malattia");
// mese dopo e numeri del mese
await p.click('[data-sg-mese="1"]');
ok(await p.evaluate(()=>document.querySelectorAll("[data-sg]").length>=28), "si passa al mese dopo");
// 2. web: .ics del mese prossimo, con orari e un evento di tutto il giorno
const m1=new Date(oggi.getFullYear(), oggi.getMonth()+1, 1, 12), ymd=d=>iso(d).replace(/-/g,"");
const d=k=>new Date(m1.getFullYear(), m1.getMonth(), k, 12);
writeFileSync(join(tmp,"turni.ics"), ["BEGIN:VCALENDAR",
  "BEGIN:VEVENT","SUMMARY:Notte","DTSTART:"+ymd(d(1))+"T210000","DTEND:"+ymd(d(2))+"T070000","END:VEVENT",
  "BEGIN:VEVENT","SUMMARY:Smonto","DTSTART;VALUE=DATE:"+ymd(d(2)),"DTEND;VALUE=DATE:"+ymd(d(3)),"END:VEVENT",
  "BEGIN:VEVENT","SUMMARY:Mattino","DTSTART:"+ymd(d(3))+"T070000","DTEND:"+ymd(d(3))+"T160000","END:VEVENT",
  "BEGIN:VEVENT","SUMMARY:Dentista","DTSTART:"+ymd(d(4))+"T100000","DTEND:"+ymd(d(4))+"T110000","END:VEVENT","END:VCALENDAR"].join("\r\n"));
await p.setInputFiles("#sgFile", join(tmp,"turni.ics")); await p.waitForTimeout(600);
const mappa=await p.evaluate(()=>[...document.querySelectorAll("[data-imp-v]")].map(s=>s.closest(".sg-map") && s.previousElementSibling.querySelector("b").textContent+"="+s.value));
ok(mappa.join(",")==="Notte=N,Smonto=R,Mattino=M,Dentista=", "le voci del file riconosciute (il dentista si salta) → "+mappa);
await p.click("[data-imp-applica]"); await p.waitForTimeout(500); st=await stato(p);
ok(st.ecc[iso(d(1))]==="N" && st.ecc[iso(d(2))]==="R" && st.ecc[iso(d(3))]==="M" && st.giorni[iso(d(3))].e===960 && !st.ecc[iso(d(4))], "importati: notte, smonto come riposo, mattino con gli orari veri (fino alle 16)");
ok(/3 giorni segnati/.test(await p.evaluate(()=>document.querySelector("#toast").textContent)), "toast con Annulla");
await p.click(".toast-undo"); await p.waitForTimeout(300); st=await stato(p);
ok(!st.ecc[iso(d(1))] && !(st.giorni||{})[iso(d(3))] && st.ecc[giorno(10)]==="N", "Annulla: via l'importazione, restano i giorni segnati a mano");
// 3. web: .xlsx di reparto, scelta della riga
await p.setInputFiles("#sgFile", "tests/dati/turni-reparto.xlsx"); await p.waitForTimeout(600);
ok(await p.evaluate(()=>document.querySelectorAll("#sgRiga option").length===2), "foglio di reparto: si sceglie la propria riga");
await p.selectOption("#sgRiga", {label:"Benesso Davide"}); await p.click("[data-imp-riga]"); await p.waitForTimeout(400);
ok(await p.evaluate(()=>/30 giorni/.test(document.querySelector("#sgImport").textContent)), "30 giorni trovati nella riga scelta");
await p.click("[data-imp-annulla]"); await p.waitForTimeout(150);
ok(await p.evaluate(()=>document.querySelector("#sgImport").textContent===""), "Annulla chiude l'importazione senza segnare");
await p.click("#chiudiSegna"); await p.waitForTimeout(200);
ok(await p.evaluate(()=>document.querySelector("#segnaPagina").hidden && !document.body.classList.contains("sottopagina")), "freccia indietro: si torna a Turni");
await p.context().close();

// 4. app Android: calendario del telefono, due calendari, si sceglie quello dei turni
p=await nuova("http://localhost:8766/index.html", true);
await p.evaluate(([a,b])=>{ window.__cal=[{id:"1",title:"Personale"},{id:"7",title:"Turni reparto"}];
  window.__ev=[{title:"N",calendarId:"7",isAllDay:false,startDate:new Date(a+"T21:00:00").getTime(),endDate:new Date(b+"T07:00:00").getTime()},
    {title:"PD",calendarId:"7",isAllDay:true,startDate:Date.parse(b+"T00:00:00Z"),endDate:Date.parse(b+"T00:00:00Z")+864e5},
    {title:"Cena",calendarId:"1",isAllDay:false,startDate:new Date(a+"T20:00:00").getTime(),endDate:new Date(a+"T22:00:00").getTime()}]; }, [giorno(Math.min(oggi.getDate()+1,27)), giorno(Math.min(oggi.getDate()+2,28))]);
ok(await p.evaluate(()=>!document.querySelector("#sgDaCalendario").hidden), "nell'app c'è «Dal calendario del telefono»");
await p.click("#sgDaCalendario"); await p.waitForTimeout(400);
ok(await p.evaluate(()=>document.querySelectorAll("[data-imp-cal]").length===2), "si sceglie il calendario");
await p.click('[data-imp-cal="7"]'); await p.waitForTimeout(400);
await p.click("[data-imp-applica]"); await p.waitForTimeout(400); st=await stato(p);
const a1=giorno(Math.min(oggi.getDate()+1,27)), a2=giorno(Math.min(oggi.getDate()+2,28));
ok(st.ecc[a1]==="N" && st.giorni[a2].t==="reperibile" && st.ecc[a2]==="R", "dal calendario: la notte e la reperibilità (giorno senza turno)");
await p.context().close();

// 5. foto: niente parte senza consenso; poi i giorni letti
let mandate=0;
p=await nuova("http://localhost:8765/index.html", false, r=>{ mandate++; const j=JSON.parse(r.request().postData());
  r.fulfill({json:{leggibile:true, nota:"", giorni:[{data:a1, etichetta:"P"}], eco:j.nome}}); });
await p.waitForTimeout(300);
ok(await p.evaluate(()=>!document.querySelector("#sgDaFoto").hidden), "con il server pronto c'è «Da una foto o un PDF»");
await p.click("#sgDaFoto"); await p.waitForTimeout(150);
ok(await p.evaluate(()=>document.querySelector("#sgScegliFoto").disabled && /Anthropic/.test(document.querySelector("#sgImport").textContent)), "prima il consenso: si dice dove va il file, il pulsante è spento");
await p.fill("#sgNome","Benesso"); await p.click('label[for="sgOk"]');
ok(await p.evaluate(()=>!document.querySelector("#sgScegliFoto").disabled), "dopo «Ho capito» si può scegliere il file");
await p.click("#sgScegliFoto");
writeFileSync(join(tmp,"f.png"), Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==","base64"));
await p.setInputFiles("#sgFoto", join(tmp,"f.png")); await p.waitForTimeout(800);
ok(mandate===1 && await p.evaluate(()=>/1 giorno/.test(document.querySelector("#sgImport").textContent)), "la foto letta torna come giorni da confermare");
await p.context().close();
ok(!errs.length, "nessun errore di pagina "+JSON.stringify(errs));
await b.close();
