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
for(const [tab,id] of [["oggi","goToday"],["turni","cycToday"]]){
  await p.click('[data-tab="'+tab+'"]'); await p.waitForTimeout(400);
  const r=await p.evaluate(id=>{ const bt=document.getElementById(id), r=bt.getBoundingClientRect();
    const top=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2);
    return {sopra: top && top.classList.contains("today-pick"), fs:top?getComputedStyle(top).fontSize:""}; }, id);
  ok(r.sopra && r.fs==="16px", tab+": il tocco su «Scegli giorno» arriva al campo data (iOS apre il selettore) · "+JSON.stringify(r));
  // scelta di una data come farebbe il selettore
  const dataScelta=await p.evaluate(id=>{ const inp=document.getElementById(id).parentElement.querySelector(".today-pick");
    const d=new Date(); d.setDate(d.getDate()+5); const v=d.toISOString().slice(0,10);
    inp.value=v; inp.dispatchEvent(new Event("change",{bubbles:true})); return v; }, id);
  await p.waitForTimeout(400);
  const dopo=await p.evaluate(id=>{ const bt=document.getElementById(id), r=bt.getBoundingClientRect();
    const top=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2);
    return {testo:bt.textContent, alBottone: top===bt}; }, id);
  ok(dopo.testo==="Torna a oggi" && dopo.alBottone, tab+": dopo la scelta ("+dataScelta+") il bottone dice «Torna a oggi» e il tocco va a lui · "+JSON.stringify(dopo));
  await p.click("#"+id); await p.waitForTimeout(300);
}
const z=await p.evaluate(()=>({ta:getComputedStyle(document.documentElement).touchAction,
  campi:[...document.querySelectorAll("input[type=time],input[type=text],input[type=number],select")].filter(e=>e.offsetParent).map(e=>getComputedStyle(e).fontSize).filter(f=>parseFloat(f)<16).length}));
ok(z.ta==="manipulation", "niente zoom col doppio tocco (touch-action: manipulation)");
ok(z.campi===0, "campi visibili a 16px o più: Safari non zooma entrando");
console.log("errori", errs); await b.close();
