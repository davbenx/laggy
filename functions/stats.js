// GET /stats — la pagina che mostra le statistiche d'uso (solo per te).
// La pagina in sé è pubblica ma vuota: i numeri arrivano da /stats/data solo
// con il token. Il token si incolla nel campo, oppure si apre
// /stats#t=<token> — il frammento (#…) non viene mai mandato al server né
// finisce nei log, e la pagina lo toglie subito dalla barra degli indirizzi.
// Nessuna libreria, nessuna risorsa esterna: tutto inline.

const PAGE = String.raw`<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Statistiche Notturnisti</title>
<style>
:root{
  color-scheme:light;
  --page:#f4f4f2; --surface-1:#fcfcfb; --line:#e3e2de; --grid:#ecebe7;
  --text-primary:#0b0b0b; --text-secondary:#52514e; --text-muted:#76756f;
  --series-1:#2a78d6; --series-1-soft:#2a78d626; --critical:#c62f2f;
}
@media (prefers-color-scheme:dark){
  :root:where(:not([data-theme="light"])){
    color-scheme:dark;
    --page:#111110; --surface-1:#1a1a19; --line:#2e2e2c; --grid:#262624;
    --text-primary:#ffffff; --text-secondary:#c3c2b7; --text-muted:#99988f;
    --series-1:#3987e5; --series-1-soft:#3987e533; --critical:#e66767;
  }
}
:root[data-theme="dark"]{
  color-scheme:dark;
  --page:#111110; --surface-1:#1a1a19; --line:#2e2e2c; --grid:#262624;
  --text-primary:#ffffff; --text-secondary:#c3c2b7; --text-muted:#99988f;
  --series-1:#3987e5; --series-1-soft:#3987e533; --critical:#e66767;
}
*{box-sizing:border-box}
body{margin:0;background:var(--page);color:var(--text-primary);
  font:15px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:1040px;margin:0 auto;padding:24px 16px 64px}
h1{font-size:22px;margin:0 0 4px}
h2{font-size:15px;margin:0 0 2px}
.sub{color:var(--text-secondary);margin:0 0 12px;font-size:13px}
.bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:16px 0 20px}
.seg{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:var(--surface-1)}
.seg button{border:0;background:none;color:var(--text-secondary);padding:7px 12px;font:inherit;cursor:pointer}
.seg button[aria-pressed="true"]{background:var(--series-1-soft);color:var(--text-primary);font-weight:600}
.card{background:var(--surface-1);border:1px solid var(--line);border-radius:12px;padding:16px;margin:0 0 16px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:0 0 16px}
.kpi{background:var(--surface-1);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
.kpi .v{font-size:32px;font-weight:650;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.kpi .l{color:var(--text-secondary);font-size:13px}
.kpi .h{color:var(--text-muted);font-size:12px;margin-top:2px}
.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px}
.grid2 .card{margin:0}
.rows{display:grid;gap:8px;margin-top:10px}
.row{display:grid;grid-template-columns:1fr auto;column-gap:10px;row-gap:4px;align-items:baseline;font-size:13px}
.row .k{color:var(--text-secondary)}
.row .track{grid-column:1/-1;grid-row:2;height:10px;position:relative}
.row .fill{position:absolute;left:0;top:0;bottom:0;background:var(--series-1);border-radius:0 4px 4px 0;min-width:2px}
.row .n{font-variant-numeric:tabular-nums;color:var(--text-primary);min-width:3.5em;text-align:right}
.row .pct{color:var(--text-muted);font-size:12px;margin-left:4px}
.chart{position:relative;margin-top:10px}
.chart svg{display:block;width:100%;height:auto;overflow:visible}
.chart .ax{fill:var(--text-muted);font-size:11px}
.chart .gl{stroke:var(--grid);stroke-width:1}
.chart .col{fill:var(--series-1)}
.chart .hit{fill:transparent;cursor:crosshair}
.chart .hit:hover + .col,.chart .col.on{opacity:.75}
.tip{position:absolute;pointer-events:none;background:var(--text-primary);color:var(--surface-1);
  font-size:12px;padding:5px 8px;border-radius:6px;white-space:nowrap;transform:translate(-50%,-110%);display:none}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--grid)}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}
th{color:var(--text-secondary);font-weight:600}
details summary{cursor:pointer;font-weight:600}
.login{max-width:420px}
.login input{width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:8px;background:var(--page);color:var(--text-primary);font:inherit;margin:8px 0}
.btn{border:0;border-radius:8px;padding:9px 14px;background:var(--series-1);color:#fff;font:inherit;font-weight:600;cursor:pointer}
.lnk{border:0;background:none;color:var(--text-secondary);text-decoration:underline;cursor:pointer;font:inherit;padding:0}
.err{color:var(--critical);font-size:13px}
.empty{color:var(--text-muted);font-size:13px;padding:8px 0}
.note{color:var(--text-muted);font-size:12px;margin-top:10px}
</style>
</head>
<body>
<main>
  <h1>Statistiche d'uso</h1>
  <p class="sub">Solo contatori aggregati per giorno: nessun id, nessun IP, nessun dato dei turni.</p>

  <section id="login" class="card login" hidden>
    <h2>Accesso</h2>
    <p class="sub">Incolla il valore di <code>STATS_TOKEN</code> impostato sul Worker.</p>
    <form id="loginForm">
      <input id="tok" type="password" autocomplete="current-password" placeholder="Token" required>
      <button class="btn" type="submit">Apri le statistiche</button>
    </form>
    <p id="loginErr" class="err" hidden></p>
  </section>

  <div id="app" hidden>
    <div class="bar">
      <div class="seg" role="group" aria-label="Periodo">
        <button type="button" data-days="7">7 giorni</button>
        <button type="button" data-days="30">30 giorni</button>
        <button type="button" data-days="90">90 giorni</button>
        <button type="button" data-days="365">1 anno</button>
      </div>
      <span id="since" class="sub" style="margin:0"></span>
      <span style="flex:1"></span>
      <button type="button" class="lnk" id="logout">Esci</button>
    </div>
    <p id="err" class="err" hidden></p>

    <div class="kpis" id="kpis"></div>

    <section class="card">
      <h2>Dispositivi attivi al giorno</h2>
      <p class="sub">Un dispositivo conta una volta al giorno in cui apre l'app (con le statistiche attive).</p>
      <div class="chart" id="chActive"></div>
    </section>

    <div class="grid2">
      <section class="card">
        <h2>Percorso principale</h2>
        <p class="sub">Eventi nel periodo, e percentuale rispetto al primo passo.</p>
        <div class="rows" id="funnel"></div>
        <p class="note">Sono conteggi di eventi, non persone: una persona che rifà l'onboarding conta due volte.</p>
      </section>
      <section class="card">
        <h2>Onboarding: dove si fermano</h2>
        <p class="sub">Passi completati e abbandoni ("Salta"), per passo.</p>
        <div class="rows" id="steps"></div>
      </section>
      <section class="card">
        <h2>Da dove usano l'app</h2>
        <p class="sub">Aperture giornaliere per piattaforma.</p>
        <div class="rows" id="platforms"></div>
      </section>
      <section class="card">
        <h2>Tipo di turnazione</h2>
        <p class="sub">Piani generati, per tipo scelto.</p>
        <div class="rows" id="patterns"></div>
      </section>
      <section class="card">
        <h2>Ritorni</h2>
        <p class="sub">Dispositivi tornati dopo almeno 1, 7, 30 giorni dalla prima apertura.</p>
        <div class="rows" id="returns"></div>
      </section>
      <section class="card">
        <h2>Calendari ICS ancora vivi</h2>
        <p class="sub">Feed distinti letti dai calendari nel periodo: serve a decidere quando spegnerli.</p>
        <div class="rows" id="feeds"></div>
        <div class="chart" id="chFeed"></div>
      </section>
    </div>

    <section class="card" style="margin-top:16px">
      <details>
        <summary>Tutti gli eventi (tabella)</summary>
        <div style="overflow-x:auto;margin-top:10px"><table id="tbl"></table></div>
      </details>
    </section>
  </div>
</main>
<div class="tip" id="tip"></div>
<script>
(function(){
"use strict";
var KEY="nt-stats-token", state={days:30, data:null};
var $=function(s){return document.querySelector(s);};
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});}
function fmt(n){return Number(n||0).toLocaleString("it-IT");}
function getTok(){try{return sessionStorage.getItem(KEY)||"";}catch(e){return "";}}
function setTok(t){try{ if(t) sessionStorage.setItem(KEY,t); else sessionStorage.removeItem(KEY);}catch(e){}}

// Token dal frammento (#t=…): lo si salva e lo si toglie subito dall'URL.
var m=/[#&]t=([^&]+)/.exec(location.hash);
if(m){ setTok(decodeURIComponent(m[1])); history.replaceState(null,"",location.pathname+location.search); }

try{ var d=parseInt(localStorage.getItem("nt-stats-days"),10); if(d) state.days=d; }catch(e){}

function showLogin(msg){
  $("#app").hidden=true; $("#login").hidden=false;
  var e=$("#loginErr"); e.hidden=!msg; e.textContent=msg||""; $("#tok").focus();
}
$("#loginForm").addEventListener("submit",function(ev){ ev.preventDefault(); setTok($("#tok").value.trim()); load(); });
$("#logout").addEventListener("click",function(){ setTok(""); showLogin(); });
document.querySelectorAll("[data-days]").forEach(function(b){
  b.addEventListener("click",function(){ state.days=+b.dataset.days; try{localStorage.setItem("nt-stats-days",state.days);}catch(e){} load(); });
});

function load(){
  var t=getTok(); if(!t){ showLogin(); return; }
  document.querySelectorAll("[data-days]").forEach(function(b){ b.setAttribute("aria-pressed", String(+b.dataset.days===state.days)); });
  fetch("/stats/data?days="+state.days,{headers:{authorization:"Bearer "+t},cache:"no-store"})
    .then(function(r){ return r.json().then(function(j){ return {ok:r.ok,status:r.status,j:j}; }); })
    .then(function(r){
      if(r.status===401){ setTok(""); showLogin("Token errato."); return; }
      if(!r.ok){ $("#login").hidden=true; $("#app").hidden=false; var e=$("#err"); e.hidden=false; e.textContent=r.j.error||("Errore "+r.status); return; }
      $("#err").hidden=true; $("#login").hidden=true; $("#app").hidden=false;
      state.data=r.j; render();
    })
    .catch(function(){ var e=$("#err"); e.hidden=false; e.textContent="Rete non raggiungibile."; $("#app").hidden=false; $("#login").hidden=true; });
}

// ── aggregazioni ──
function daysList(since, n){
  var out=[], d=new Date(since+"T00:00:00Z");
  for(var i=0;i<n;i++){ out.push(d.toISOString().slice(0,10)); d.setUTCDate(d.getUTCDate()+1); }
  return out;
}
function total(rows, ev, prop){
  var s=0; rows.forEach(function(r){ if(r.event===ev && (prop==null || r.prop===prop)) s+=r.n; }); return s;
}
function byProp(rows, ev){
  var o={}; rows.forEach(function(r){ if(r.event!==ev) return; var k=r.prop? r.prop.split("=")[1] : "(non indicato)"; o[k]=(o[k]||0)+r.n; });
  return Object.keys(o).map(function(k){ return {k:k,n:o[k]}; }).sort(function(a,b){ return b.n-a.n; });
}
function perDay(rows, ev, days){
  var o={}; rows.forEach(function(r){ if(r.event===ev) o[r.day]=(o[r.day]||0)+r.n; });
  return days.map(function(d){ return {day:d,n:o[d]||0}; });
}

// ── componenti ──
function kpi(v,l,h){ return '<div class="kpi"><div class="v">'+v+'</div><div class="l">'+esc(l)+'</div>'+(h?'<div class="h">'+esc(h)+'</div>':'')+'</div>'; }

function rowsHtml(items, base){
  if(!items.length || items.every(function(x){return !x.n;})) return '<div class="empty">Ancora nessun dato nel periodo.</div>';
  var max=Math.max.apply(null, items.map(function(x){return x.n;}).concat([1]));
  return items.map(function(x){
    var pct = base ? '<span class="pct">'+Math.round(100*x.n/base)+'%</span>' : '';
    return '<div class="row"><span class="k">'+esc(x.k)+'</span>'+
      '<span class="n">'+fmt(x.n)+pct+'</span>'+
      '<span class="track">'+(x.n>0?'<span class="fill" style="width:'+(100*x.n/max).toFixed(1)+'%"></span>':'')+'</span></div>';
  }).join("");
}

// Colonne giornaliere, una serie sola (nessuna legenda: il titolo la nomina).
function columns(el, series, label){
  el._args=[series,label];
  // viewBox = larghezza reale del contenitore: testo degli assi sempre a 11px,
  // non rimpicciolito nei riquadri stretti.
  var W=Math.max(260, el.clientWidth||600), H=W<500?160:220, pl=36,pr=8,pt=10,pb=24, n=series.length;
  var max=Math.max(1, Math.max.apply(null, series.map(function(s){return s.n;})));
  var step=niceStep(max), top=Math.ceil(max/step)*step;
  var cw=(W-pl-pr)/n, gap=Math.min(2, cw*0.2), bw=Math.max(1, cw-gap);
  var y=function(v){ return pt+(H-pt-pb)*(1-v/top); };
  var s='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(label)+'">';
  for(var g=0; g<=top; g+=step){ s+='<line class="gl" x1="'+pl+'" x2="'+(W-pr)+'" y1="'+y(g)+'" y2="'+y(g)+'"/><text class="ax" x="'+(pl-6)+'" y="'+(y(g)+4)+'" text-anchor="end">'+fmt(g)+'</text>'; }
  var every=Math.ceil(n/Math.max(2, Math.floor(W/90)));
  series.forEach(function(p,i){
    var x=pl+i*cw, h=Math.max(0, y(0)-y(p.n)), r=Math.min(4, bw/2, h);
    s+='<rect class="hit" x="'+x+'" y="'+pt+'" width="'+cw+'" height="'+(H-pt-pb)+'" data-i="'+i+'"/>';
    if(p.n>0) s+='<path class="col" data-c="'+i+'" d="'+roundTop(x+gap/2, y(p.n), bw, h, r)+'"/>';
    if(i%every===0) s+='<text class="ax" x="'+(x+cw/2)+'" y="'+(H-6)+'" text-anchor="middle">'+p.day.slice(8,10)+'/'+p.day.slice(5,7)+'</text>';
  });
  s+='</svg>';
  el.innerHTML=s;
  var tip=$("#tip");
  el.querySelectorAll(".hit").forEach(function(h){
    var i=+h.dataset.i, p=series[i];
    h.addEventListener("mouseenter",function(){
      var c=el.querySelector('[data-c="'+i+'"]'); if(c) c.classList.add("on");
      tip.textContent=p.day.split("-").reverse().join("/")+" · "+fmt(p.n); tip.style.display="block";
    });
    h.addEventListener("mousemove",function(e){ tip.style.left=e.pageX+"px"; tip.style.top=(e.pageY-8)+"px"; });
    h.addEventListener("mouseleave",function(){ var c=el.querySelector('[data-c="'+i+'"]'); if(c) c.classList.remove("on"); tip.style.display="none"; });
  });
}
function roundTop(x,y,w,h,r){ // colonna ancorata alla base, angoli arrotondati solo in cima
  return "M"+x+","+(y+h)+"V"+(y+r)+"Q"+x+","+y+" "+(x+r)+","+y+"H"+(x+w-r)+"Q"+(x+w)+","+y+" "+(x+w)+","+(y+r)+"V"+(y+h)+"Z";
}
function niceStep(max){ var raw=max/4, p=Math.pow(10,Math.floor(Math.log10(raw))); var f=raw/p; return (f<=1?1:f<=2?2:f<=5?5:10)*p; }

var PLAT={web:"Browser",pwa:"PWA installata",android:"App Android",ios:"App iOS"};

function render(){
  var D=state.data, rows=D.counts, days=daysList(D.since, D.days);
  $("#since").textContent="dal "+D.since.split("-").reverse().join("/");
  var today=new Date().toISOString().slice(0,10);
  var act=perDay(rows,"active_day",days);
  var actTot=act.reduce(function(s,p){return s+p.n;},0);
  var feedDistinct=0, coupleDistinct=0;
  D.feeds.forEach(function(f){ if(f.day==="periodo"){ if(f.kind==="feed") feedDistinct=f.n; else coupleDistinct=f.n; } });

  $("#kpis").innerHTML=
    kpi(fmt(Math.round(actTot/D.days)), "Dispositivi attivi, media al giorno", "oggi: "+fmt((act.find(function(p){return p.day===today;})||{n:0}).n))+
    kpi(fmt(total(rows,"plan_generated")), "Piani generati", "nel periodo")+
    kpi(fmt(total(rows,"notifications_enabled")), "Notifiche attivate", "nel periodo")+
    kpi(fmt(feedDistinct), "Calendari ICS vivi", coupleDistinct? ("più "+fmt(coupleDistinct)+" di coppia") : "feed distinti letti nel periodo");

  columns($("#chActive"), act, "Dispositivi attivi al giorno");

  var funnelEv=[["onboarding_started","Onboarding iniziato"],["plan_generated","Piano generato"],["notification_prompt_shown","Proposta notifiche vista"],["notifications_enabled","Notifiche attivate"],["share_created","Condivisione creata"]];
  var fItems=funnelEv.map(function(e){ return {k:e[1], n:total(rows,e[0])}; });
  $("#funnel").innerHTML=rowsHtml(fItems, fItems[0].n||0);

  var steps={};
  rows.forEach(function(r){
    if(r.event!=="onboarding_step_completed" && r.event!=="onboarding_abandoned") return;
    var k=r.prop? r.prop.split("=")[1] : "?";
    steps[k]=steps[k]||{done:0,skip:0};
    if(r.event==="onboarding_step_completed") steps[k].done+=r.n; else steps[k].skip+=r.n;
  });
  var sItems=[];
  Object.keys(steps).sort(function(a,b){return (+a)-(+b);}).forEach(function(k){
    sItems.push({k:"Passo "+k+" completato", n:steps[k].done});
    if(steps[k].skip) sItems.push({k:"Passo "+k+" saltato", n:steps[k].skip});
  });
  $("#steps").innerHTML=rowsHtml(sItems);

  $("#platforms").innerHTML=rowsHtml(byProp(rows,"active_day").map(function(x){ return {k:PLAT[x.k]||x.k, n:x.n}; }));
  $("#patterns").innerHTML=rowsHtml(byProp(rows,"plan_generated"));
  $("#returns").innerHTML=rowsHtml([["return_d1","Dopo 1 giorno"],["return_d7","Dopo 7 giorni"],["return_d30","Dopo 30 giorni"]].map(function(e){ return {k:e[1], n:total(rows,e[0])}; }));

  $("#feeds").innerHTML=rowsHtml([
    {k:"Feed personali distinti", n:feedDistinct},
    {k:"Feed di coppia distinti", n:coupleDistinct}
  ])+'<p class="note">Letture totali dai calendari: '+fmt(total(rows,"feed_poll")+total(rows,"couple_poll"))+'. Sotto: feed distinti per giorno.</p>';
  var fd={}; D.feeds.forEach(function(f){ if(f.day!=="periodo") fd[f.day]=(fd[f.day]||0)+f.n; });
  columns($("#chFeed"), days.map(function(d){ return {day:d,n:fd[d]||0}; }), "Feed distinti al giorno");

  var agg={}; rows.forEach(function(r){ var k=r.event+"\u0000"+r.prop; agg[k]=(agg[k]||0)+r.n; });
  var list=Object.keys(agg).map(function(k){ var p=k.split("\u0000"); return {e:p[0],p:p[1],n:agg[k]}; }).sort(function(a,b){ return a.e<b.e?-1:a.e>b.e?1:b.n-a.n; });
  $("#tbl").innerHTML='<thead><tr><th>Evento</th><th>Proprietà</th><th class="n">Totale</th></tr></thead><tbody>'+
    (list.length? list.map(function(r){ return '<tr><td>'+esc(r.e)+'</td><td>'+esc(r.p||"—")+'</td><td class="n">'+fmt(r.n)+'</td></tr>'; }).join("") : '<tr><td colspan="3" class="empty">Nessun dato.</td></tr>')+'</tbody>';
}

var _rt; addEventListener("resize",function(){ clearTimeout(_rt); _rt=setTimeout(function(){
  document.querySelectorAll(".chart").forEach(function(el){ if(el._args) columns(el, el._args[0], el._args[1]); });
},150); });

load();
})();
</script>
</body>
</html>`;

export async function onRequestGet() {
  return new Response(PAGE, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
      "referrer-policy": "no-referrer",
      "x-frame-options": "DENY",
      "content-security-policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
    }
  });
}
