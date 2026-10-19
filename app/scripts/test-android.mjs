// Prova end-to-end su Android (emulatore o telefono collegato con adb):
// installa l'APK di test, la usa come un utente via DevTools del WebView e
// legge i risultati da Android stesso (database Calendario, allarmi, notifiche).
// Uso: app/scripts/test-android.sh  (prepara emulatore e APK, poi lancia questo)
// Variabili: ADB (default adb nel PATH), SERIAL (default emulator-5554), APK.
import { execSync } from "child_process";
const A=(process.env.ADB||"adb")+" -s "+(process.env.SERIAL||"emulator-5554");
const sh=c=>{ try{ return execSync(A+" "+c,{encoding:"utf8",timeout:600000}); }catch(e){ return String(e.stdout||"")+String(e.stderr||""); } };
const OUT=process.env.OUT||"/tmp";
const APK=process.env.APK||"app/android/app/build/outputs/apk/debug/app-debug.apk";
const ok=(c,m)=>console.log((c?"✔ ":"✘ ")+m);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const PKG="club.notturnisti.app";
if(!process.argv.includes("--no-install")){
  console.log(sh("uninstall "+PKG).trim());
  console.log(sh("install -r -g "+APK).trim().split("\n").pop());
}
sh("shell pm grant "+PKG+" android.permission.POST_NOTIFICATIONS");
sh("shell appops set "+PKG+" SCHEDULE_EXACT_ALARM allow");
// L'applicationId è club.notturnisti.app, ma le classi Java restano nel
// pacchetto club.notturnisti.twa: il nome della schermata va scritto intero.
sh("shell am start -n "+PKG+"/club.notturnisti.twa.MainActivity");
let pid=""; for(let i=0;i<60 && !pid;i++){ await wait(3000); pid=sh("shell pidof "+PKG).trim(); }
console.log("pid", pid);
let sock=""; for(let i=0;i<60 && !sock;i++){ await wait(3000); const u=sh("shell cat /proc/net/unix"); const m=u.match(/webview_devtools_remote_\d+/); if(m) sock=m[0]; }
console.log("socket", sock);
execSync(A+" forward tcp:9333 localabstract:"+sock);
await wait(2000);
// CDP diretto sulla pagina del WebView (Playwright non gestisce i WebView).
let tgt=null; for(let i=0;i<40 && !tgt;i++){ try{ const L=await (await fetch("http://127.0.0.1:9333/json")).json(); tgt=L.find(x=>x.type==="page"); }catch(e){} if(!tgt) await wait(3000); }
import { createRequire } from "module";
const req=createRequire(import.meta.url);
// WebSocket che tiene vivo il processo: "ws" se c'è, altrimenti quello dentro Playwright.
let WS; try{ WS=req("ws"); }catch(e){ const root=execSync("npm root -g",{encoding:"utf8"}).trim(); WS=req(root+"/playwright/node_modules/playwright-core/lib/utilsBundle").ws; }
const ws=new WS(tgt.webSocketDebuggerUrl,{perMessageDeflate:false}); await new Promise(r=>ws.on("open",r));
const keep=setInterval(()=>{},1000);
let seq=0; const pend=new Map(); const errs=[];
ws.on("message",m=>{ const d=JSON.parse(String(m)); if(d.id&&pend.has(d.id)){ pend.get(d.id)(d); pend.delete(d.id); } if(d.method==="Runtime.exceptionThrown") errs.push(d.params.exceptionDetails.exception&&d.params.exceptionDetails.exception.description||d.params.exceptionDetails.text); });
const T0=Date.now(); const log=m=>console.log("["+Math.round((Date.now()-T0)/1000)+"s] "+m);
const cdp=(method,params={})=>Promise.race([new Promise(r=>{ const id=++seq; pend.set(id,r); ws.send(JSON.stringify({id,method,params})); }), new Promise((_,j)=>setTimeout(()=>j(new Error("CDP timeout "+method)),180000))]);
ws.on("close",()=>log("websocket chiuso"));
await cdp("Runtime.enable");
const p={ evaluate: async (fn)=>{ const r=await cdp("Runtime.evaluate",{expression:"("+fn.toString()+")()",awaitPromise:true,returnByValue:true}); if(r.result&&r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0,300)); return r.result&&r.result.result? r.result.result.value : undefined; },
  waitForFunction: async (fn,_a,o)=>{ const t0=Date.now(); while(Date.now()-t0<(o&&o.timeout||60000)){ try{ if(await p.evaluate(fn)) return; }catch(e){} await wait(2000); } throw new Error("timeout attesa pagina"); } };
