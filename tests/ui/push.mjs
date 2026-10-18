// Promemoria della web app ad app chiusa (Web Push): al server vanno solo gli
// orari; una push vuota fa mostrare al service worker la notifica giusta dal
// piano salvato sul telefono, una volta sola; spegnendo, l'iscrizione si cancella.
import pw from "./_pw.mjs";
const ok=(c,m)=>{ console.log((c?"✔ ":"✘ ")+m); };
const b=await pw.chromium.launch({channel:"chromium"}); const errs=[];
const ctx=await b.newContext({locale:"it-IT"});
await ctx.grantPermissions(["notifications"], {origin:"http://localhost:8765"});
const inviati=[];
await ctx.route("**/push/key", r=>r.fulfill({contentType:"application/json", body:JSON.stringify({key:"BFbDN3WLhHfuy9WzTiEnlBomE0rIAr9URfx7Jow-g1u5gk_eRZ9rEWB2TEMsJWK6ZlkIqrg83WDoVWHj2xa4B6I"})}));
await ctx.route("**/push/sync", r=>{ inviati.push(JSON.parse(r.request().postData()||"{}")); r.fulfill({contentType:"application/json", body:JSON.stringify({ok:true})}); });
// il servizio push vero non c'è in un browser di prova: iscrizione finta
await ctx.addInitScript(()=>{
  const sub={endpoint:"https://fcm.googleapis.com/fcm/send/prova", unsubscribe:async()=>{ window.__unsub=(window.__unsub||0)+1; window.__sub=null; return true; }};
  if(window.PushManager){ PushManager.prototype.getSubscription=async function(){ return window.__sub||null; };
    PushManager.prototype.subscribe=async function(o){ window.__subOpts=!!(o&&o.userVisibleOnly&&o.applicationServerKey); window.__sub=sub; return sub; }; }
});
const p=await ctx.newPage(); p.on("pageerror",e=>errs.push(e.message));
await p.goto("http://localhost:8765/index.html"); await p.waitForTimeout(800);
await p.click("text=Conosco già il mio schema"); await p.click("[data-preset-ob='0']"); await p.click("[data-pos='0']"); await p.click("#qhConfermaOrari"); await p.waitForTimeout(500);
await p.reload(); await p.waitForTimeout(2500);   // il service worker ora controlla la pagina
await p.evaluate(()=>{ localStorage.setItem("nt:promemoriaOff","false"); }); await p.reload(); await p.waitForTimeout(3500);
const sync=inviati.filter(x=>x.orari);
ok(sync.length>=1 && await p.evaluate(()=>window.__subOpts), "iscrizione con la chiave del server e userVisibleOnly; orari mandati ("+(sync[0]?sync[0].orari.length:0)+")");
const s0=sync[sync.length-1]||{};
const soloNumeri=Array.isArray(s0.orari) && s0.orari.length>0 && s0.orari.every(t=>typeof t==="number" && t%60000===0);
ok(soloNumeri && Object.keys(s0).sort().join(",")==="endpoint,orari", "al server solo endpoint e orari al minuto, niente testi → chiavi: "+Object.keys(s0).join(","));
// stessi orari: niente nuovo invio
const prima=inviati.length; await p.reload(); await p.waitForTimeout(3000);
ok(inviati.length===prima, "orari invariati: nessun nuovo invio al server");
ok(/anche ad app chiusa/.test(await p.evaluate(()=>(document.querySelector("#notifHint")||{}).textContent||"")), "Impostazioni: «Arrivano anche ad app chiusa» e cosa resta sul server");
// push vera consegnata al service worker: mostra il promemoria dovuto
const cdp=await ctx.newCDPSession(p);
await cdp.send("ServiceWorker.enable");
const regId=await new Promise(res=>{ cdp.on("ServiceWorker.workerRegistrationUpdated", e=>{ const r=e.registrations.find(x=>!x.isDeleted); if(r) res(r.registrationId); }); setTimeout(()=>res(null),3000); });
await p.evaluate(async()=>{ const reg=await navigator.serviceWorker.ready; const at=Date.now()+30000;
  // un promemoria "adesso" nel piano salvato dal service worker
  reg.active.postMessage({type:"NT_SCHEDULE", items:[{id:4242, kind:"coffee", title:"Ultimo caffè", body:"Da qui in poi niente caffè.", at:new Date(at).toISOString()}]}); });
await p.waitForTimeout(800);
if(regId){
  await cdp.send("ServiceWorker.deliverPushMessage", {origin:"http://localhost:8765", registrationId:regId, data:""}); await p.waitForTimeout(1200);
  await cdp.send("ServiceWorker.deliverPushMessage", {origin:"http://localhost:8765", registrationId:regId, data:""}); await p.waitForTimeout(1200);
}
const notif=await p.evaluate(async()=>{ const reg=await navigator.serviceWorker.ready; return (await reg.getNotifications()).map(n=>n.title+" | "+n.body); });
ok(regId && notif.filter(t=>/Ultimo caffè/.test(t)).length===1, "push vuota → il service worker mostra «Ultimo caffè» dal piano, una volta sola anche con due push → "+JSON.stringify(notif));
// spegnere i promemoria cancella l'iscrizione, anche sul server
await p.evaluate(()=>{ localStorage.setItem("nt:promemoriaOff","true"); }); 
await p.evaluate(async()=>{ const m=await import("./platform.js"); await m.default.notify.schedule([]); }); await p.waitForTimeout(800);
ok(inviati.some(x=>x.stop===true && x.endpoint) && await p.evaluate(()=>window.__unsub===1), "promemoria spenti → stop al server e iscrizione cancellata");
console.log("errori", errs); await b.close();
