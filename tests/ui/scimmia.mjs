// Uso a caso: tocchi su qualunque bottone, interruttore o campo visibile,
// per più sessioni con semi diversi. Niente errori, niente testo rotto
// (NaN, undefined), e la pagina non resta mai vuota.
import pw from "./_pw.mjs";
import { nativo } from "./_nativo.mjs";
// NATIVO=1: l'app Android (app/www con Capacitor finto) invece della web app.
const URL=process.env.NATIVO ? "http://localhost:8766" : "http://localhost:8765";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const PASSI=+(process.env.PASSI||150), SEMI=(process.env.SEMI||"1,2,3,4").split(",").map(Number);
const b=await pw.chromium.launch();
const probl=[];
for(const seme of SEMI){
  const ctx=await b.newContext({locale:"it-IT",viewport:{width:360,height:740},hasTouch:true});
  await ctx.route(u=>!String(u).startsWith(URL), r=>r.abort());
  if(process.env.NATIVO) await ctx.addInitScript(nativo);
  await ctx.addInitScript(()=>{ window.print=()=>{}; window.open=()=>null; window.confirm=()=>true; window.alert=()=>{}; window.prompt=()=>""; });
  const p=await ctx.newPage(); const errs=[];
  p.on("pageerror",e=>errs.push(e.message)); p.on("console",m=>{ if(m.type()==="error" && !/Failed to load resource|net::ERR|404/.test(m.text())) errs.push(m.text()); });
  p.on("dialog",d=>d.accept().catch(()=>{}));
  await p.goto(URL+"/index.html"); await p.waitForTimeout(1200);
  let x=seme*7919; const rnd=n=>{ x=(x*1103515245+12345)%2147483648; return x%n; };
  const storia=[];
  for(let i=0;i<PASSI;i++){
    const n=await p.evaluate(()=>{ const vis=e=>{ const r=e.getBoundingClientRect(); return r.width>4 && r.height>4 && r.bottom>0 && r.top<innerHeight && getComputedStyle(e).visibility!=="hidden"; };
      window.__c=[...document.querySelectorAll("button,a[href^='#'],a:not([href]),[role=button],input,select,label.switch,[data-tab],[data-pick],[data-preset-ob],[data-pos]")]
        .filter(e=>vis(e) && !e.disabled && !e.closest("[hidden]") && !/cancella tutto|elimina tutti/i.test(e.innerText||"")); return window.__c.length; });
    if(!n){ await p.evaluate(()=>scrollBy(0,300)); continue; }
    const k=rnd(n);
    const d=await p.evaluate(([k,r])=>{ const e=window.__c[k]; const t=(e.id?"#"+e.id:e.tagName)+" "+(e.innerText||e.value||e.type||"").trim().slice(0,30);
      try{
        if(e.tagName==="INPUT" && /date|time|number|text|tel|search/.test(e.type)){
          const v={date:"2026-1"+(r%3)+"-1"+(r%9),time:String(r%24).padStart(2,"0")+":"+["00","15","30","45"][r%4],number:String(r%200),text:["Anna","","x".repeat(60),"<b>ciao</b>"][r%4],tel:"",search:""}[e.type];
          e.value=v; e.dispatchEvent(new Event("input",{bubbles:true})); e.dispatchEvent(new Event("change",{bubbles:true}));
        } else if(e.tagName==="SELECT"){ e.selectedIndex=r%Math.max(1,e.options.length); e.dispatchEvent(new Event("change",{bubbles:true})); }
        else e.click();
      }catch(err){ return t+" ✗ "+err.message; }
      return t; }, [k, rnd(1000)]);
    storia.push(d); await p.waitForTimeout(120);
    if(rnd(25)===0){ await p.goBack().catch(()=>{}); await p.waitForTimeout(200); }
    if(!p.url().startsWith(URL)){ await p.goto(URL+"/index.html"); await p.waitForTimeout(800); }
  }
  const t=await p.evaluate(()=>document.body.innerText);
  const rotto=(t.match(/.{0,40}\b(NaN|undefined|Invalid Date)\b.{0,40}/)||[])[0];
  if(process.env.COPERTURA) console.log("  elementi diversi toccati:", new Set(storia.map(s=>s.split(" ")[0]+" "+s.split(" ").slice(1,3).join(" "))).size);
  if(errs.length||rotto||t.length<200) probl.push({seme, errs:errs.slice(0,3), rotto, ultimi:storia.slice(-6)});
  ok(!errs.length && !rotto && t.length>=200, (process.env.NATIVO?"app Android, ":"web, ")+"seme "+seme+": "+PASSI+" tocchi a caso"+(errs.length?" → "+errs.slice(0,2).join(" | "):"")+(rotto?" → testo rotto: "+rotto:""));
  await ctx.close();
}
if(probl.length) console.log(JSON.stringify(probl,null,1));
await b.close();