await p.waitForFunction(()=>document.readyState==="complete" && !!document.querySelector("[data-preset-ob],[data-pick]")||!!document.querySelector("#doOpzioni"),null,{timeout:240000});
log("app caricata"); console.log("url:", await p.evaluate(()=>location.href));
// tocca un elemento appena c'è (l'emulatore senza accelerazione è lentissimo)
const tocca=async(sel,testo,ms=180000)=>{ const t0=Date.now(); while(Date.now()-t0<ms){
  const r=await cdp("Runtime.evaluate",{expression:"(()=>{ const L=[...document.querySelectorAll("+JSON.stringify(sel)+")]; const e="+(testo?"L.find(x=>x.innerText&&x.innerText.includes("+JSON.stringify(testo)+"))":"L[0]")+"; if(!e) return false; e.click(); return true; })()",returnByValue:true});
  if(r.result&&r.result.result&&r.result.result.value){ log("tocco "+sel+(testo?" «"+testo+"»":"")); return true; } await wait(2000); }
  log("NON TROVATO "+sel+" "+(testo||"")); return false; };
await wait(4000);
await p.evaluate(()=>{ const d=document.querySelector("body > [role=dialog] [data-x]"); d&&d.click(); });
await tocca("button,a","Conosco già il mio schema");
await tocca("[data-preset-ob='0']");
await tocca("[data-pos='0']");
await tocca("#qhConfermaOrari");
await wait(3000);
await tocca("#doChiudiPrimoPiano",null,30000);
log("onboarding fatto");
ok(await p.evaluate(()=>!document.querySelector("#setupChecklist").hidden), "lista 'Rendi automatico il tuo piano' presente");
// notifiche: fino ad Android 12 il permesso c'è già di default e la voce
// risulta già attiva (niente da toccare); da Android 13 va chiesto.
if(await p.evaluate(()=>!!document.querySelector('[data-attiva="notifiche"]'))){ await tocca('[data-attiva="notifiche"]'); }
await wait(15000);
const alarms=sh("shell dumpsys alarm").split("\n").filter(l=>l.includes(PKG)).length;
ok(alarms>0, "notifiche: allarmi programmati nel sistema per l'app = "+alarms);
// in coda nel sistema, per tipo: «Come hai dormito?» (diario) compresa
const coda=await p.evaluate(async()=>{ const r=await window.Capacitor.Plugins.LocalNotifications.getPending();
  const t={}; (r.notifications||[]).forEach(n=>{ const k=(n.extra&&n.extra.kind)||"?"; t[k]=(t[k]||0)+1; }); return t; });
console.log("in coda per tipo:", JSON.stringify(coda));
if(!coda.diario) console.log("diagnosi diario:", JSON.stringify(await p.evaluate(()=>{ const st=JSON.parse(localStorage.getItem("nt:state")||"{}");
  return { diag:window.NTDiagNotifiche, tipi:localStorage.getItem("nt:notifTipi"), dn:localStorage.getItem("nt:diarioNotif"), firstSeenAt:st.firstSeenAt, ora:new Date().toString(),
    sveglie:window.NTNotif ? window.NTNotif.buildSchedule(st,{days:4,types:["wake"]}).map(n=>new Date(n.at).toString().slice(0,21)) : "no NTNotif" }; })));
