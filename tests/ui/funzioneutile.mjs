// «Quale funzione ti mancherebbe di più?»: una domanda neutra, una volta sola, solo con le statistiche accese; la risposta è un contatore anonimo.
import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const apri=async({giorni, ora=10, extra={}})=>{
  const t=new Date(); t.setHours(ora,0,0,0);
  const ctx=await b.newContext({locale:"it-IT",viewport:{width:360,height:740}});
  await ctx.clock.install({time:t});
  const ev=[]; await ctx.route("**/collect", r=>{ try{ const j=JSON.parse(r.request().postData()); ev.push(j.event+(j.props&&Object.keys(j.props).length?":"+Object.values(j.props).join(","):"")); }catch(e){} r.fulfill({status:204}); });
  await ctx.addInitScript(([a,g,extra])=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
    const f=new Date(a+"T12:00:00"); f.setDate(f.getDate()-g);
    const I=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
    localStorage.setItem("nt:state",JSON.stringify({turniConfigurati:true,pattern:"RRRRRRR",anchor:a,shifts:{M:{n:"Mattino",s:420,e:840}},repeat:true,firstSeenAt:I(f),freeBed:"23:30",freeWake:"07:30"}));
    localStorage.setItem("nt:attivazioneNascosta","true"); localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:firstPlanBannerChiuso","true");
    localStorage.setItem("nt:analytics-consent","true"); localStorage.setItem("nt:backupDone","true"); localStorage.setItem("nt:novitaViste",JSON.stringify("2099"));
    for(const k in extra) localStorage.setItem("nt:"+k, JSON.stringify(extra[k])); }, [iso(t), giorni, extra]);
  const p=await ctx.newPage(); p.ev=ev; p.on("pageerror",e=>errs.push(e.message));
  await p.goto("http://localhost:8765/index.html"); await p.clock.runFor(2000);
  return p;
};
const sapevi=p=>p.evaluate(()=>{ const e=document.querySelector("#loSapevi"); return e&&!e.hidden?e.dataset.k:""; });
const TUTTI=["installa","tester","colleghi","copia","orologio","mese","festivi","calendario","ferie","scambio","sonno","grazie","medico","dormi","sveglia","votowidget","widgetmese","coppia","momenti","riepilogo","statistiche"];
const oggiK=iso(new Date());
// consenso dato, giorno 31, nient'altro da dire: la domanda compare con le funzioni, e si risponde con un tocco
let p=await apri({giorni:31, extra:{loSapevi:{visti:TUTTI,migrato:1}, soddisfazioneAl:oggiK}});
ok(await sapevi(p)==="funzioneUtile" && await p.evaluate(()=>document.querySelectorAll("#loSapevi [data-sapevi-funzione]").length===8), "giorno 31, con le statistiche: la domanda con otto funzioni");
ok(await p.evaluate(()=>!/pagare|pagheresti|prezzo|a pagamento/i.test(document.querySelector("#loSapevi").innerText)), "la domanda è neutra: non parla di pagamenti");
await p.click("[data-sapevi-funzione=riepilogo]"); await p.clock.runFor(400);
ok(!(await sapevi(p)) && p.ev.includes("funzione_utile:riepilogo"), "la risposta sparisce e conta come contatore anonimo («riepilogo»), senza altro");
await p.reload(); await p.clock.runFor(2000);
ok(await sapevi(p)!=="funzioneUtile", "una volta sola: riaprendo l'app non si ripresenta");
await p.context().close();
// senza statistiche accese la domanda non esiste
p=await apri({giorni:31, extra:{loSapevi:{visti:TUTTI,migrato:1}, soddisfazioneAl:oggiK, "analytics-consent":false}});
ok(await sapevi(p)!=="funzioneUtile", "senza il consenso alle statistiche la domanda non compare");
await p.context().close();
// prima del giorno 30 non compare
p=await apri({giorni:12, extra:{loSapevi:{visti:TUTTI,migrato:1}, soddisfazioneAl:oggiK}});
ok(await sapevi(p)!=="funzioneUtile", "nei primi 30 giorni non compare");
await p.context().close();
console.log("errori", errs); await b.close();
