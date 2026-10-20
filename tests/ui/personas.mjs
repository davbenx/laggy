import pw from "./_pw.mjs";
const ok=(c,m)=>{ console.log((c?"✔ ":"✘ ")+m); if(!c) process.exitCode=1; };
const b = await pw.chromium.launch();
const errs=[];
async function nuovo(){ const ctx=await b.newContext({viewport:{width:390,height:844},colorScheme:"dark",locale:"it-IT"}); const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message)); await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(1200); return p; }
const st = p => p.evaluate(()=>{ const s=JSON.parse(localStorage.getItem("nt:state")||"{}"); return {pattern:s.pattern, anchor:s.anchor, repeat:s.repeat, shifts:s.shifts, ecc:s.ecc, pill:document.querySelector("#shiftPill").textContent, primo:document.body.classList.contains("primo-avvio"), banner:document.querySelector("#firstPlanBanner").hidden?null:document.querySelector("#firstPlanBanner").innerText.split("\n")[0]}; });
const shot = (p,n) => p.screenshot({path:"/tmp/pp-"+n+".png"});
const setTime = (p,sel,v) => p.fill(sel,v);
const oggiIso = new Date().toISOString().slice(0,10);
const dIso = o => { const d=new Date(); d.setDate(d.getDate()+o); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };

// P1 notte con orario diverso, solo oggi
let p = await nuovo(); await shot(p,"0-home");
await p.click("[data-pick=N]"); await p.waitForTimeout(200); await shot(p,"1-orario");
await setTime(p,"#qhDa","22:00"); await setTime(p,"#qhA","06:00");
await p.click("#qhConfermaOrario"); await p.waitForTimeout(700); let s=await st(p); await shot(p,"2-piano-oggi");
ok(s.shifts.N.s===1320 && s.shifts.N.e===1800 && /Notte/.test(s.pill) && s.repeat===false && !s.primo, "P1 Notte 22–06 solo oggi: turno salvato "+s.shifts.N.s+"–"+s.shifts.N.e+", oggi "+s.pill);
ok(/prossimi giorni/.test(s.banner||""), "P1 banner chiede dei prossimi giorni: "+s.banner);
ok(await p.evaluate(()=>document.querySelector("#loSapevi").hidden), "P1 nessun consiglio il primo giorno");
// domani: un tocco dal piano
await p.click("#next"); await p.waitForTimeout(300); await shot(p,"3-domani");
const chips = await p.evaluate(()=>[...document.querySelectorAll("[data-turno-giorno]")].map(b=>b.textContent));
ok(chips.length>=2 && await p.evaluate(()=>/Che turno fai domani/.test(document.querySelector("#status").innerText)), "P1 domani: 'Che turno fai domani?' con "+chips.join("/"));
await p.click("[data-turno-giorno=N]"); await p.waitForTimeout(400); s=await st(p);
ok(s.ecc[dIso(1)]==="N" && /Notte/.test(s.pill), "P1 un tocco imposta domani: "+s.pill);
// Turni: un giorno '?' si imposta al tocco
await p.click("#goToday").catch(()=>{});
await p.evaluate(()=>[...document.querySelectorAll("#tabbar button")].find(b=>/Turni/.test(b.textContent)).click()); await p.waitForTimeout(400);
await p.evaluate(()=>{ const r=[...document.querySelectorAll("#cyc .crow")].find(r=>/\?/.test(r.innerText)); r && r.click(); }); await p.waitForTimeout(300);
ok(await p.evaluate(()=>!document.querySelector("#quickShiftModal").hidden), "P1 in Turni il tocco su un giorno da impostare apre la scelta del turno");

// P2 notte che inizia a mezzanotte
p = await nuovo(); await p.click("[data-pick=N]"); await setTime(p,"#qhDa","00:00"); await setTime(p,"#qhA","08:00"); await p.click("#qhConfermaOrario"); await p.waitForTimeout(500); s=await st(p);
ok(s.shifts.N.s===1440 && s.shifts.N.e===1920, "P2 Notte 00–08: è la notte di stasera ("+s.shifts.N.s+"–"+s.shifts.N.e+")");

// P3 mattino 06:30, poi ciclo in quinta, orario mantenuto
p = await nuovo(); await p.click("[data-pick=M]"); await setTime(p,"#qhDa","06:30"); await setTime(p,"#qhA","13:30"); await p.click("#qhConfermaOrario"); await p.waitForTimeout(500);
await p.click("#doProssimiCiclo"); await p.waitForTimeout(300); await shot(p,"4-catalogo");
const titoli = await p.evaluate(()=>[...document.querySelectorAll("[data-preset-ob] b")].map(b=>b.textContent));
ok(titoli.length>=10 && titoli.includes("Ciclo continuo") && titoli.includes("2 · 2 · 2 · 2") && titoli.includes("In sesta"), "P3 catalogo unico ("+titoli.length+" schemi): "+titoli.join(", "));
await p.click("[data-preset-ob='0']"); await p.waitForTimeout(200); await shot(p,"5-posizione");
await p.click("[data-pos='0']"); await p.waitForTimeout(200); await shot(p,"6-orari");
const mOra = await p.evaluate(()=>document.querySelector('[data-ora-da="M"]').value);
ok(mOra==="06:30", "P3 negli orari dello schema il Mattino resta 06:30 come confermato");
await p.fill('[data-ora-da="N"]',"22:00"); await p.fill('[data-ora-a="N"]',"07:00");
await p.click("#qhConfermaOrari"); await p.waitForTimeout(600); s=await st(p);
ok(s.pattern==="MPNSR" && s.repeat===true && /Mattino/.test(s.pill) && s.shifts.N.s===1320 && s.shifts.N.e===1860 && s.shifts.M.s===390, "P3 in quinta, oggi Mattino, notte 22–07, mattino 06:30 → "+s.pill);