ok(coda.diario>0, "«Come hai dormito?» in coda nel sistema ("+(coda.diario||0)+")");
const can=sh("shell dumpsys notification --noredact").split("\n").filter(l=>/mId='(suggerimenti|diario)'/.test(l)).map(l=>(l.match(/mId='(\w+)'/)||[])[1]+" importanza "+(l.match(/mImportance=(\d)/)||[])[1]);
console.log("canale del diario:", can.join(" · "));
log("notifiche verificate");
// calendario
await tocca('[data-attiva="calendario"]');
let nEv=0, cals="";
for(let i=0;i<40;i++){ await wait(5000);
  cals=sh("shell content query --uri content://com.android.calendar/calendars --projection _id:calendar_displayName:account_name:account_type:visible:sync_events");
  const m=cals.match(/_id=(\d+), calendar_displayName=Notturnisti,/);
  if(m){ const ev=sh("shell content query --uri content://com.android.calendar/events --projection _id:title:dtstart --where \"calendar_id="+m[1]+"\""); nEv=(ev.match(/Row:/g)||[]).length; if(nEv>50) break; }
}
console.log(cals.split("\n").filter(l=>/Notturnisti/.test(l)).join("\n"));
ok(nEv>0, "calendario: eventi nel database Calendario di Android = "+nEv);
const ev=sh("shell content query --uri content://com.android.calendar/events --projection title:dtstart:dtend:availability --sort \"dtstart ASC\"").split("\n").filter(l=>l.startsWith("Row")).slice(0,6);
console.log(ev.map(l=>l.replace(/dtstart=(\d+)/,(m,x)=>"inizio="+new Date(+x).toLocaleString("it-IT",{timeZone:"Europe/Rome"})).replace(/dtend=(\d+)/,(m,x)=>"fine="+new Date(+x).toLocaleString("it-IT",{timeZone:"Europe/Rome"}))).join("\n"));
// stato visto dall'app
await tocca('[data-tab="turni"]'); await wait(15000);
// lo stato del calendario ora è in Impostazioni (tolto il doppione in Turni)
await p.evaluate(()=>document.querySelector("#doOpzioni").click()); await wait(1500);
await p.evaluate(()=>document.querySelector("[data-cal-controlla]") && document.querySelector("[data-cal-controlla]").click()); await wait(6000);
const statoCal=await p.evaluate(()=>{ const e=document.querySelector("#opzCalStato"); return e? e.innerText : "(niente)"; });
ok(/Nel telefono: \d+ eventi/.test(statoCal), "Impostazioni: stato del calendario → "+statoCal);
// notifica di prova
await tocca("#doOpzioni"); await wait(4000);
await tocca("[data-prova-notifica]",null,60000);
await wait(3000);
console.log("toast dopo la prova:", await p.evaluate(()=>{ const t=document.querySelector("#toast"); return t ? t.className+" | "+t.innerText : "(nessuno)"; }));
console.log("bottoni prova:", await p.evaluate(()=>document.querySelectorAll("[data-prova-notifica]").length));
await wait(15000);
let notif=""; for(let i=0;i<12 && !/id=999990/.test(notif);i++){ await wait(10000); notif=sh("shell dumpsys notification").split("\n").filter(l=>/NotificationRecord.*club\.notturnisti/.test(l)).join("\n"); }
ok(/id=999990/.test(notif), "notifica di prova mostrata da Android");
if(!/id=999990/.test(notif)){
  // diagnosi: cosa dice Android della notifica e dei canali dell'app
  console.log("--- dumpsys (righe dell'app)\n"+sh("shell dumpsys notification --noredact").split("\n").filter(l=>/notturnisti/i.test(l)).slice(0,25).join("\n"));
  console.log("--- permesso\n"+sh("shell dumpsys package "+PKG).split("\n").filter(l=>/POST_NOTIFICATIONS|SCHEDULE_EXACT/.test(l)).join("\n"));
  const d=sh("shell dumpsys notification --noredact").split("\n"); const i=d.findIndex(l=>/AppSettings: club\.notturnisti/.test(l));
  console.log("--- canali\n"+d.slice(i,i+14).join("\n"));
  console.log("--- cmd notification list\n"+sh("shell cmd notification list").split("\n").filter(l=>/notturnisti/.test(l)).join("\n"));
  console.log("--- logcat\n"+sh("shell logcat -d -t 5000").split("\n").filter(l=>/NotificationService|No Channel|999990|uppress|enqueueNotification|Capacitor|LocalNotif|chromium.*Console/i.test(l) && !/artd/.test(l)).slice(-40).join("\n"));
}
console.log(notif.slice(0,300));
sh("shell screencap -p /sdcard/s.png"); execSync(A+" pull /sdcard/s.png "+OUT+"/android-shot.png");
console.log("errori pagina:", errs);
ws.close(); process.exit(0);
