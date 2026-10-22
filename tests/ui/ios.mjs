// iPhone (Safari simulato): "Scegli giorno" apre il selettore con un tocco
// vero sul campo data sopra il bottone, niente zoom su doppio tocco e campi.
import pw from "./_pw.mjs";
const ok=(c,m)=>{ console.log((c?"✔ ":"✘ ")+m); };
const b=await pw.chromium.launch(); const errs=[];
const ctx=await b.newContext({locale:"it-IT",viewport:{width:390,height:844},hasTouch:true,isMobile:true,
  userAgent:"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"});
const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(700);
await p.click("text=Conosco già il mio schema"); await p.click("[data-preset-ob='0']"); await p.click("[data-pos='0']"); await p.click("#qhConfermaOrari"); await p.waitForTimeout(500);
await p.evaluate(()=>{const c=document.querySelector("#doChiudiPrimoPiano"); if(c) c.click();});
ok(await p.evaluate(()=>document.documentElement.classList.contains("ios")), "iPhone riconosciuto");
// Oggi: si tocca la data in alto; Turni: «Scegli giorno». Dopo la scelta, in
// Oggi compare «Oggi» accanto alla data, in Turni il bottone diventa «Torna a oggi».
for(const [tab,id,torna,testo] of [["oggi","dateLabel","goToday","Oggi"],["turni","cycToday","cycToday","Torna a oggi"]]){
  await p.click('[data-tab="'+tab+'"]'); await p.waitForTimeout(400);
  const r=await p.evaluate(id=>{ const bt=document.getElementById(id), r=bt.getBoundingClientRect();
    const top=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2);
    return {sopra: top && top.classList.contains("today-pick"), fs:top?getComputedStyle(top).fontSize:""}; }, id);
  ok(r.sopra && r.fs==="16px", tab+": il tocco sulla data arriva al campo data (iOS apre il selettore) · "+JSON.stringify(r));
  // scelta di una data come farebbe il selettore
  const dataScelta=await p.evaluate(id=>{ const inp=document.getElementById(id).parentElement.querySelector(".today-pick");
    const d=new Date(); d.setDate(d.getDate()+5); const v=d.toISOString().slice(0,10);
    inp.value=v; inp.dispatchEvent(new Event("change",{bubbles:true})); return v; }, id);
  await p.waitForTimeout(400);
  const dopo=await p.evaluate(id=>{ const bt=document.getElementById(id), r=bt.getBoundingClientRect();
    const top=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2);
    return {testo:bt.textContent, alBottone: top===bt}; }, torna);
  ok(dopo.testo===testo && dopo.alBottone, tab+": dopo la scelta ("+dataScelta+") il bottone dice «"+testo+"» e il tocco va a lui · "+JSON.stringify(dopo));
  await p.click("#"+torna); await p.waitForTimeout(300);
}
const z=await p.evaluate(()=>({ta:getComputedStyle(document.documentElement).touchAction,
  campi:[...document.querySelectorAll("input[type=time],input[type=text],input[type=number],select")].filter(e=>e.offsetParent).map(e=>getComputedStyle(e).fontSize).filter(f=>parseFloat(f)<16).length}));
ok(z.ta==="manipulation", "niente zoom col doppio tocco (touch-action: manipulation)");
ok(z.campi===0, "campi visibili a 16px o più: Safari non zooma entrando");
// PDF: su iPhone niente window.print() (dall'app sulla Home non apre niente):
// un file PDF vero nel pannello di condivisione
await p.evaluate(()=>{ window.__files=[]; window.__printed=0; navigator.canShare=()=>true;
  navigator.share=async(o)=>{ for(const f of o.files||[]){ const t=await f.text(); window.__files.push({name:f.name, type:f.type, head:t.slice(0,8), pagine:(t.match(/\/Type \/Page /g)||[]).length}); } };
  window.print=()=>{ window.__printed++; }; });
await p.click('[data-tab="turni"]'); await p.waitForTimeout(300);
await p.evaluate(()=>document.querySelector("#doPrint").click()); await p.waitForTimeout(800);
const pdf=await p.evaluate(()=>({f:window.__files, printed:window.__printed}));
ok(pdf.printed===0 && pdf.f.length===1 && pdf.f[0].head.startsWith("%PDF-1.4") && pdf.f[0].type==="application/pdf" && pdf.f[0].pagine===2,
  "iPhone: «Stampa o salva in PDF» condivide un PDF di 2 pagine (calendario + giorno per giorno) → "+JSON.stringify(pdf));
// installazione: prima voce di "Rendi automatico il tuo piano"
await p.click('[data-tab="oggi"]'); await p.waitForTimeout(400);
const voce=await p.evaluate(()=>{ const v=document.querySelector("#setupChecklist:not([hidden]) .attiva-voce"); return v ? v.dataset.attiva+" | "+v.innerText.replace(/\n/g," ") : "(niente)"; });
ok(/^installa .*schermata Home/.test(voce), "iPhone: la lista parte da «Aggiungila alla schermata Home» → "+voce);
await p.click('#setupChecklist [data-attiva="installa"]'); await p.waitForTimeout(300);
const t=await p.evaluate(()=>{ const e=document.querySelector("#toast"); return e?e.innerText:""; });
ok(/Condividi.*Aggiungi alla schermata Home/.test(t), "iPhone: il tocco spiega come fare in Safari → "+t);
// Android/Chrome: la voce compare quando Chrome dice che si può installare
const ctx2=await b.newContext({locale:"it-IT",viewport:{width:390,height:844},hasTouch:true,isMobile:true,
  userAgent:"Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36"});
const a=await ctx2.newPage(); a.on("pageerror",e=>errs.push(e.message));
await a.goto("http://localhost:8765/index.html"); await a.waitForTimeout(700);
await a.click("text=Conosco già il mio schema"); await a.click("[data-preset-ob='0']"); await a.click("[data-pos='0']"); await a.click("#qhConfermaOrari"); await a.waitForTimeout(500);
await a.evaluate(()=>{const c=document.querySelector("#doChiudiPrimoPiano"); if(c) c.click();});
const prima=await a.evaluate(()=>!!document.querySelector('#setupChecklist [data-attiva="installa"]'));
await a.evaluate(()=>{ window.__prompt=0; const ev=new Event("beforeinstallprompt"); ev.prompt=()=>{ window.__prompt++; }; ev.userChoice=Promise.resolve({outcome:"accepted"}); window.dispatchEvent(ev); });
await a.waitForTimeout(300);
const dopo=await a.evaluate(()=>{ const v=document.querySelector("#setupChecklist .attiva-voce"); return v ? v.dataset.attiva : ""; });
ok(!prima && dopo==="installa", "Android: «Installala sul telefono» compare in cima quando Chrome lo permette (prima: "+prima+", poi: "+dopo+")");
await a.click('#setupChecklist [data-attiva="installa"]'); await a.waitForTimeout(400);
const dopoInst=await a.evaluate(()=>({p:window.__prompt, voce:!!document.querySelector('#setupChecklist [data-attiva="installa"]')}));
ok(dopoInst.p===1 && !dopoInst.voce, "Android: il tocco apre la richiesta di Chrome e, installata, la voce sparisce → "+JSON.stringify(dopoInst));
console.log("errori", errs); await b.close();
