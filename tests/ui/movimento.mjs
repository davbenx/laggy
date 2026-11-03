// Movimento: i fogli entrano ed escono (anche la chiusura è animata), si chiudono trascinandoli in basso, le pagine
// interne entrano da destra, il cambio di scheda si dissolve. Con «Riduci movimento» niente di tutto questo.
import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
const SH={M:{n:"Mattino",s:360,e:840},P:{n:"Pomeriggio",s:840,e:1320},N:{n:"Notte",s:1320,e:1800}};
const st={turniConfigurati:true,pattern:"MPNSR",anchor:"2026-10-19",shifts:SH,repeat:true,firstSeenAt:"2026-01-01",freeBed:"23:30",freeWake:"07:30"};
const apri=async(ridotto)=>{
  const ctx=await b.newContext({locale:"it-IT",viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:ridotto?"reduce":"no-preference"});
  await ctx.addInitScript(st=>{ if(sessionStorage.getItem("x")) return; sessionStorage.setItem("x","1"); localStorage.setItem("nt:state",JSON.stringify(st)); localStorage.setItem("nt:turniConfigurati","true"); localStorage.setItem("nt:firstPlanBannerChiuso","true"); localStorage.setItem("nt:attivazioneNascosta","true"); localStorage.setItem("nt:backupDone","true"); },st);
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(1600); return {p,ctx};
};
const foglio=p=>p.evaluate(()=>{ const m=document.querySelector("#infoModal"), s=m.querySelector(".qs-sheet"); return {hidden:m.hidden, disp:getComputedStyle(m).display, op:+getComputedStyle(m).opacity, tr:getComputedStyle(s).transform}; });
const voce=p=>p.evaluate(()=>document.querySelector('#essenziale [data-row]').click());

let {p,ctx}=await apri(false);
await voce(p); await p.waitForTimeout(60); let f=await foglio(p);
ok(!f.hidden && f.op<1 && f.tr!=="none", "il foglio entra: a 60 ms è ancora in dissolvenza e in salita → "+JSON.stringify(f));
await p.waitForTimeout(450); f=await foglio(p);
ok(f.op===1 && f.tr==="none", "a fine entrata è al suo posto");
await p.click("#infoChiudi"); await p.waitForTimeout(40); f=await foglio(p);
ok(f.hidden && f.disp!=="none" && f.op<1, "la chiusura è animata: chiuso, ma ancora visibile mentre sfuma → "+JSON.stringify(f));
await p.waitForTimeout(350); f=await foglio(p);
ok(f.disp==="none", "poi sparisce del tutto");

const cdp=await ctx.newCDPSession(p);
const trascina=async(px)=>{ await voce(p); await p.waitForTimeout(500);
  const bx=await p.evaluate(()=>{ const r=document.querySelector("#infoModal .qs-sheet").getBoundingClientRect(); return {x:r.x+r.width/2, y:r.y+60}; });
  const tp=(type,y)=>cdp.send("Input.dispatchTouchEvent",{type, touchPoints: type==="touchEnd"?[]:[{x:bx.x,y}]});
  await tp("touchStart",bx.y); const n=Math.ceil(px/20); for(let i=1;i<=n;i++){ await tp("touchMove",bx.y+Math.min(px,i*20)); await p.waitForTimeout(16); }
  const durante=(await foglio(p)).tr; await tp("touchEnd"); await p.waitForTimeout(400); return {durante, dopo:await foglio(p)}; };
let r=await trascina(160);
ok(/, 160\)$/.test(r.durante) && r.dopo.hidden, "trascinato in basso di 160 px: segue il dito e poi si chiude");
r=await trascina(40);
ok(!r.dopo.hidden && r.dopo.tr==="none", "trascinato di poco: torna su e resta aperto");
await p.click("#infoChiudi"); await p.waitForTimeout(300);

const pag=()=>p.evaluate(()=>({wrap:+getComputedStyle(document.querySelector(".wrap")).opacity, opz:getComputedStyle(document.querySelector("#opzioni")).translate}));
await p.click("#doOpzioni"); await p.waitForTimeout(60); let g=await pag();
ok(g.opz!=="none" && g.opz!=="0px", "Impostazioni entra da destra → "+g.opz);
await p.waitForTimeout(450); await p.click("#chiudiOpzioni"); await p.waitForTimeout(400);
await p.click('[data-tab="turni"]'); await p.waitForTimeout(50); g=await pag();
ok(g.wrap<1, "cambio di scheda: il contenuto si dissolve → opacità "+g.wrap.toFixed(2));
await ctx.close();

({p,ctx}=await apri(true));
await voce(p); await p.waitForTimeout(30); f=await foglio(p);
ok(f.op===1 && f.tr==="none", "«Riduci movimento»: il foglio compare subito, senza movimento");
await p.click("#infoChiudi"); await p.waitForTimeout(30);
ok((await foglio(p)).disp==="none", "«Riduci movimento»: e si chiude subito");
await p.click('[data-tab="turni"]'); await p.waitForTimeout(50);
ok(await p.evaluate(()=>+getComputedStyle(document.querySelector(".wrap")).opacity)===1, "«Riduci movimento»: nessuna dissolvenza fra le schede");
await ctx.close();
console.log("errori", errs); ok(errs.length===0, "nessun errore di pagina"); await b.close();
