import pw from "./_pw.mjs";
const ok=(c,m)=>{ console.log((c?"✔ ":"✘ ")+m); if(!c) process.exitCode=1; };
const b=await pw.chromium.launch(); const errs=[];
const nuovo=async()=>{ const ctx=await b.newContext({viewport:{width:390,height:844},locale:"it-IT",colorScheme:"dark"}); const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message)); return p; };
const st=p=>p.evaluate(()=>{ const s=JSON.parse(localStorage.getItem("nt:state")||"{}"); return {pattern:s.pattern, shifts:s.shifts, repeat:s.repeat, pill:document.querySelector("#shiftPill").textContent, tab:[...document.body.classList].find(c=>c.startsWith("tab-")), opz:document.body.classList.contains("tab-opzioni"), wiz:document.body.classList.contains("wiz-open")||document.body.classList.contains("intro")}; });

// 1. avvio: niente lampo dell'avviso
let p=await nuovo();
const lampo=[]; p.on("framenavigated",()=>{});
await p.goto("http://localhost:8765/index.html",{waitUntil:"commit"});
for(let i=0;i<15;i++){ await p.waitForTimeout(40); lampo.push(await p.evaluate(()=>{ const j=document.getElementById("jsoff"); return !!(j && j.offsetParent!==null); }).catch(()=>false)); }
ok(!lampo.some(Boolean), "avvio: l'avviso 'la pagina non si è avviata' non compare mai (campionato 15 volte nei primi 600 ms)");

// 2. componi un ciclo che non c'è: M N + 12h + S R R
await p.waitForTimeout(500);
await p.click("text=Conosco già il mio schema"); await p.click("#doCustomRot"); await p.waitForTimeout(200);
await p.screenshot({path:"/tmp/c-1-vuoto.png"});
await p.click('[data-aggiungi="M"]'); await p.click('[data-aggiungi="N"]');
await p.click("#qhNuovoTurno"); await p.fill("#qhNtNome","Giorno 12h"); await p.fill("#qhNtDa","08:00"); await p.fill("#qhNtA","20:00"); await p.click("#qhNtSalva");
await p.click('[data-aggiungi="S"]'); await p.click('[data-aggiungi="R"]'); await p.click('[data-aggiungi="R"]'); await p.click('[data-aggiungi="R"]');
await p.click('[data-togli="6"]');   // tolgo l'ultimo riposo
await p.screenshot({path:"/tmp/c-2-composto.png"});
const seq=await p.evaluate(()=>[...document.querySelectorAll("[data-togli]")].map(b=>b.textContent.replace(/^\d+/,"")));
ok(seq.join(",")==="Mattino,Notte,Giorno 12h,Smonto,Riposo,Riposo", "ciclo composto toccando i turni: "+seq.join(" · "));
await p.click("#qhComponiAvanti"); await p.waitForTimeout(150); await p.screenshot({path:"/tmp/c-3-posizione.png"});
await p.click("[data-pos='2']"); await p.waitForTimeout(150); await p.screenshot({path:"/tmp/c-4-orari.png"});
const righe=await p.evaluate(()=>[...document.querySelectorAll(".qh-ore-riga b")].map(b=>b.textContent));
ok(righe.join(",")==="Mattino,Notte,Giorno 12h", "orari solo dei turni usati nel ciclo: "+righe.join(", "));
await p.click("#qhConfermaOrari"); await p.waitForTimeout(600); let s=await st(p);
ok(s.pattern.length===6 && s.repeat && /Giorno 12h/.test(s.pill) && !s.opz && !s.wiz, "ciclo di 6 giorni attivo, oggi "+s.pill+", mai passato dalle Opzioni o dalla configurazione completa");

// 3. Turni → Modifica: stesso flusso, ciclo attuale già caricato
await p.evaluate(()=>document.querySelector('#tabbar [data-tab="turni"]').click()); await p.waitForTimeout(200);
await p.click("#tEdit"); await p.waitForTimeout(300); s=await st(p);
const titolo=await p.evaluate(()=>document.querySelector("#demoEsempio .qh-h").textContent);
ok(titolo==="Come sono i tuoi turni?" && !s.opz, "Turni → Modifica apre il flusso lineare ('"+titolo+"'), non le Opzioni");
await p.click('[data-subflow="schema"]'); await p.click("#doCustomRot"); await p.waitForTimeout(150);
const pre=await p.evaluate(()=>document.querySelectorAll("[data-togli]").length);
ok(pre===6, "il compositore parte dal ciclo attuale ("+pre+" giorni)");
await p.click("[data-chiudi-schema]").catch(async()=>{ await p.evaluate(()=>{ sceltaSchemaAperta=false; }); });

// 4. impegno importante: senza impegno segnato, nessuna riga (né inviti) su nessun giorno
p=await nuovo(); await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(700);
await p.click("[data-pick=N]"); await p.click("#qhConfermaOrario"); await p.waitForTimeout(400); await p.click("#doChiudiPrimoPiano");
const luc=()=>p.evaluate(()=>/lucid|in forma/i.test(document.querySelector("#luciditaGiornoWrap").innerText));
ok(!(await luc()), "impegno: nessuna riga oggi");
await p.click("#prev"); await p.waitForTimeout(200); ok(!(await luc()), "impegno: nessuna riga ieri");
await p.click("#next"); await p.click("#next"); await p.waitForTimeout(200); ok(!(await luc()), "impegno: nessun invito sui giorni futuri");
console.log("errori:", errs); await b.close();
