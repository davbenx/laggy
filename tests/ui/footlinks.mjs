// Fondo delle Impostazioni: tre gruppi (Aiutaci, Scopri, note legali), righe
// da almeno 44 px, nessuna sovrapposizione, niente fuori schermo.
import pw from "./_pw.mjs";
const b=await pw.chromium.launch(); const errs=[];
for (const scheme of ["dark","light"]) {
  const p=await (await b.newContext({locale:"it-IT",viewport:{width:360,height:780},deviceScaleFactor:2,colorScheme:scheme})).newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(700);
  await p.click("[data-pick=M]"); await p.click("#qhConfermaOrario"); await p.waitForTimeout(400);
  await p.click("#doOpzioni"); await p.waitForTimeout(300);
  await p.evaluate(()=>{ const r=document.getElementById("doReviewLnk"); r.hidden=false; });
  const r=await p.evaluate(()=>{ const righe=[...document.querySelectorAll(".opz-info .opz-gruppo.az>.tool")].filter(a=>a.offsetParent);
    const leg=[...document.querySelectorAll(".opz-info .foot-legal a")];
    const bx=righe.map(a=>a.getBoundingClientRect()); let over=0;
    for(let i=0;i<bx.length;i++)for(let j=i+1;j<bx.length;j++){const a=bx[i],c=bx[j]; if(a.left<c.right&&c.left<a.right&&a.top<c.bottom&&c.top<a.bottom) over++;}
    return {n:righe.length, nomi:righe.map(x=>x.innerText.trim()), minH:Math.min(...bx.map(x=>x.height)), over, legali:leg.map(a=>a.textContent), overflow:Math.max(...bx.map(x=>x.right))>innerWidth,
      gruppi:document.querySelectorAll(".opz-info .opz-gruppo.az").length};
  });
  const ok=r.n===8 && r.gruppi===2 && r.minH>=44 && r.over===0 && !r.overflow && r.legali.join()==="Privacy,Termini d'uso,Licenze";
  console.log((ok?"✔":"✘")+` ${scheme}: ${r.n} righe (${r.nomi.join(" · ")}), altezza min ${r.minH}px, sovrapposte ${r.over}, legali ${r.legali.join("/")}`);
  await p.locator(".opz-info .foot-legal").scrollIntoViewIfNeeded();
  if (process.env.SHOT) await p.screenshot({path:`${process.env.SHOT}/foot-${scheme}.png`});
}
console.log("errori", errs); await b.close();
