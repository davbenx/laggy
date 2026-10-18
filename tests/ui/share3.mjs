import pw from "./_pw.mjs";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const b=await pw.chromium.launch(); const errs=[];
for (const [nome,url,init] of [["web","http://localhost:8765/index.html",()=>{ window.__sh=[]; window.__open=[]; navigator.share=async o=>{ window.__sh.push(o); }; window.open=u=>{ window.__open.push(u); }; window.print=()=>{ window.__pr=(window.__pr||0)+1; }; localStorage.setItem("nt:analytics-consent","granted"); }],
  ["nativo","http://localhost:8766/index.html",()=>{ window.__sh=[]; window.__open=[]; window.open=u=>{ window.__open.push(u); }; const on=()=>Promise.resolve({remove(){}}); window.Capacitor={isNativePlatform:()=>true,getPlatform:()=>"android",Plugins:{Share:{share:async o=>{ window.__sh.push(o); }},NTPrint:{print:async()=>{ window.__pr=(window.__pr||0)+1; }},App:{getLaunchUrl:async()=>({}),addListener:on,minimizeApp:async()=>{}},LocalNotifications:{checkPermissions:async()=>({display:"prompt"}),addListener:on},SystemBars:{setStyle:async()=>{}}}}; }],
  ["computer","http://localhost:8765/index.html",()=>{ window.__sh=[]; window.__open=[]; try{ delete Navigator.prototype.share; }catch(e){} window.open=u=>{ window.__open.push(u); }; }]]) {
  const ctx=await b.newContext({viewport:{width:360,height:800},locale:"it-IT"}); await ctx.addInitScript(init);
  const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(nome+": "+e.message));
  await p.goto(url); await p.waitForTimeout(900);
  await p.evaluate(()=>{ const d=document.querySelector("body > [role=dialog] [data-x]"); d&&d.click(); });
  await p.click("text=Conosco già il mio schema"); await p.click("[data-preset-ob='0']"); await p.click("[data-pos='0']"); await p.click("#qhConfermaOrari"); await p.waitForTimeout(400);
  await p.click("#doChiudiPrimoPiano").catch(()=>{});
  await p.click('[data-tab="turni"]'); await p.waitForTimeout(300);
  await p.click("#doShareWhatsApp"); await p.waitForTimeout(300);
  const r=await p.evaluate(()=>({sh:window.__sh.map(x=>x.text.split("\n")[0]), open:window.__open.map(u=>u.slice(0,24))}));
  if(nome==="computer") ok(r.sh.length===0 && r.open[0]&&r.open[0].startsWith("https://wa.me/?text="), nome+": senza pannello di condivisione → WhatsApp Web "+JSON.stringify(r));
  else ok(r.sh.length===1 && r.open.length===0, nome+": 'Manda i miei turni' usa il pannello del telefono "+JSON.stringify(r));
  if(nome!=="computer"){
    await p.click("#doCycQR"); await p.waitForTimeout(200);
    ok(await p.evaluate(()=>!!document.querySelector("#qrHolderCyc svg")), nome+": QR dal link sotto «Invita chi lavora con te»");
    await p.click("#doPrint"); await p.waitForTimeout(200);
    ok(await p.evaluate(()=>window.__pr===1), nome+": Stampa o salva in PDF");
    await p.evaluate(()=>{ const t=document.querySelector("#toast"); t&&t.remove(); });
    await p.locator("#cycShareBox").screenshot({path:"/tmp/s3-"+nome+".png"});
  }
  await ctx.close();
}
console.log("errori", errs); await b.close();
