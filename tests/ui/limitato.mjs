// Browser limitati: i più vecchi, quelli dentro le app (Instagram, Facebook,
// Gmail), i Safari in privato o con i cookie bloccati, e dati salvati rotti.
// L'app deve partire, fare il piano e girare fra le schede senza errori.
import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch();
const casi={
  "senza API recenti (service worker, notifiche, condivisione, osservatori)": ()=>{
    for(const k of ["Notification","ResizeObserver","IntersectionObserver","CompressionStream","DecompressionStream","BroadcastChannel","requestIdleCallback","PushManager","caches"]) try{ delete window[k]; window[k]=undefined; }catch(e){}
    try{ Object.defineProperty(navigator,"serviceWorker",{get:()=>undefined}); }catch(e){}
    try{ Object.defineProperty(navigator,"share",{get:()=>undefined}); Object.defineProperty(navigator,"canShare",{get:()=>undefined}); }catch(e){}
    try{ delete HTMLInputElement.prototype.showPicker; }catch(e){}
  },
  "memoria del browser inaccessibile (cookie bloccati)": ()=>{
    const no=()=>{ throw new DOMException("The operation is insecure.","SecurityError"); };
    Object.defineProperty(window,"localStorage",{get:no}); Object.defineProperty(window,"sessionStorage",{get:no});
  },
  "dati salvati rotti": ()=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
    const r={"nt:state":"{rotto","nt:wakes":"[1,2","nt:diary":"\"testo\"","nt:beds":"null","nt:notifTipi":"42","nt:diarioNotif":"{\"prog\":\"x\"}",
      "nt:turniConfigurati":"\"forse\"","nt:theme":"{}","nt:consigliFatti":"{}","nt:people":"7","nt:firstPlanBannerChiuso":"[]"};
    for(const k in r) localStorage.setItem(k,r[k]); },
  "stato salvato con tipi sbagliati": ()=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1");
    localStorage.setItem("nt:state", JSON.stringify({turniConfigurati:true,pattern:"M?P NèZ",anchor:"2026-13-45",shifts:{M:{n:"Mattino",s:"x",e:null},P:null},
      repeat:"si",cTo:-5,cFrom:"abc",need:99999,prep:null,freeWake:"25:99",freeBed:"",maxAdvance:"tanto",people:"nessuno",firstSeenAt:12}));
    localStorage.setItem("nt:turniConfigurati","true"); }
};
for(const [nome,init] of Object.entries(casi)){
  const ctx=await b.newContext({locale:"it-IT",viewport:{width:360,height:740}}); await ctx.addInitScript(init);
  const p=await ctx.newPage(); const errs=[];
  p.on("pageerror",e=>errs.push(e.message)); p.on("console",m=>{ if(m.type()==="error" && !/Failed to load resource|404/.test(m.text())) errs.push(m.text()); });
  await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(1500);
  const partita=await p.evaluate(()=>!document.querySelector("#jsoff"));
  // un piano: onboarding se c'è, altrimenti è già lì
  try{ if(await p.$("text=Conosco già il mio schema")){ await p.click("text=Conosco già il mio schema"); await p.click("[data-preset-ob='0']"); await p.click("[data-pos='0']"); await p.click("#qhConfermaOrari"); await p.waitForTimeout(800); } }catch(e){ errs.push("onboarding: "+e.message.split("\n")[0]); }
  const giro=[];
  for(const sel of ['[data-tab="turni"]','[data-tab="oggi"]','#doOpzioni','[data-prova-notifica]','#doPrint']){
    try{ const el=await p.$(sel); if(el && await el.isVisible()){ await el.click({timeout:2000}); await p.waitForTimeout(400); giro.push(sel); } }catch(e){ errs.push(sel+": "+e.message.split("\n")[0]); }
  }
  const t=await p.evaluate(()=>document.body.innerText);
  ok(partita && errs.length===0 && !/NaN|undefined|Invalid Date/.test(t) && t.length>300,
    nome+": parte, piano e schede ("+giro.length+" passi)"+(errs.length?" → "+errs.slice(0,3).join(" | "):"")+(/NaN|undefined|Invalid Date/.test(t)?" → testo rotto: "+(t.match(/.{0,40}(NaN|undefined|Invalid Date).{0,40}/)||[""])[0]:""));
  await ctx.close();
}
await b.close();
