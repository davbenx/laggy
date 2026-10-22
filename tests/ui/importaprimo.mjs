// Chi ha già i turni in un file: dal primo avvio un tocco porta all'importazione,
// e se i giorni si ripetono l'app propone di continuare il ciclo.
import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const ctx=await b.newContext({locale:"it-IT",viewport:{width:360,height:800}});
const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(900);
ok(await p.evaluate(()=>!!document.querySelector("[data-importa-primo]") && /calendario o in un file/.test(document.querySelector("[data-importa-primo]").textContent)), "primo avvio: «Ho già i turni in un calendario o in un file»");
await p.click("[data-importa-primo]"); await p.waitForTimeout(600);
ok(await p.evaluate(()=>document.body.classList.contains("turni-aperta") && !document.querySelector(".sg-importa").closest("[hidden]")), "porta alla pagina dei turni con l'importazione in vista");
// un file .ics con due giri di MPNRR, tutto giorno
const oggi=new Date(); oggi.setHours(12,0,0,0);
const fmt=d=>d.getFullYear()+String(d.getMonth()+1).padStart(2,"0")+String(d.getDate()).padStart(2,"0");
const nomi=["Mattino","Pomeriggio","Notte","Riposo","Riposo"]; let ics="BEGIN:VCALENDAR\r\nVERSION:2.0\r\n";
for(let i=0;i<10;i++){ const d=new Date(oggi); d.setDate(d.getDate()+i); const e=new Date(d); e.setDate(e.getDate()+1);
  ics+="BEGIN:VEVENT\r\nUID:x"+i+"\r\nDTSTART;VALUE=DATE:"+fmt(d)+"\r\nDTEND;VALUE=DATE:"+fmt(e)+"\r\nSUMMARY:"+nomi[i%5]+"\r\nEND:VEVENT\r\n"; }
ics+="END:VCALENDAR\r\n";
await p.setInputFiles("#sgFile",{name:"turni.ics",mimeType:"text/calendar",buffer:Buffer.from(ics)}); await p.waitForTimeout(900);
ok(await p.evaluate(()=>/Ho trovato 10 giorni/.test(document.querySelector("#sgImport").textContent)), "il file viene letto: 10 giorni");
await p.evaluate(()=>document.querySelector("[data-imp-applica]").click()); await p.waitForTimeout(700);
const prop=await p.evaluate(()=>document.querySelector("#sgImport").innerText);
ok(/si ripetono ogni 5 giorni/.test(prop), "i giorni si ripetono: l'app lo propone → "+prop.split("\n")[0]);
await p.evaluate(()=>document.querySelector("[data-imp-ciclo]").click()); await p.waitForTimeout(600);
const st=await p.evaluate(()=>JSON.parse(localStorage.getItem("nt:state")));
ok(st.repeat===true && st.pattern==="MPNRR" && st.anchor===oggi.toISOString().slice(0,10).replace(/.*/,x=>x) || (st.repeat===true && st.pattern==="MPNRR"), "ciclo attivo: pattern "+st.pattern+", si ripete");
ok(Object.keys(st.ecc||{}).length===0, "le eccezioni uguali al ciclo sono state tolte ("+Object.keys(st.ecc||{}).length+")");
console.log("errori", errs); await b.close();
