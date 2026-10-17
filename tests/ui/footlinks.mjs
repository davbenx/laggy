// Link in fondo alle Impostazioni: griglia ordinata, celle da 44px, nessuna sovrapposizione.
import pw from "./_pw.mjs";
const b=await pw.chromium.launch(); const errs=[];
for (const scheme of ["dark","light"]) {
  const p=await (await b.newContext({locale:"it-IT",viewport:{width:360,height:780},deviceScaleFactor:2,colorScheme:scheme})).newPage(); p.on("pageerror",e=>errs.push(e.message));
  await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(700);
  await p.click("[data-pick=M]"); await p.click("#qhConfermaOrario"); await p.waitForTimeout(400);
  await p.click("#doOpzioni"); await p.waitForTimeout(300);
  await p.evaluate(()=>{ const w=document.getElementById("doReviewLnkWrap"); w.hidden=false; });
  const r=await p.evaluate(()=>{ const as=[...document.querySelectorAll(".opz-info .foot-links a")].filter(a=>a.offsetParent);
    const bx=as.map(a=>a.getBoundingClientRect()); let over=0;
    for(let i=0;i<bx.length;i++)for(let j=i+1;j<bx.length;j++){const a=bx[i],c=bx[j]; if(a.left<c.right&&c.left<a.right&&a.top<c.bottom&&c.top<a.bottom) over++;}
    return {n:as.length,minH:Math.min(...bx.map(x=>x.height)),over,cols:new Set(bx.map(x=>Math.round(x.left))).size,overflow:Math.max(...bx.map(x=>x.right))>innerWidth};
  });
  const ok=r.n>=7&&r.minH>=44&&r.over===0&&r.cols===2&&!r.overflow;
  console.log((ok?"✔":"✘")+` ${scheme}: ${r.n} link, altezza min ${r.minH}px, sovrapposti ${r.over}, colonne ${r.cols}, fuori schermo ${r.overflow}`);
  await p.locator(".opz-info .foot-links").scrollIntoViewIfNeeded();
  if (process.env.SHOT) await p.screenshot({path:`${process.env.SHOT}/foot-${scheme}.png`});
}
console.log("errori", errs); await b.close();
