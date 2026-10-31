// Debito di sonno: dopo un sonno lungo niente recupero; dopo notti corte il piano lo dice e spiega perché (pisolino, o notte più lunga oltre le 3 ore).
import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const fa=n=>{ const d=new Date(); d.setDate(d.getDate()-n); return iso(d); };
async function apri(wake, bed="00:30", prima=0){
  const ctx=await b.newContext({locale:"it-IT",viewport:{width:360,height:740}});
  const st={turniConfigurati:true,pattern:"PRRMMRR",anchor:fa(0),shifts:{P:{n:"Pomeriggio",s:840,e:1260},M:{n:"Mattino",s:420,e:840}},repeat:true,
    firstSeenAt:fa(20),freeBed:"00:30",freeWake:"08:30",beds:{[fa(0)]:bed},wakes:{[fa(0)]:wake}};
  for(let i=1;i<=prima;i++){ st.beds[fa(i)]="02:30"; st.wakes[fa(i)]="08:30"; }
  await ctx.addInitScript(st=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
    localStorage.setItem("nt:state",JSON.stringify(st)); for(const k of ["turniConfigurati","firstPlanBannerChiuso","attivazioneNascosta","backupDone","novitaProva"]) localStorage.setItem("nt:"+k,"true");
    localStorage.setItem("nt:novitaViste",JSON.stringify("2099-01-01")); }, st);
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(4600);
  return p;
}
{ const p=await apri("10:30");
  const m=await p.evaluate(()=>{ const t=document.body.innerText, i=t.search(/pisolino di recupero/i); return i<0?"":t.slice(Math.max(0,i-80),i+60); });
  ok(!m, "10 ore di sonno: nessun pisolino di recupero");
  await p.context().close(); }
{ const p=await apri("08:30","02:30");
  const t=await p.evaluate(()=>(document.querySelector(".drem-rec")||{}).textContent||"");
  ok(/Da recuperare: .* di sonno · pisolino alle \d\d:\d\d/.test(t) || /il piano propone un pisolino alle/.test(t), "una notte corta: una riga di stato dice che il piano ha aggiunto un pisolino → "+t.slice(0,130));
  await p.context().close(); }
{ const p=await apri("08:30","02:30",2);
  const t=await p.evaluate(()=>[...document.querySelectorAll(".drem-stato")].map(e=>e.textContent).join(" | "));
  ok(/Da recuperare: .* di sonno · stanotte \+\d+ min/.test(t) && (await p.evaluate(()=>document.querySelectorAll(".drem-stato").length))===1, "tre notti corte: UNA riga di stato, con la notte più lunga → "+t.slice(0,120));
  await p.evaluate(()=>document.querySelector("[data-info-debito]").click()); await p.waitForTimeout(300);
  ok(await p.evaluate(()=>!document.querySelector("#infoModal").hidden && /cala solo dormendo/i.test(document.querySelector("#infoCorpo").textContent)), "«Perché?» apre il foglio con la spiegazione");
  await p.context().close(); }
console.log("errori",errs); ok(errs.length===0,"nessun errore di pagina"); await b.close();
