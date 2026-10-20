// Capacitor finto (Android) per le suite dell'app nativa: notifiche,
// calendario, widget e condivisione rispondono come sul telefono.
export const nativo=()=>{ const on=(n,cb)=>{ (window.__L=window.__L||{})[n]=cb; return Promise.resolve({remove(){}}); };
  window.__sched=[]; window.__canali=[];
  window.Capacitor={isNativePlatform:()=>true,getPlatform:()=>"android",Plugins:{
    LocalNotifications:{checkPermissions:async()=>({display:"granted"}),requestPermissions:async()=>({display:"granted"}),checkExactNotificationSetting:async()=>({exact_alarm:"granted"}),getPending:async()=>({notifications:[]}),
      schedule:async(x)=>{ window.__sched.push(...x.notifications); return {}; },cancel:async()=>({}),createChannel:async(c)=>{ window.__canali.push(c); return {}; },listChannels:async()=>({channels:[]}),registerActionTypes:async()=>({}),addListener:on},
    App:{getLaunchUrl:async()=>({}),addListener:()=>Promise.resolve({remove(){}}),minimizeApp:async()=>{}}, SystemBars:{setStyle:async()=>{}}, Share:{share:async()=>({})},
    NTWidget:{publish:async(x)=>{ window.__widget=JSON.parse(x.json); return {widgets:1}; },count:async()=>({widgets:1}),risposte:async()=>{ const j=JSON.stringify(window.__risposte||{}); window.__risposte={}; return {json:j}; }}, NTReview:{request:async()=>({})},
    CapacitorCalendar:{checkAllPermissions:async()=>({result:{readCalendar:"granted",writeCalendar:"granted"}}),listCalendars:async()=>({result:window.__cal||[]}),listEventsInRange:async()=>({result:window.__ev||[]})}}}; };
