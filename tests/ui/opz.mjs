// Impostazioni → «I tuoi turni»: la stessa pagina di Turni › Modifica, e ←
// torna alle Impostazioni (non a Oggi, non a Turni).
import pw from "./_pw.mjs";
const b=await pw.chromium.launch(); const p=await (await b.newContext({locale:"it-IT"})).newPage(); const errs=[]; p.on("pageerror",e=>errs.push(e.message));
await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(700);
await p.click("text=Conosco già il mio schema"); await p.click("[data-preset-ob='0']"); await p.click("[data-pos='0']"); await p.click("#qhConfermaOrari"); await p.waitForTimeout(400);
await p.click("#doOpzioni"); await p.click('[data-opzg-vai="turni"]'); await p.waitForTimeout(300);
const t=await p.evaluate(()=>[...document.body.classList].join(" ")+" | "+document.querySelector("#tuoiTurniPagina h1").textContent);
console.log((/turni-aperta/.test(t)&&/I tuoi turni/.test(t)?"✔":"✘")+" Impostazioni → I tuoi turni apre la pagina: "+t);
await p.click("#chiudiTuoiTurni"); await p.waitForTimeout(300);
console.log((await p.evaluate(()=>document.body.classList.contains("tab-opzioni"))?"✔":"✘")+" ← torna alle Impostazioni");
console.log("errori", errs); await b.close();
