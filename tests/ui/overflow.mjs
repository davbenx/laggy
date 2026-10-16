import pw from "./_pw.mjs";
const SP=(process.env.OUT||"/tmp");
const b=await pw.chromium.launch();
const p=await (await b.newContext({viewport:{width:360,height:780},locale:"it-IT"})).newPage();
await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(700);
const zoom=()=>p.evaluate(()=>{ document.documentElement.style.zoom="1.3"; });
const check=async(nome)=>{ await zoom(); await p.waitForTimeout(250);
  const r=await p.evaluate(()=>{
    const out=[]; const H=document.documentElement.scrollWidth>document.documentElement.clientWidth+1;
    document.querySelectorAll("button,a,span,b,p,label,div,select,input,h1,h2").forEach(e=>{
      if(!e.offsetParent) return; const cs=getComputedStyle(e);
      if((cs.overflowX==="visible"||cs.overflowX==="hidden") && e.scrollWidth>e.clientWidth+2 && e.clientWidth>0 && !["auto","scroll"].includes(cs.overflowX) && cs.textOverflow!=="ellipsis" && e.children.length===0)
        out.push((e.id?"#"+e.id:e.tagName.toLowerCase()+"."+[...e.classList].slice(0,2).join("."))+" «"+(e.innerText||e.value||"").trim().slice(0,40)+"» "+e.scrollWidth+">"+e.clientWidth);
    });
    return {H, out:out.slice(0,12)};
  });
  console.log(((!r.H && !r.out.length)?"✔ ":"✘ ")+nome+" con testo al 130%: "+(r.H?"la pagina scorre di lato; ":"")+(r.out.length?"testo che esce: "+r.out.join(" | "):"niente esce dallo schermo"));
  await p.screenshot({path:SP+"/ov-"+nome.replace(/\W+/g,"_")+".png"});
  await p.evaluate(()=>{ document.documentElement.style.zoom=""; });
};
await check("Primo avvio");
await p.click("text=Conosco già il mio schema"); await check("Scelta schema");
await p.click("[data-preset-ob='0']"); await check("Posizione nel ciclo");
await p.click("[data-pos='0']"); await check("Orari");
await p.click("#qhConfermaOrari"); await p.waitForTimeout(400); await check("Primo piano");
await p.click("#doChiudiPrimoPiano").catch(()=>{}); await check("Oggi con lista");
await p.click('[data-tab="turni"]'); await check("Turni");
await p.click('.crow[data-off="2"]'); await check("Pannello giorno"); await p.evaluate(()=>document.querySelector("#qsClose").click());
await p.evaluate(()=>document.querySelector("#doOpzioni").click()); await check("Impostazioni");
await p.click('[data-opz="4"]'); await check("Tragitto caffe pisolini");
await b.close();
