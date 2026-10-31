// Tempo libero in comune con una persona in smonto notte: il suo sonno si stima (sonno pieno di giorno), non è «11:25».
import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const fa=n=>{ const d=new Date(); d.setDate(d.getDate()-n); return iso(d); };
const SH={M:{n:"Mattino",s:420,e:840},P:{n:"Pomeriggio",s:840,e:1260},N:{n:"Notte",s:1320,e:1800}};
const st={turniConfigurati:true,pattern:"RRRR",anchor:fa(0),shifts:SH,repeat:true,firstSeenAt:fa(40),freeBed:"23:30",freeWake:"07:30",
  people:[{name:"Anna",pattern:"NNRR",anchor:fa(2)}],
  // il MIO diario corto non deve toccare il piano di lei
  beds:{[fa(0)]:"04:00"},wakes:{[fa(0)]:"07:00"}};
const b=await pw.chromium.launch(); const errs=[]; const ctx=await b.newContext({locale:"it-IT",viewport:{width:360,height:900}});
await ctx.addInitScript(st=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1"); localStorage.setItem("nt:state",JSON.stringify(st)); for(const k of ["turniConfigurati","firstPlanBannerChiuso","attivazioneNascosta","backupDone","novitaProva"]) localStorage.setItem("nt:"+k,"true"); localStorage.setItem("nt:novitaViste",JSON.stringify("2099-01-01")); localStorage.setItem("nt:wakes",JSON.stringify(st.wakes)); localStorage.setItem("nt:beds",JSON.stringify(st.beds)); },st);
const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(3500);
await p.evaluate(()=>document.querySelector('[data-tab="turni"]').click()); await p.waitForTimeout(300);
await p.evaluate(()=>document.querySelector("#doPartner").click()); await p.waitForTimeout(600);
const t=await p.evaluate(()=>document.querySelector("#partner").innerText.replace(/\n+/g," | "));
const m=/CON ANNA \| \S+ (\d\d):(\d\d) → \d\d:\d\d/i.exec(t);
ok(!!m && (+m[1])*60+(+m[2])>=13*60, "il giorno di smonto di Anna: si è liberi insieme dalle 13:25 circa, non dalle 11:25 → "+(m?m[0]:t.slice(0,200)));
ok(/Il loro sonno è una stima/.test(t), "una riga dice che il suo sonno è una stima");
console.log("errori",errs); ok(errs.length===0,"nessun errore di pagina"); await b.close();