// P4 dalla home: ciclo continuo, oggi 3° pomeriggio
p = await nuovo(); await p.click("text=Conosco già il mio schema"); await p.waitForTimeout(200);
const idxCC = await p.evaluate(()=>[...document.querySelectorAll("[data-preset-ob]")].find(b=>/Ciclo continuo/.test(b.textContent)).dataset.presetOb);
await p.click("[data-preset-ob='"+idxCC+"']"); await p.click("[data-pos='6']"); await p.click("#qhConfermaOrari"); await p.waitForTimeout(600); s=await st(p);
ok(s.pattern==="MMMMPPPPNNNNRRRR" && /Pomeriggio 3\/4/.test(s.pill), "P4 ciclo continuo, oggi "+s.pill);
await p.click("#next"); await p.click("#next"); await p.waitForTimeout(300); s=await st(p);
ok(/Notte 1\/4/.test(s.pill), "P4 tra due giorni: "+s.pill);

// P5 notte fissa con riposi lunedì e martedì
p = await nuovo(); await p.click("[data-pick=N]"); await setTime(p,"#qhDa","22:00"); await setTime(p,"#qhA","06:00"); await p.click("#qhConfermaOrario"); await p.waitForTimeout(400);
await p.click("#doProssimiFisso"); await p.waitForTimeout(200);
await p.click("[data-gg='5']"); await p.click("[data-gg='6']"); await p.click("[data-gg='0']"); await p.click("[data-gg='1']"); await shot(p,"7-riposi");
await p.click("#qhConfermaRiposi"); await p.waitForTimeout(600); s=await st(p);
const dow=(new Date().getDay()+6)%7, atteso=(dow===0||dow===1)?"R":"N";
ok(s.pattern==="RRNNNNN" && s.repeat===true && s.shifts.N.s===1320, "P5 notte fissa, riposo lun+mar: "+s.pattern+", oggi "+s.pill+(s.ecc[oggiIso]?" (eccezione oggi "+s.ecc[oggiIso]+")":""));

// P6 turni variabili: griglia dei prossimi giorni
p = await nuovo(); await p.click("[data-pick=M]"); await p.click("#qhConfermaOrario"); await p.waitForTimeout(400);
await p.click("#doProssimiSegna"); await p.waitForTimeout(200);
const tap=async(o,n)=>{ for(let i=0;i<n;i++){ await p.click('[data-segna="'+dIso(o)+'"]'); } };
await tap(1,1); await tap(2,3); await tap(3,4); await tap(4,2); await shot(p,"8-segna");
await p.click("#qhAltriGiorni"); const celle=await p.evaluate(()=>document.querySelectorAll("[data-segna]").length);
await p.click("#qhConfermaSegna"); await p.waitForTimeout(600); s=await st(p);
ok(s.ecc[dIso(1)]==="M" && s.ecc[dIso(2)]==="N" && s.ecc[dIso(3)]==="R" && s.ecc[dIso(4)]==="P" && s.repeat===false, "P6 giorni segnati: "+[1,2,3,4].map(o=>s.ecc[dIso(o)]).join(",")+" (griglia estendibile a "+celle+" giorni)");
await p.evaluate(()=>{ for(let i=0;i<5;i++) document.querySelector("#next").click(); }); await p.waitForTimeout(300);
ok(await p.evaluate(()=>/Che turno fai/.test(document.querySelector("#status").innerText)), "P6 un giorno non segnato chiede il turno con un tocco");
ok(/pronto\./.test((await st(p)).banner||"") || (await st(p)).banner===null, "P6 dopo aver segnato i giorni il banner non richiede più i prossimi giorni");

// P7 riposo oggi
p = await nuovo(); await p.click("[data-pick=R]"); await p.waitForTimeout(500); s=await st(p);
ok(/Riposo/.test(s.pill) && /prossimi giorni/.test(s.banner||""), "P7 riposo oggi: "+s.pill+", banner: "+s.banner);

// P8 "componilo" apre la configurazione completa, che usa lo stesso catalogo
p = await nuovo(); await p.click("text=Conosco già il mio schema"); await p.click("#doCustomRot"); await p.waitForTimeout(300);
ok(await p.evaluate(()=>document.querySelector("#demoEsempio .qh-h").textContent==="Componi il tuo ciclo" && !document.body.classList.contains("wiz-open")), "P8 'lo compongo io' resta nel flusso (compositore), non apre la configurazione completa");

console.log("errori pagina:", errs);
await b.close();
