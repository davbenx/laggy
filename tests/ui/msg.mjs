import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
for (const [nome,url,init] of [["web","http://localhost:8765/index.html",()=>{ window.__sh=[]; navigator.share=async o=>{ window.__sh.push(o); }; }],
  ["nativo","http://localhost:8766/index.html",()=>{ window.__sh=[]; const on=()=>Promise.resolve({remove(){}}); window.Capacitor={isNativePlatform:()=>true,getPlatform:()=>"android",Plugins:{Share:{share:async o=>{ window.__sh.push(o); }},App:{getLaunchUrl:async()=>({}),addListener:on,minimizeApp:async()=>{}},LocalNotifications:{checkPermissions:async()=>({display:"prompt"}),addListener:on},SystemBars:{setStyle:async()=>{}}}}; }]]) {
  const ctx=await b.newContext({viewport:{width:390,height:800},locale:"it-IT"}); await ctx.addInitScript(init);
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(nome+": "+e.message));
  await p.goto(url); await p.waitForTimeout(900);
  await p.evaluate(()=>{ const d=document.querySelector("body > [role=dialog] [data-x]"); d&&d.click(); });
  await p.click("text=Conosco già il mio schema"); await p.click("[data-preset-ob='0']"); await p.click("[data-pos='0']"); await p.click("#qhConfermaOrari"); await p.waitForTimeout(400);
  await p.click("#doChiudiPrimoPiano").catch(()=>{});
  await p.click('[data-tab="turni"]'); await p.evaluate(()=>document.querySelector("#doPartner").click()); await p.waitForTimeout(300);
  await p.click("[data-partner-msg]"); await p.waitForTimeout(300);
  const sh=await p.evaluate(()=>window.__sh);
  ok(sh.length===1 && /nei prossimi \d+ giorni/.test(sh[0].text) && !/Notte|Mattino|sonno/i.test(sh[0].text.split("\n\n")[0].split("\n").slice(1).join("")) && /\nhttps:\/\/app\.notturnisti\.club\/\?s=liberi$/.test(sh[0].text), nome+": 'Manda i miei orari liberi' apre la condivisione, con la firma dell'app");
  if(nome==="web") console.log(sh[0].text);
  await p.locator("#partner").screenshot({path:"/tmp/m-"+nome+".png"});
  await ctx.close();
}
console.log("errori", errs); await b.close();
