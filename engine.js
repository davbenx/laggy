// engine.js — Motore di pianificazione Notturnisti, PURO.
// Nessun DOM, nessuno stato globale proprio: gira identico in Node, in un
// Worker Cloudflare (functions/feed, functions/couple) e nel browser, dove
// index.html lo carica come modulo (createEngine()) invece di tenerne una
// copia a mano — fino a prima di questo file esistevano due copie della
// stessa logica, ed erano già divergenti (un pisolino di recupero bifasico
// mancava qui ma non nella copia), scoperto e corretto in una sessione di
// audit. Questo file è ora l'UNICA fonte di verità: un cambiamento fatto
// solo qui si vede subito ovunque, incluso nel browser.

import { debitoSonno } from "./debito.js";

export const DEFAULTS = {
  pattern:"MPNSR", anchor:"2026-07-13",
  shifts:{ M:{n:"Mattino",s:420,e:840}, P:{n:"Pomeriggio",s:840,e:1260}, N:{n:"Notte",s:1260,e:1860} },
  repeat:true, cTo:25, cFrom:25, need:480, prep:45, freeBed:"23:30", freeWake:"07:30",
  maxAdvance:60, pPattern:"", pAnchor:"", evento:null, napTurno:"no", caffSens:"alta", pausa:"",
  sonnoDiurno:"diviso",  // "diviso" (default) | "unico" | "unicoPisolino"
  mattinoBifasico:false  // sonno bifasico prima dei turni di mattina molto presto
};

// Giorni speciali, uno per data in state.giorni: {t, s, e, w}.
//   t  tipo (sotto); s/e  orari veri di quel giorno in minuti (straordinario,
//   formazione); w  il turno che c'era prima di ferie/malattia, per tornare
//   indietro anche con i turni segnati a mano (che un ciclo non ricorda).
// Ferie e malattia sono assenze: per il piano valgono come riposo. La
// formazione è un giorno di lavoro con i suoi orari. Reperibilità e turno
// extra si aggiungono al giorno com'è.
export const GIORNI_SPECIALI = {ferie:"Ferie", malattia:"Malattia", formazione:"Formazione", reperibile:"Reperibilità", extra:"Turno extra"};
const ASSENZE = {ferie:1, malattia:1};

const LIMITI = {cTo:[0,240,25], cFrom:[0,240,25],
                prep:[10,180,45], maxAdvance:[20,120,60]};

export function createEngine(config){
  const state = Object.assign({}, DEFAULTS, {ecc:{}, giorni:{}, wakes:{}, beds:{}, pisolini:{}}, config||{});
  state.focus = config && config.focus ? new Date(config.focus) : new Date();
  state.ecc = (state.ecc && typeof state.ecc==="object") ? state.ecc : {};
  state.wakes = state.wakes || {}; state.beds = state.beds || {}; state.pisolini = state.pisolini || {};

  const ICS = {turni:true, sonno:true, pisolini:true, caffe:true, luce:true, pasti:false, rientro:true, avviso:30};

  function normalizza(){
    // "need" (il fabbisogno di sonno) non è qui: non è un valore configurabile
    // a sé, è sempre derivato da freeBed/freeWake da sincronizzaNeed() qui
    // sotto. Un vecchio LIMITI.need lo clampava un attimo prima di essere
    // comunque sovrascritto — codice morto e fuorviante (dava l'impressione
    // che need si potesse impostare direttamente), tolto in un audit.
    for(const k in LIMITI){
      const [lo,hi,def]=LIMITI[k], v=+state[k];
      // v>=0, non v>0: 0 è il minimo esplicitamente valido per cTo/cFrom
      // (nessun tempo di viaggio) — con v>0 uno 0 legittimo veniva scartato
      // e sostituito col default (25) invece di restare 0, a ogni
      // normalizza() (quindi a ogni avvio): bug vero, trovato da una
      // segnalazione reale. Per prep/maxAdvance (lo>0) non cambia nulla:
      // un 0 lì viene comunque riportato al loro minimo dal clamp sotto,
      // esattamente come un 5 per prep sarebbe riportato a 10.
      state[k] = (isFinite(v) && v>=0) ? Math.min(Math.max(Math.round(v),lo),hi) : def;
    }
    // Struttura: uno stato salvato rotto (versione vecchia, memoria corrotta,
    // copia fatta a mano) non deve far cadere il disegno di una scheda.
    // Quello che non ha la forma giusta torna al valore di partenza.
    const oggetto=v=>!!v && typeof v==="object" && !Array.isArray(v);
    const turni=o=>{ if(!oggetto(o)) return null; const r={};
      for(const k in o){ const v=o[k]; if(!/^[A-Z]$/.test(k) || k==="R" || !oggetto(v)) continue;
        const S=+v.s, E=+v.e; if(v.s==null || v.e==null || !isFinite(S) || !isFinite(E) || E<=S) continue;
        r[k]=Object.assign({}, v, {n:(typeof v.n==="string" && v.n) ? v.n : k, s:S, e:E}); }
      return Object.keys(r).length ? r : null; };
    const seq=v=>typeof v==="string" ? v.toUpperCase().replace(/[^A-Z]/g,"").slice(0,400) : "";
    const giorno=v=>typeof v==="string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(+new Date(v+"T12:00:00"));
    state.shifts = turni(state.shifts) || JSON.parse(JSON.stringify(DEFAULTS.shifts));
    state.pattern = seq(state.pattern) || DEFAULTS.pattern;
    if(!giorno(state.anchor)) state.anchor = DEFAULTS.anchor;
    state.pPattern = seq(state.pPattern);
    if(state.pShifts!=null) state.pShifts = turni(state.pShifts);
    if(state.pPattern && !giorno(state.pAnchor)) state.pAnchor = state.anchor;
    if(typeof state.repeat!=="boolean") state.repeat = !(state.repeat===0 || state.repeat==="0" || state.repeat==="false");
    for(const k of ["ecc","giorni","wakes","beds","pisolini"]) if(!oggetto(state[k])) state[k] = {};
    const gg={};
    for(const k in state.giorni){ const v=state.giorni[k]; if(!giorno(k) || !oggetto(v)) continue;
      const o={}; if(GIORNI_SPECIALI[v.t]) o.t=v.t;
      const S=+v.s, E=+v.e;
      if(!ASSENZE[o.t] && v.s!=null && v.e!=null && isFinite(S) && isFinite(E) && S>=0 && S<1440 && E>S && E-S<=1440){ o.s=Math.round(S); o.e=Math.round(E); }
      if(o.t==="formazione" && o.s==null){ o.s=540; o.e=1020; }
      if(typeof v.w==="string" && /^[A-Z?]$/.test(v.w)) o.w=v.w;
      if(o.t || o.s!=null) gg[k]=o; }
    state.giorni = gg;
    for(const k of ["pWake","pBed"]) if(state[k]!=null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(state[k]))) state[k] = "";
    if(!{bassa:1, media:1, alta:1}[state.caffSens]) state.caffSens = DEFAULTS.caffSens;
    { const f = state.caffFattori || {};   // facoltativi, restano sul telefono: cambiano quanto dura la caffeina nel corpo
      state.caffFattori = {fumo: f.fumo===true, pillola: f.pillola===true, gravidanza: {inizio:1, fine:1}[f.gravidanza] ? f.gravidanza : ""}; }
    if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(state.freeWake))) state.freeWake="07:30";
    if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(state.freeBed)))  state.freeBed="23:30";
    sincronizzaNeed();
    state.need = Math.round(state.need/15)*15;
  }

const CFG = {
  // l'anticipo massimo è per persona: sta in state.maxAdvance, non qui
  maxDelay:   90,    // [Eastman & Burgess 2009] ~1.5h/giorno
  buffer: 1, windDown: 30, windDownEve: 60,
  margineImpegno: 180,   // in piedi tre ore prima: il tempo di svegliarsi davvero
  inerzia: 45,           // dopo un pisolino i riflessi restano peggiori per un po'
  margineFineTurno: 90,  // mai svegliarsi poco prima di salire in macchina
  napBreve: 20, napCiclo: 90,   // fra i 30 e i 45 ci si sveglia dal sonno profondo
  estensionePreNotte: 120,      // quanto si può allungare il sonno prima della prima notte
  bancoSonno: 60, bancoGiorni: 4,  // sleep banking: +1 h a notte nei giorni liberi che precedono un blocco di notti (fino a 4 notti prima)
  napPreLungo: 120,             // davanti a un blocco lungo il pisolino pre-turno vale di più
  dormitaMax: 600,              // oltre le dieci ore il sonno in più rende poco
  caffeine:  480,    // [Drake 2013: minimo 6h] 8 = margine, ora è il valore di partenza
  caffScala: {bassa:240, media:360, alta:480},   // quanto prima smettere
  // Quanto dura la caffeina in te (emivita), rispetto a una persona tipo (~5 h): la soglia del caffè si allunga o si
  // accorcia in proporzione. Fumo: il fumo accelera l'enzima che la smaltisce (CYP1A2), emivita circa dimezzata
  // (Parsons & Neims 1978; Joeres e coll. 1988). Pillola o altri contraccettivi ormonali: quasi il doppio
  // (Patwardhan e coll. 1980; Abernethy & Todd 1985). Gravidanza: poco nei primi mesi, fino a 2-3 volte negli ultimi
  // (Knutti e coll. 1981; Brazier e coll. 1983).
  caffEmivita: {fumo:0.6, pillola:1.7, inizio:1.3, fine:2.5},
  caffMin: 240, caffMax: 720,   // la soglia resta fra 4 e 12 ore prima di dormire
  cbtOffset: 120,    // [SOLIDO] minimo corporeo ~2h prima della sveglia libera
  eveningDim:120, lightTaper: 120,
  daySleepMax:390,   // [DEFAULT] 6h30 di sonno diurno
  shortSleep: 270,   // [DEFAULT] 4h30 dopo l'ultimo turno notturno
  preShiftMax:330,   // [DEFAULT] 5h30 prima di un turno che parte nelle ore piccole
  napMin: 30, napMax: 120, napPre: 90, napGap: 30, mealGap: 75, napBuffer: 90,
  adaptThreshold: 4, // [AASM] sotto le 4 notti non conviene spostarsi
  preNightDelay:120, bindSlack: 20, H: 24,
  // mattino bifasico [Lavie 1986 — forbidden zone]: sotto questa soglia addormentarsi è difficile
  bifasicoSoglia: 1260,   // 21:00
  bifasicoMainMax: 390,   // 6h30 — blocco principale quando la scelta bifasica è attiva
  bedtimeFloor: 1200      // 20:00 — non si va a letto prima di quest'ora
};

const t = s => (+s.slice(0,2))*60 + (+s.slice(3,5));

const clamp = (v,a,b) => Math.max(a, Math.min(b, v));

const day = (d,n) => { const x=new Date(d); x.setDate(x.getDate()+n); return x; };

const dnum = d => Math.floor(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/864e5);

const mod1440 = m => ((m % 1440) + 1440) % 1440;

const near = (m,r) => { while(m-r>720) m-=1440; while(m-r<-720) m+=1440; return m; };

const iso = d => d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");

// La chiave "AAAA-MM-GG" del giorno focus+off, senza creare una Date per
// ogni domanda: eccezioni e giorni speciali si cercano decine di migliaia di
// volte per disegnare una schermata, e new Date + formattazione a ogni
// chiamata rendeva Turni tre volte più lenta (telefoni medi bloccati).
let _fuoco = {t:NaN, n:0};
const _chiavi = new Map();
const p2 = n => n < 10 ? "0"+n : ""+n;
function chiaveA(off){
  const t = +state.focus;
  if(t !== _fuoco.t) _fuoco = {t, n:dnum(state.focus)};
  const n = _fuoco.n + off;
  let k = _chiavi.get(n);
  if(k === undefined){
    const d = new Date(n*864e5);
    k = d.getUTCFullYear()+"-"+p2(d.getUTCMonth()+1)+"-"+p2(d.getUTCDate());
    if(_chiavi.size > 4000) _chiavi.clear();
    _chiavi.set(n, k);
  }
  return k;
}

function eccezioneA(off){
  const e = state.ecc && state.ecc[chiaveA(off)];
  return (typeof e === "string" && e) ? e : null;
}

// codeAt è chiamata decine di migliaia di volte per disegnare una schermata:
// ciclo ripulito e giorno d'inizio si ricalcolano solo quando cambiano, e
// dnum(focus)+off è lo stesso giorno di calendario di dnum(day(focus,off)).
let _ciclo = {src:null, p:"R"}, _inizio = {src:null, n:0};
// Festivi a riposo: chi ha un orario fisso (lunedì–venerdì) di solito nei
// festivi non lavora. La pagina dà la funzione «questa data è festiva?»
// (setFestivo) perché il calendario dei festivi dipende dal contratto; il
// motore la chiede solo se state.festiviRiposo è acceso, e una volta sola
// per giorno (cache).
let _festivo = null; const _festCache = new Map();
function setFestivo(fn){ _festivo = typeof fn === "function" ? fn : null; _festCache.clear(); }
function festivoA(off){
  const k = chiaveA(off);
  let v = _festCache.get(k);
  if(v === undefined){
    v = !!_festivo(new Date(k+"T12:00:00"));
    if(_festCache.size > 4000) _festCache.clear();
    _festCache.set(k, v);
  }
  return v;
}
function codeAt(off){
  // niente for…in per sapere se ce ne sono: su un oggetto con centinaia di
  // date costa quanto elencarle tutte, a ogni chiamata
  if(state.ecc){ const e = eccezioneA(off); if(e) return e; }
  if(state.festiviRiposo && _festivo && state.repeat !== false && festivoA(off)) return "R";
  if(_ciclo.src !== state.pattern) _ciclo = {src:state.pattern, p:(String(state.pattern||"").toUpperCase().replace(/[^A-Z]/g,"") || "R")};
  if(_inizio.src !== state.anchor) _inizio = {src:state.anchor, n:dnum(new Date(state.anchor+"T12:00:00"))};
  const p = _ciclo.p;
  const n = dnum(state.focus) + off - _inizio.n;
  if(state.repeat === false) return (n < 0 || n >= p.length) ? "?" : p[n];
  return p[((n % p.length) + p.length) % p.length];
}

function giornoA(off){
  if(!state.giorni) return null;
  return state.giorni[chiaveA(off)] || null;
}

// Il turno di un giorno con le sue eccezioni: ferie e malattia sono riposo,
// la formazione e gli orari veri (straordinario) sostituiscono quelli del turno.
// Il nome di un turno con orari diversi dal solito per un giorno: resta il suo se la fascia è la stessa (14:30-22:30 è ancora «Pomeriggio»),
// altrimenti si legge dagli orari. Un pomeriggio sostituito con 08:00-16:00 è una «Giornata», non un «Pomeriggio» con altre ore.
function fasciaOre(s, e){
  const b = {start:s, end:e, rest:false};
  if(eNotte(b)) return "n";
  const m = ((s % 1440) + 1440) % 1440;
  if(m >= 360 && m < 600 && e - s >= 420 && m + (e - s) >= 930) return "g";
  return m < 660 ? "m" : m < 1020 ? "p" : "s";
}
const NOME_FASCIA = {n:"Notte", g:"Giornata", m:"Mattina", p:"Pomeriggio", s:"Sera"};
function nomeOre(s, e){ return NOME_FASCIA[fasciaOre(s, e)]; }
function nomeTurno(d, g){
  if(g && g.n) return g.n;
  if(g && g.s != null && g.t !== "formazione" && fasciaOre(g.s, g.e) !== fasciaOre(d.s, d.e)) return NOME_FASCIA[fasciaOre(g.s, g.e)];
  return d.n;
}

function block(off){
  const g = giornoA(off), tipo = g && g.t || null;
  if(tipo && ASSENZE[tipo]) return {c:"R", rest:true, tipo};
  const c = codeAt(off), d = state.shifts[c];
  if(tipo==="formazione") return {c, name:GIORNI_SPECIALI.formazione, start:g.s, end:g.e, rest:false, tipo};
  if(!d) return {c, rest:true, tipo};
  if(g && g.s!=null) return {c, name:nomeTurno(d, g), start:g.s, end:g.e, rest:false, tipo, oreVere:true, previsto:d.e-d.s};
  return {c, name:d.n, start:d.s, end:d.e, rest:false, tipo};
}

// Minuti di lavoro fra le 22 e le 6 di un turno (b = block()). È la «notte» dei conti e dei colori: una notte è un turno con
// almeno tre ore lì dentro (22:00-02:15 sono 4h15: una notte). NON è spansNight(), la notte «circadiana» del piano del
// sonno (il turno deve toccare il minimo corporeo, che dipende dai tuoi orari): quella serve a pianificare, non a etichettare.
function oreNotturne(b){
  if(!b || b.rest) return 0;
  const ov = (a, z) => Math.max(0, Math.min(b.end, z) - Math.max(b.start, a));
  return ov(-120, 360) + ov(1320, 1800);
}
const eNotte = b => oreNotturne(b) >= 180;
// «r» riposo, «n» notte (eNotte), «l» lavoro: dal solo blocco del giorno, senza simulare il sonno.
// Per chi deve classificare molti giorni (widget, grafici).
function tipoDelGiorno(off){
  const b = block(off);
  return b.rest ? "r" : eNotte(b) ? "n" : "l";
}

// La fascia del turno del giorno, per i colori e per leggere come si dorme: «r» riposo, «n» notte (eNotte), «m» mattina
// (comincia prima delle 11), «p» pomeriggio (prima delle 17), «s» sera (dopo). Dall'orario in cui comincia, qualunque sia il ciclo.
function fasciaDelGiorno(off){
  const b = block(off);
  if(b.rest) return "r";
  if(eNotte(b)) return "n";
  const s = ((b.start % 1440) + 1440) % 1440;
  return s < 660 ? "m" : s < 1020 ? "p" : "s";
}

// Come si chiama un giorno, per elenchi e notifiche: "?" se non si sa.
function etichetta(off){
  const c = codeAt(off);
  const g = giornoA(off), tipo = g && g.t || null;
  if(tipo && (ASSENZE[tipo] || tipo==="formazione")) return GIORNI_SPECIALI[tipo];
  if(c === "?") return "?";
  const d = state.shifts[c];
  return d ? nomeTurno(d, g) : "Riposo";
}

const WAKE_LO = 240, WAKE_HI = 720;

function durataLibera(){
  const a=t(state.freeBed), b=t(state.freeWake);
  if(!isFinite(a) || !isFinite(b)) return 480;
  let d=b-a; while(d<=0) d+=1440;
  return Math.min(Math.max(Math.round(d/15)*15, 300), 660);
}

function sincronizzaNeed(){ state.need = durataLibera(); }

function freeWakeOk(){ const v = t(state.freeWake); return isFinite(v) && v>=WAKE_LO && v<=WAKE_HI; }

function freeWakeUsata(){ const v = t(state.freeWake);
  return Math.min(Math.max(isFinite(v)?v:450, WAKE_LO), WAKE_HI); }

const naturalMid  = () => Math.round(freeWakeUsata() - state.need/2) + 1440;

const winStart    = () => naturalMid() - state.need/2;

const winEnd      = () => naturalMid() + state.need/2;

const startsInNight = b => !b.rest && b.start >= 1440;

const oraDi = v => { const m=/^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(v||""));
  return m ? (+m[1])*60 + (+m[2]) : null; };

function dormitoVero(wakePianificato, durPianificata){
  const k = iso(state.focus);
  const sv = oraDi((state.wakes||{})[k]);
  if(sv === null || !isFinite(durPianificata)) return null;
  const letto = oraDi((state.beds||{})[k]);
  // La soglia bassa era 60 minuti: un sonno reale ma gravissimo (15-45 min)
  // finiva scartato come un refuso, esattamente come se non ci fosse nessun
  // dato — ed è il caso più urgente da non perdere. 15 minuti resta un
  // filtro contro i veri refusi (letto=sveglia, doppio tocco), non contro
  // una notte davvero pessima.
  if(letto !== null){
    let d = sv - letto; while(d <= 0) d += 1440;
    return (d >= 15 && d <= 900) ? d : null;
  }
  let scarto = sv - mod1440(wakePianificato);
  while(scarto > 720) scarto -= 1440; while(scarto < -720) scarto += 1440;
  const d = Math.round(durPianificata + scarto);
  return (d >= 15 && d <= 900) ? d : null;
}

function saltatiIeri(){
  const v = (state.pisolini||{})[iso(day(state.focus,-1))];
  if(!v || typeof v !== "object") return 0;
  let m = 0;
  for(const k in v){
    const g = v[k]; if(!g) continue;
    if(g.no){ m += +g.min || 0; continue; }
    if(g.si && g.a && g.b && g.min){
      const a = oraDi(g.a), b = oraDi(g.b);
      if(a !== null && b !== null){
        let d = b - a; while(d <= 0) d += 1440;
        // fatto, ma più corto di quanto previsto: la differenza resta scoperta
        if(d < 300 && g.min - d >= 20) m += g.min - d;
        // fatto, ma più LUNGO: il sonno in più è reale e riduce il debito,
        // ma non un minuto per minuto oltre un certo punto — un pisolino che
        // sfora così tanto rischia di scivolare in sonno profondo, e da lì
        // l'utilità aggiuntiva smette di essere lineare (da cui il tetto).
        else if(d < 300 && d - g.min >= 20) m -= Math.min(d - g.min, 60);
      }
    }
  }
  // Tetto e pavimento simmetrici: ogni singola voce di sonno "più lungo del
  // previsto" è già cappata a -60 sopra, ma con più pisolini nello stesso
  // giorno la somma poteva scendere sotto zero senza limite — asimmetria
  // rispetto al tetto positivo, corretta in un audit.
  return Math.max(Math.min(m, 180), -180);
}

const sleepsAfter = b => {
  if(b.rest || startsInNight(b)) return false;
  // Non conta quanto il turno "invade" la finestra, ma di quanto mi costringe
  // a rimandare il sonno. Un pomeriggio che finisce alle 22 lo sposta di due ore:
  // vado a letto più tardi e basta. Una notte lo sposta di cinque o sei: è un'altra cosa.
  return (b.end + state.cFrom + CFG.windDown) - winStart() >= 150;
};

function deepNight(b){
  if(b.rest) return 0;
  const c = naturalMid() + CFG.cbtOffset;
  return Math.max(0, Math.min(b.end, c+120) - Math.max(b.start, c-120));
}

function spansNight(b){
  if(b.rest) return false;
  const c = naturalMid() + CFG.cbtOffset;               // minimo corporeo stimato
  return b.end > c - 240 && b.start < c + 120;
}

function impegnoA(off){
  const e = state.evento;
  if(!e || !e.d || !/^\d{4}-\d{2}-\d{2}$/.test(e.d)) return null;
  if(chiaveA(off) !== e.d) return null;   // senza una Date per chiamata: constraint() la chiede migliaia di volte
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(e.h||""));
  return m ? (+m[1])*60 + (+m[2]) : null;
}

function constraint(off){
  const b = block(off), nb = block(off+1);


  // 0. il turno di oggi parte dopo mezzanotte → dorme prima, recupero dopo
  if(startsInNight(b)){
    const wake = b.start - state.cTo - state.prep;
    const dur = Math.min(state.need, CFG.preShiftMax);
    return {pin:true, onset:wake-dur, dur, mid:Math.round(wake-dur/2), kind:"pre-turno"};
  }
  // 1. il turno di oggi invade la finestra dall'inizio → dorme dopo, appena rientra
  if(sleepsAfter(b)){
    const onset = b.end + state.cFrom + CFG.windDown;
    const ora = ((onset % 1440) + 1440) % 1440;
    const diGiorno = ora >= 240 && ora <= 840;        // ci si corica fra le 04 e le 14
    const run = sleepsAfter(block(off+1));
    // Chi ha scelto la tirata unica (in Opzioni) non vuole il tetto sul sonno
    // diurno che divide notte e pisolino — vuole tutto il suo bisogno in un
    // solo blocco, e se la cava bene lo stesso: la scelta resta sua, non del
    // motore. Il default resta quello con più letteratura alle spalle.
    const cap = state.sonnoDiurno==="diviso" || !state.sonnoDiurno;
    // Il sonno «corto» dopo l'ultima notte è un consiglio per chi usa l'app (così stasera dorme
    // normale). Per un'altra persona (state.stima, vedi asPartner) non si consiglia: si stima
    // quanto dorme davvero, cioè il sonno pieno di giorno.
    const dur = (run || state.stima) ? (diGiorno && cap ? Math.min(state.need, CFG.daySleepMax) : state.need)
                    : (diGiorno && cap ? CFG.shortSleep : Math.min(state.need, CFG.daySleepMax));
    return {pin:true, onset, dur, mid:Math.round(onset+dur/2), kind: run ? "diurno" : "corto"};
  }
  // 2. il turno di domani obbliga a una sveglia più presta del naturale → vincolo
  if(!nb.rest && !startsInNight(nb)){
    const wake = nb.start + 1440 - state.cTo - state.prep;
    if(wake < winEnd() - CFG.bindSlack){
      const onsetNaturale = wake - state.need;
      // Sotto una certa ora, addormentarsi diventa fisiologicamente difficile
      // (la "forbidden zone" di Lavie) — mettere a letto lì non basta a far
      // dormire davvero. Chi ha scelto la via bifasica accetta un blocco
      // principale più corto ma a un orario in cui il sonno arriva per
      // davvero, e recupera il resto con un pisolino pomeridiano dopo il
      // turno (in block(), più sotto, lo stesso schema già usato per il
      // sonno corto dopo un turno cominciato nelle ore piccole).
      // Mai a letto prima di essere a casa: se oggi si lavora fino a sera
      // (pomeriggio → mattino presto, un "rientro"), il sonno comincia dopo
      // la fine del turno, il viaggio e il tempo per staccare, e viene più
      // corto. Prima lo si contava a ritroso dalla sveglia di domani e basta:
      // con un pomeriggio fino alle 22 e un mattino alle 6 il piano diceva
      // "a letto alle 20:50", in pieno turno.
      const aCasa = b.rest ? -Infinity : b.end + state.cFrom + CFG.windDownEve;
      if(state.mattinoBifasico && onsetNaturale < CFG.bifasicoSoglia){
        const dur0 = Math.min(state.need, CFG.bifasicoMainMax);
        const onset = Math.max(wake-dur0, CFG.bedtimeFloor, aCasa);
        const dur = Math.max(Math.min(dur0, wake-onset), 0);
        return {pin:true, onset, dur, mid:Math.round(onset+dur/2), kind:"pre-turno-bifasico"};
      }
      const onset = Math.max(onsetNaturale, CFG.bedtimeFloor, aCasa);
      const dur = Math.max(wake-onset, 0);
      return {pin:true, onset, dur, mid:Math.round(onset+dur/2), kind:"pre-turno"};
    }
  }
  // 3. libero, con pavimenti e soffitti
  let floor = -Infinity, ceil = Infinity;
  if(!b.rest) floor = b.end + state.cFrom + CFG.windDownEve;
  if(!nb.rest && !startsInNight(nb)){
    ceil = nb.start + 1440 - state.cTo - state.prep;
    if(spansNight(nb))
      ceil = Math.min(ceil, nb.start + 1440 - state.cTo - CFG.napBuffer - CFG.napPre);
  }
  // Un impegno importante non fissa la sveglia, la limita: in piedi ENTRO tre ore
  // prima. Dormire meno va bene lo stesso, dormirci sopra no. Il vincolo cade sul
  // sonno che finisce QUELLA mattina, cioè quello che comincia il giorno prima:
  // per questo si guarda off+1 e si somma 1440, come per il turno di domani.
  // Va applicato per ultimo, o le righe sopra lo cancellerebbero.
  const impDomani = impegnoA(off+1);
  if(impDomani !== null) ceil = Math.min(ceil, impDomani + 1440 - CFG.margineImpegno);
  // Un riposo prima di una notte è l'unico giorno in cui conviene dormire PIÙ
  // del solito: ogni ora in più è un'ora di veglia in meno da reggere durante
  // il turno. Non è uno spostamento dell'orologio, quindi non paga il limite
  // dei 90 minuti al giorno: è semplicemente restare a letto.
  // La prima mattina libera dopo un blocco di lavoro è quella in cui si recupera
  // il debito accumulato, e dormire più a lungo lì è naturale. Ma vale solo se
  // il turno che arriva dopo comincia PIÙ TARDI: se invece bisogna anticipare
  // (dai pomeriggi ai mattini) dormire di più allontana dall'obiettivo.
  let recupero = false;
  if(!b.rest && nb.rest){
    for(let k=off+2; k<=off+7; k++){
      const x = block(k);
      if(x.rest) continue;
      recupero = mod1440(x.start) >= mod1440(b.start);
      break;
    }
  }
  // Sleep banking: nei giorni liberi prima di un blocco di notti conviene dormire un'ora in più a notte, per arrivarci con una riserva
  // [Rupp 2009: estendere il sonno prima di una restrizione conosciuta riduce il calo di attenzione dopo].
  let banca = false;
  if(b.rest) for(let k=2; k<=CFG.bancoGiorni; k++){ if(spansNight(block(off+k)) && !spansNight(block(off+k-1))){ banca = true; break; } }
  const estendibile = (b.rest && spansNight(nb)) || recupero || banca;
  // quante notti comincia domani: davanti a un blocco lungo si può dormire di più
  let bloccoDopo = 0;
  if(b.rest) for(let k=1; k<=10 && spansNight(block(off+k)); k++) bloccoDopo=k;
  return {pin:false, floor, ceil, estendibile, banca: banca && !(b.rest && spansNight(nb)) && !recupero, bloccoDopo, kind: spansNight(nb) ? "pre-notte" : "libero"};
}

// Il debito fino al giorno in primo piano. La notte di quel giorno, se si ha
// solo la sveglia, si ricava dal piano S (come fa dormitoVero); dentro simulate()
// il piano non c'è ancora e quella notte non conta.
function debitoDiario(S){
  const k = iso(state.focus), notti = {};
  const sv = oraDi((state.wakes||{})[k]);
  if(S && sv !== null && (state.beds||{})[k] == null){
    const sp = at(S, -1), d = dormitoVero(sp.onset + sp.dur - 1440, sp.dur);
    if(d !== null) notti[k] = d;
  }
  // Quanto il piano chiedeva di dormire quella notte: il sonno «di quel giorno» è quello vincolato dal turno
  // (constraint, pin) se c'è, altrimenti il bisogno.
  const base=dnum(state.focus);
  const obiettivo=d=>{ let c=null; try{ c=constraint(dnum(new Date(d+"T12:00:00"))-base-1); }catch(e){}
    return (c && c.pin && c.dur>0) ? c.dur : state.need; };
  return debitoSonno({beds:state.beds, wakes:state.wakes, pisolini:state.pisolini, notti}, state.need, k, undefined, obiettivo);
}

// Oltre le 3 ore di debito la prossima notte libera si allunga anticipando il letto (30, poi 45 minuti, sveglia ferma):
// un pisolino corto non basta e accorcia il sonno di notte. Mai oltre dormitaMax.
function bonusDebito(){
  const dd = debitoDiario();
  if(!dd.haFino || dd.min < 180) return 0;
  return Math.max(0, Math.min(dd.min >= 300 ? 45 : 30, CFG.dormitaMax - state.need));
}

CFG.prepGap0 = 45;

function simulate(){
  const H = CFG.H, N = 2*H+1;
  const C = [], meta = [], mid = new Array(N).fill(null), pin = new Array(N).fill(false);
  for(let i=0;i<N;i++){ C.push(constraint(i-H)); meta.push({}); if(C[i].pin) pin[i]=true; }

  // blocchi di turni che attraversano la notte
  const nLen = new Array(N).fill(0), nIdx = new Array(N).fill(0);
  const isN = i => spansNight(block(i-H));
  for(let i=0;i<N;i++){
    if(!isN(i)) continue;
    let a=i; while(a>0 && isN(a-1)) a--;
    let z=i; while(z<N-1 && isN(z+1)) z++;
    nLen[i]=z-a+1; nIdx[i]=i-a+1;
  }

  for(let i=0;i<N-1;i++)
    if(C[i].pin && C[i].kind==="corto"){ meta[i+1].reset = true; pin[i+1] = true; }
  for(let i=1;i<N;i++)
    if(isN(i) && !isN(i-1) && !pin[i-1] && !startsInNight(block(i-H))){
      pin[i-1]=true; meta[i-1].preNight=true; }
  // dopo l'ultimo turno di un blocco notturno si rientra, qualunque sia la forma del turno
  for(let i=0;i<N-1;i++)
    if(startsInNight(block(i-H)) && !isN(i+1)){ meta[i+1].reset=true; pin[i+1]=true; }

  const pinMid = i => C[i].pin ? C[i].mid
    : meta[i].reset ? naturalMid() : naturalMid() + CFG.preNightDelay;
  const nextPin = i => { for(let j=i+1;j<N;j++) if(pin[j]) return j; return -1; };

  const bonus = bonusDebito();
  let prev = null;
  for(let i=0;i<N;i++){
    // Uno zero vero (nessun tempo per dormire fra due turni) resta zero: prima
    // "|| 480" lo scambiava per un valore mancante e ci metteva 8 ore di sonno
    // in pieno turno.
    const c = C[i], extra = (i===H && !c.pin) ? bonus : 0;
    const d0 = +(c.pin ? c.dur : state.need);
    let target, dr = Number.isFinite(d0) ? d0 : 480;
    if(pin[i]){
      target = c.pin ? c.mid : pinMid(i);
      if(prev !== null){
        target = near(target, prev);
        if(meta[i].preNight) target = prev + clamp(target-prev, -state.maxAdvance, CFG.maxDelay);
      }
    } else {
      const ref = prev === null ? naturalMid() : prev, j = nextPin(i);
      const nat = near(naturalMid(), ref);
      // di norma si torna verso il proprio orario naturale
      let goal = nat, spread = 1;
      if(j>=0){
        let pg = near(pinMid(j), ref);
        // verso un blocco notturno corto non ci si sposta più di tanto: è il senso di "contieni"
        if(nLen[j] && nLen[j] < CFG.adaptThreshold)
          pg = nat + clamp(pg-nat, -CFG.preNightDelay, CFG.preNightDelay);
        const steps = j-i, lim = (pg-ref)<0 ? state.maxAdvance : CFG.maxDelay;
        const kmin = Math.ceil(Math.abs(pg-ref)/lim);
        // solo quando la pista comincia a stringersi si punta al perno
        if(steps-kmin <= CFG.buffer){ goal = pg; spread = Math.max(steps,1); }
      }
      const move = clamp((goal-ref)/spread, -state.maxAdvance, CFG.maxDelay);
      target = ref + move;
    }
    let onset = c.pin ? c.onset : target - dr/2;
    if(!c.pin){
      if(isFinite(c.floor) && onset < c.floor){ onset = c.floor; meta[i].blocked = true; }
      if(isFinite(c.ceil) && onset+dr > c.ceil){
        // devo essere in piedi entro il soffitto: sposto indietro fin dove il pavimento consente
        const giu = isFinite(c.floor) ? c.floor : -Infinity;
        onset = Math.max(giu, Math.min(onset, c.ceil - dr));
        if(onset + dr > c.ceil){ dr = c.ceil - onset; meta[i].tight = true; }
        meta[i].blocked = true;
      }
    } else if(isFinite(c.floor === undefined ? NaN : c.floor)){ /* i perni hanno già l'orario */ }
    // Regola finale, uguale per ogni combinazione di turni: il sonno non
    // comincia prima di essere a casa (fine turno + viaggio + tempo per
    // staccare) e finisce in tempo per prepararsi e partire per il turno
    // dopo. Le regole sopra coprono i casi tipici; questa chiude quelli che
    // sfuggivano (sera tardi → mattino presto, cronotipi molto mattinieri,
    // viaggi lunghi), dove il piano metteva il sonno dentro un turno.
    [onset, dr] = dentroLeOre(i-H, onset, dr);
    onset = Math.round(onset/5)*5; dr = Math.round(dr/5)*5;
    // Per colmare un debito si ANTICIPA l'addormentamento e la sveglia resta ferma: posticiparla sposterebbe l'orologio
    // (melatonina e cortisolo in ritardo, «social jetlag»). Fino a dove si può: non prima di essere a casa.
    if(extra){ const prima=onset; onset=Math.max(onset-extra, isFinite(c.floor)?c.floor:-Infinity); const eff=Math.round((prima-onset)/5)*5;
      if(eff>=15){ onset=prima-eff; dr+=eff; meta[i].debitoExtra=eff; } else onset=prima; }
    mid[i] = Math.round(onset + dr/2);
    if(!c.pin && prev !== null && Math.abs(mid[i]-prev) > 15) meta[i].ramp = true;
    if(c.pin && prev !== null && !meta[i].reset){
      const jump = mid[i]-prev, lim = jump<0 ? state.maxAdvance : CFG.maxDelay;
      if(Math.abs(jump) > lim+1){ meta[i].gap = Math.abs(jump)-lim; meta[i].gapNight = isN(i); }
    }
    if(c.estendibile && !c.pin && !meta[i].tight){
      const tetto = isFinite(c.ceil) ? c.ceil : Infinity;
      const max = Math.min(state.need + (c.banca ? CFG.bancoSonno : CFG.estensionePreNotte), CFG.dormitaMax, tetto - onset);
      if(max > dr){ meta[i].esteso = Math.round(max - dr); dr = Math.round(max); }
    }
    c.onsetR = onset; c.durR = dr; prev = mid[i];
  }

  return C.map((c,i) => ({
    onset:c.onsetR, dur:c.durR, mid:mid[i], kind:c.kind, pin:!!c.pin, meta:meta[i], off:i-H,
    nLen:nLen[i], nIdx:nIdx[i], syn:!!(meta[i].reset||meta[i].preNight),
    strategy: nLen[i] ? (nLen[i] >= CFG.adaptThreshold ? "compromesso" : "contieni") : null
  }));
}

// Turni di ieri, oggi e domani sulla scala di oggi: [da quando si esce, a quando si è a letto].
function dentroLeOre(off, onset, dr){
  const occupato = [];
  for(const k of [-1,0,1]){
    const w = block(off+k); if(w.rest) continue;
    occupato.push([w.start + k*1440 - state.cTo - state.prep, w.end + k*1440 + state.cFrom + CFG.windDown]);
  }
  occupato.sort((x,y)=>x[0]-y[0]);
  for(let giro=0; giro<2; giro++) for(const [da, a] of occupato){
    const fine = onset + dr;
    if(onset >= a || fine <= da) continue;           // nessuna sovrapposizione
    if(onset < da){ dr = Math.max(0, da - onset); }  // il turno arriva dopo: ci si sveglia in tempo
    else { onset = a; dr = Math.max(0, fine - a); }  // il turno c'era prima: si dorme dopo
  }
  return [onset, dr];
}

const at = (S,off) => S[off+CFG.H];

function place(m, busy){
  for(let g=0; g<6; g++){ let mv=false;
    for(const w of busy) if(m > w.a-10 && m < w.b+10){ m = w.b+20; mv=true; }
    if(!mv) break; }
  return m;
}

function svegliaVera(wakePiano){
  const v = oraDi((state.wakes||{})[iso(state.focus)]);
  if(v === null) return wakePiano;
  // la riporto sulla stessa scala del piano, entro mezza giornata
  let x = v; while(x < wakePiano - 720) x += 1440; while(x > wakePiano + 720) x -= 1440;
  return x;
}

// ── L'orologio: modello di Forger, Jewett & Kronauer (J Biol Rhythms 1999), forma «semplice» ─────────────────────────────────────────
// Il pacemaker circadiano come oscillatore che la luce sposta. Si simula sugli ultimi 14 giorni e i 3 prossimi del piano
// (sonni e turni), con una luce stimata: buio quando dormi, 300 lux al lavoro, di giorno 600 (casa, fuori a tratti),
// la sera 150; il giorno segue la stagione. Il minimo del modello si calibra sui tuoi orari liberi (minimo corporeo
// due ore prima della sveglia libera, come cbtOffset): nei giorni regolari non cambia niente; con i turni il minimo
// si sposta come sposterebbe il tuo orologio, poco nelle rotazioni rapide, di più nei blocchi lunghi di notti.
// Nessun dato biologico: è un modello dai tuoi orari, come il resto del piano.
const FJK = {taux:24.2, mu:0.23, k:0.55, G:33.75, a0:0.05, beta:0.0075, I0:9500, p:0.5};   // Forger 1999, come nella libreria circadian (Arcascope)
const FJK_DT = 10/60;  // ore: passo di 10 minuti (Runge-Kutta 4)
function forgerDer(x, xc, n, I){
  const a = I > 0 ? FJK.a0 * Math.pow(I / FJK.I0, FJK.p) : 0;
  const B = FJK.G * (1 - n) * a * (1 - 0.4*x) * (1 - 0.4*xc), w = Math.PI / 12;
  return [w * (xc + B),
          w * (FJK.mu * (xc - 4*xc*xc*xc/3) - x * ((24 / (0.99669 * FJK.taux)) ** 2 + FJK.k * B)),
          60 * (a * (1 - n) - FJK.beta * n)];
}
// Hannay, Booth & Forger 2019 (J Biol Rhythms), modello macroscopico a una popolazione, come nella libreria circadian:
// ampiezza R e fase ψ dell'orologio; il minimo corporeo è dove ψ = π (il minimo di cos ψ).
const HNY = {tau:23.84, K:0.06358, gamma:0.024, Beta1:-0.09318, A1:0.3855, A2:0.1977, BetaL1:-0.0026, BetaL2:-0.957756, sigma:0.0400692, G:33.75, a0:0.05, delta:0.0075, p:1.5, I0:9325};
function hannayDer(R, Psi, n, I){
  const Ip = I > 0 ? Math.pow(I, HNY.p) : 0, a = HNY.a0 * Ip / (Ip + HNY.I0), B = HNY.G * (1 - n) * a;
  const R4 = R*R*R*R, R8 = R4*R4;
  const amp = HNY.A1*0.5*B*(1 - R4)*Math.cos(Psi + HNY.BetaL1) + HNY.A2*0.5*B*R*(1 - R8)*Math.cos(2*Psi + HNY.BetaL2);
  const fase = HNY.sigma*B - HNY.A1*B*0.5*(R*R*R + 1/R)*Math.sin(Psi + HNY.BetaL1) - HNY.A2*B*0.5*(1 + R8)*Math.sin(2*Psi + HNY.BetaL2);
  return [-HNY.gamma*R + HNY.K*Math.cos(HNY.Beta1)/2*R*(1 - R4) + amp, 2*Math.PI/HNY.tau + HNY.K/2*Math.sin(HNY.Beta1)*(1 + R4) + fase, 60*(a*(1 - n) - HNY.delta*n)];
}
// Due modelli, verificati contro la libreria (tools/banco-circadiano): il minimo usato è la loro media, e la distanza fra
// i due dice quanto è incerta la stima. Un consiglio deve reggere per entrambi, non dipendere dai difetti di uno.
const MODELLI = [
  {nome:"Forger 1999", der:forgerDer, y0:[-0.0843259, -1.09607546, 0.45584306], segno:y => y[0]},
  {nome:"Hannay 2019", der:hannayDer, y0:[0.82041911, 1.71383697, 0.52318122], segno:y => Math.cos(y[1])}
];
// il minimo fra un passo e l'altro: parabola sui tre punti attorno al minimo (precisione di un minuto anche con passi di 10)
const vertice = (a, b, c) => { const d = a - 2*b + c; return d > 0 ? 0.5 * (a - c) / d : 0; };
function fjkPasso(y, I, mod){
  const der = (mod || MODELLI[0]).der, h = FJK_DT, f = (d, c) => der(y[0] + c*d[0], y[1] + c*d[1], y[2] + c*d[2], I);
  const k1 = der(y[0], y[1], y[2], I), k2 = f(k1, h/2), k3 = f(k2, h/2), k4 = f(k3, h);
  return [0,1,2].map(i => y[i] + h/6 * (k1[i] + 2*k2[i] + 2*k3[i] + k4[i]));
}
// la luce del giorno per stagione (Italia, ~44°N): ore di luce e mezzogiorno vero, con l'ora legale
function luceDelGiorno(d){
  const g = Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 0)) / 864e5);
  const ore = 12 + 3.2 * Math.sin(2 * Math.PI * (g - 80) / 365);
  const legale = -new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).getTimezoneOffset() > -new Date(d.getFullYear(), 0, 1).getTimezoneOffset();
  const mezzo = 12*60 + 20 + (legale ? 60 : 0);
  return [mezzo - ore*30, mezzo + ore*30];
}
function luceStimata(minuto, dentro, alba, tramonto){
  if(dentro === "sonno") return 0;
  if(dentro === "lavoro") return 300;
  return (minuto >= alba && minuto < tramonto) ? 600 : 150;
}
// orario libero ripetuto: lo stato del modello a mezzanotte e lo scarto per leggere il minimo come minimo corporeo
const _fjkLibero = new Map();
function fjkLibero(d, mi = 0){
  const chiave = mi + "|" + state.freeBed + "|" + state.freeWake + "|" + state.need + "|" + d.getFullYear() + "-" + d.getMonth();
  if(_fjkLibero.has(chiave)) return _fjkLibero.get(chiave);
  const mod = MODELLI[mi];
  const [alba, tramonto] = luceDelGiorno(d);
  const fine = freeWakeUsata(), inizio = fine - state.need;
  const dorme = m => { const x = ((m - inizio) % 1440 + 1440) % 1440; return x < state.need; };
  let y = mod.y0.slice(), prec = null, prec2 = null; const minimi = [];
  const passi = Math.round(24 / FJK_DT);
  for(let g = 0; g < 30; g++) for(let i = 0; i < passi; i++){
    const m = i * FJK_DT * 60;
    y = fjkPasso(y, luceStimata(m, dorme(m) ? "sonno" : "", alba, tramonto), mod);
    const x = mod.segno(y);
    if(g >= 20 && prec2 !== null && prec < prec2 && prec <= x) minimi.push(((m - FJK_DT*60*(1 - vertice(prec2, prec, x))) % 1440 + 1440) % 1440);
    prec2 = prec; prec = x;
  }
  // media circolare dei minimi degli ultimi giorni
  const ang = minimi.map(m => m / 1440 * 2 * Math.PI);
  const xm = ((Math.atan2(ang.reduce((a,b)=>a+Math.sin(b),0), ang.reduce((a,b)=>a+Math.cos(b),0)) / (2*Math.PI) * 1440) % 1440 + 1440) % 1440;
  const rif = ((naturalMid() + CFG.cbtOffset) % 1440 + 1440) % 1440;
  let fase = rif - xm; while(fase > 720) fase -= 1440; while(fase < -720) fase += 1440;
  const r = {chiave, y, fase}; _fjkLibero.set(chiave, r);
  return r;
}
// I minimi corporei stimati dal modello, in minuti sulla scala del giorno guardato (0 = mezzanotte di oggi).
// La simulazione parte da un giorno fisso della settimana (non dal giorno guardato) e ogni giornata simulata si ricorda
// con una chiave fatta dei sonni e dei turni di quel giorno e di tutti i precedenti della stessa partenza: guardare il
// giorno dopo, o ridisegnare, riusa il lavoro già fatto. Un sonno o un turno diverso cambia la chiave, e si ricalcola.
const OROL_PRIMA = 10, OROL_DOPO = 2;
const _orolGiorni = new Map();
const _orologio = new Map();
function minimiOrologio(S, mi = 0){
  try{
    const oggi = dnum(state.focus), lib = fjkLibero(state.focus, mi), mod = MODELLI[mi];
    const inizio = Math.floor((oggi - OROL_PRIMA) / 7) * 7 - oggi;    // giorni dal giorno guardato: fra -16 e -10
    const sonni = [], lavoro = [];
    for(let o = inizio - 1; o <= OROL_DOPO; o++){
      const x = at(S, o); if(x && x.dur > 0) sonni.push([o*1440 + x.onset, o*1440 + x.onset + x.dur]);
      const b = block(o); if(!b.rest) lavoro.push([o*1440 + b.start, o*1440 + b.end]);
    }
    // Il sonno vero del diario, dove c'è, al posto di quello del piano: è il dato che sposta davvero l'orologio. Si usa solo
    // se combacia almeno a metà con un sonno del piano (fra le collocazioni possibili, quella che combacia di più), così
    // la convenzione del «giorno» del diario dopo una notte non può mai mettere un sonno dove non c'era.
    const dalDiario = new Set();
    for(let o = inizio - 1; o <= 0; o++){
      const k = iso(day(state.focus, o)), w = oraDi((state.wakes||{})[k]), bd = oraDi((state.beds||{})[k]);
      if(w === null || bd === null) continue;
      let d = w - bd; while(d <= 0) d += 1440; if(d < 60 || d > 960) continue;
      let migliore = null;
      for(const g of [o - 1, o, o + 1]){
        const z = g*1440 + w, a = z - d;
        sonni.forEach((x, i) => { const c = Math.min(z, x[1]) - Math.max(a, x[0]);
          if(c >= 0.5 * Math.min(d, x[1] - x[0]) && (!migliore || c > migliore.c)) migliore = {i, a, z, c}; });
      }
      if(migliore){ sonni[migliore.i] = [migliore.a, migliore.z]; dalDiario.add(migliore.i); }
    }
    // Health Connect (se l'utente l'ha acceso): le sessioni di sonno vere, con lo stesso aggancio (dove il diario non c'è
    // già: quello che scrivi tu vince), e i passi: un blocco di 10 minuti con almeno 50 passi dentro un sonno lo
    // interrompe (eri sveglio). In minuti dalla mezzanotte del giorno guardato.
    const mezz = new Date(state.focus); mezz.setHours(0, 0, 0, 0);
    const minuti = ms => Math.round((ms - mezz.getTime()) / 60000);
    for(const v of (Array.isArray(state.hcSonno) ? state.hcSonno : [])){
      if(!Array.isArray(v)) continue; const a = minuti(+v[0]), z = minuti(+v[1]);
      if(!(z > a) || z - a < 60 || z - a > 960 || z < (inizio - 1) * 1440 || a > 1440) continue;
      let migliore = null;
      sonni.forEach((x, i) => { if(dalDiario.has(i)) return; const c = Math.min(z, x[1]) - Math.max(a, x[0]);
        if(c >= 0.5 * Math.min(z - a, x[1] - x[0]) && (!migliore || c > migliore.c)) migliore = {i, c}; });
      if(migliore) sonni[migliore.i] = [a, z];
    }
    const attivi = (Array.isArray(state.hcPassi) ? state.hcPassi : []).filter(v => Array.isArray(v) && +v[1] >= 50).map(v => minuti(+v[0]))
      .filter(m => m >= (inizio - 1) * 1440 && m <= (OROL_DOPO + 1) * 1440).sort((p, q) => p - q);
    if(attivi.length){
      const spezzati = [];
      for(const [a, z] of sonni){ let pezzo = a;
        for(const m of attivi){ if(m + 10 <= pezzo || m >= z) continue; if(m - pezzo >= 30) spezzati.push([pezzo, m]); pezzo = Math.max(pezzo, m + 10); }
        if(z - pezzo >= 30) spezzati.push([pezzo, z]); }
      sonni.length = 0; sonni.push(...spezzati);
    }
    const chiaveTutto = oggi + "|" + lib.chiave + JSON.stringify(sonni) + JSON.stringify(lavoro);
    const memo = _orologio.get(mi); if(memo && memo.chiave === chiaveTutto) return memo.minimi;
    if(_orolGiorni.size > 3000) _orolGiorni.clear();
    const taglia = (L, a, z) => L.filter(([p, q]) => q > a && p < z).map(([p, q]) => [Math.max(p, a) - a, Math.min(q, z) - a]);
    const dentro = (L, m) => { for(const [p, q] of L) if(m >= p && m < q) return true; return false; };
    const passo = FJK_DT * 60, minimi = [];
    let chiave = lib.chiave + "|" + (oggi + inizio), st = {y: lib.y.slice(), prec: null, prec2: null};
    for(let o = inizio; o <= OROL_DOPO; o++){
      const a = o*1440, sG = taglia(sonni, a, a + 1440), lG = taglia(lavoro, a, a + 1440);
      chiave += "|" + JSON.stringify(sG) + JSON.stringify(lG);
      let g = _orolGiorni.get(chiave);
      if(!g){
        const [alba, tramonto] = luceDelGiorno(day(state.focus, o));
        let y = st.y, prec = st.prec, prec2 = st.prec2; const mm = [];
        for(let m = 0; m < 1440; m += passo){
          y = fjkPasso(y, luceStimata(m, dentro(sG, m) ? "sonno" : dentro(lG, m) ? "lavoro" : "", alba, tramonto), mod);
          const x = mod.segno(y);
          if(!isFinite(x)) throw new Error("modello instabile");
          if(prec2 !== null && prec < prec2 && prec <= x) mm.push(m - passo*(1 - vertice(prec2, prec, x)));
          prec2 = prec; prec = x;
        }
        g = {y, prec, prec2, mm};
        _orolGiorni.set(chiave, g);
      }
      for(const m of g.mm) minimi.push(a + m + lib.fase);
      st = g;
    }
    _orologio.set(mi, {chiave: chiaveTutto, minimi});
    return minimi;
  }catch(e){ return null; }
}
// Il minimo corporeo del modello più vicino a quello che la regola semplice si aspetterebbe (rif): lo stesso «quale
// notte» di prima, ma all'ora in cui il tuo orologio sta davvero. Senza modello, la regola semplice.
function stimaOrologio(S, rif){
  const per = MODELLI.map((m, mi) => { const L = minimiOrologio(S, mi); if(!L || !L.length) return null;
    let best = null; for(const v of L) if(best === null || Math.abs(v - rif) < Math.abs(best - rif)) best = v;
    return Math.abs(best - rif) <= 720 ? best : null; }).filter(v => v !== null);
  const d = datiSonno(), reali = Math.max(d.diario, d.salute);
  const fonte = d.salute >= 2 && d.salute >= d.diario ? "salute" : d.diario >= 2 ? "diario" : "orari";
  // Il margine: quanto i modelli non sono d'accordo, più quanto mancano i dati veri. Con solo gli orari del piano la fase
  // vera può stare un'ora più in là (chi dorme meno o più tardi del piano); con 5 giorni su 7 di sonno vero, no.
  const manca = reali >= 5 ? 0 : reali >= 2 ? 15 : 30;
  if(!per.length) return {cbt: rif, modelli: [], incertezza: 60 + manca, fonte, giorniVeri: reali};
  const media = per.reduce((a, b) => a + b, 0) / per.length;
  return {cbt: Math.round(media), modelli: per.map(Math.round), incertezza: Math.max(30, Math.round((Math.max(...per) - Math.min(...per)) / 2)) + manca, fonte, giorniVeri: reali};
}
// Quanti degli ultimi 7 giorni hanno un sonno vero: annotato nel diario (letto e sveglia) o da Health Connect.
function datiSonno(){
  let diario = 0;
  for(let o = -6; o <= 0; o++){ const k = iso(day(state.focus, o));
    if(oraDi((state.wakes||{})[k]) !== null && oraDi((state.beds||{})[k]) !== null) diario++; }
  const fine = new Date(state.focus).getTime() + 864e5, inizio = fine - 8 * 864e5;
  const salute = new Set((Array.isArray(state.hcSonno) ? state.hcSonno : []).filter(v => Array.isArray(v) && +v[1] > inizio && +v[0] < fine)
    .map(v => Math.floor(+v[1] / 864e5))).size;
  return {diario, salute: Math.min(7, salute)};
}
function minimoVicino(S, rif){ return stimaOrologio(S, rif).cbt; }
// La soglia dell'ultimo caffè: quanto ti resta addosso (la tua scelta in Impostazioni) per quanto dura in te.
function caffeinaFattore(){
  const f = state.caffFattori || {}, E = CFG.caffEmivita;
  return (f.fumo ? E.fumo : 1) * (f.pillola ? E.pillola : 1) * (f.gravidanza === "fine" ? E.fine : f.gravidanza === "inizio" ? E.inizio : 1);
}
function caffeinaOre(){
  const base = CFG.caffScala[state.caffSens] || CFG.caffeine, x = base * caffeinaFattore();
  return {min: Math.round(clamp(x, CFG.caffMin, CFG.caffMax) / 15) * 15, oltre: x > CFG.caffMax, fattore: caffeinaFattore()};
}

function plan(){
  const S = simulate(), b = block(0), pb = block(-1), nb = block(1);
  const s = at(S,0), sp = at(S,-1);
  const end = s.onset + s.dur, wakePiano = sp.onset + sp.dur - 1440;
  const wake = svegliaVera(wakePiano);
  const caff = caffeinaOre(), oreCaffe = caff.min;
  const orologio = stimaOrologio(S, s.mid + CFG.cbtOffset), cbt = orologio.cbt, shift = s.mid - sp.mid;
  // Nelle notti la caffeina serve anche a restare svegli: se la tua soglia cadrebbe prima del turno (caffeina che in te
  // dura molto), resta almeno un caffè a inizio turno. La sicurezza viene prima del sonno di domattina.
  let cut = s.onset - oreCaffe;
  if(!b.rest && spansNight(b) && cut < b.start + 60){ cut = b.start + 60; caff.notte = true; }

  const sleeps = [{a:s.onset, b:end}], naps = [];
  const dd = debitoDiario(S);
  let debitoScoperto = 0;   // debito reale che nessuna finestra pre/post turno riesce a coprire
  // Un orario si legge sull'orologio e una durata si dice a voce: «16:11» e
  // «1h39» non sono consigli, sono residui di una divisione. Gli estremi cadono
  // sui cinque minuti e la durata si sceglie da una scala di valori che si
  // ricordano — venti minuti, mezz'ora, un'ora e mezza — prendendo il gradino
  // più vicino a quello calcolato fra quelli che ci stanno davvero.
  const q5 = m => Math.round(m/5)*5;
  const SCALA = [20,30,45,60,90,120];
  const durataNetta = (voluta, massima) => {
    const ok = SCALA.filter(x => x <= massima);
    if(!ok.length) return 0;
    return ok.reduce((a,b) => Math.abs(b-voluta) < Math.abs(a-voluta) ? b : a);
  };
  // pisolino ancorato alla fine (deve finire entro un certo orario)
  const dallaFine = (fine, voluta, primoInizio, extra) => {
    const f = q5(fine), d = durataNetta(voluta, f - primoInizio);
    return d ? Object.assign({a:f-d, b:f}, extra) : null;
  };
  // pisolino ancorato all'inizio (comincia appena puoi)
  const dallInizio = (inizio, voluta, ultimaFine, extra) => {
    const i = q5(inizio), d = durataNetta(voluta, ultimaFine - i);
    return d ? Object.assign({a:i, b:i+d}, extra) : null;
  };

  // recupero dopo un turno cominciato nelle ore piccole: il sonno di stanotte era corto
  if(startsInNight(b) && s.dur < state.need - 20){
    const a0 = b.end + state.cFrom + CFG.windDown, last = !spansNight(nb);
    const cap = last ? 120 : 240;          // l'ultimo è corto: serve a rientrare stasera
    const p = dallInizio(a0, state.need - s.dur, a0 + cap, {rec:true, last});
    if(p) naps.push(p);
  }
  // Stessa idea, capovolta: dopo un turno di mattina preparato ieri sera con
  // la scelta bifasica (sonno principale accorciato apposta, a un orario in
  // cui addormentarsi fosse davvero possibile), il resto si recupera qui,
  // nel primo pomeriggio, appena rientrati.
  if(sp.kind==="pre-turno-bifasico" && sp.dur < state.need - 20){
    const a0 = b.end + state.cFrom + CFG.windDown;
    const p = dallInizio(a0, state.need - sp.dur, a0 + 180, {rec:true, bifasico:true});
    if(p) naps.push(p);
  }
  // Pisolino DENTRO il turno. Si fa solo se l'utente ha dichiarato di poterlo
  // fare: in molti contratti dormire in servizio è vietato, e lo strumento non
  // deve suggerirlo a chi non può.
  //
  // Va collocato PRIMA del minimo corporeo, non a metà turno: un pisolino prima
  // del crollo lo previene, dopo raccoglie i cocci. E deve finire con largo
  // margine dalla fine del turno, perché l'inerzia al risveglio peggiora proprio
  // l'ora del rientro, che è già la più rischiosa della giornata.
  const inTurno = (function(){
    if(state.napTurno === "no" || b.rest || !spansNight(b)) return null;
    const minimo = minimoVicino(S, sp.mid + CFG.cbtOffset);   // dove cade il peggio (il modello dell'orologio)
    const ultimo = b.end - CFG.margineFineTurno;        // oltre qui è pericoloso
    const primo  = b.start + 60;                        // non appena entri
    if(ultimo - primo < CFG.napBreve) return null;

    // durata: o corta, o un ciclo intero. Fra i 30 e i 45 ci si sveglia dal
    // sonno profondo, con l'inerzia al massimo e senza il ciclo completo.
    const spazio = ultimo - primo;
    const len = state.napTurno === "libero" && spazio >= CFG.napCiclo + 30
      ? CFG.napCiclo : CFG.napBreve;

    // se c'è una pausa dichiarata si parte da lì, altrimenti si punta al minimo
    const chiesta = oraDi(state.pausa);
    let fine;
    if(chiesta !== null){
      let p = chiesta; while(p < b.start) p += 1440;
      fine = p + len;
    } else {
      fine = minimo - CFG.inerzia;                      // sveglio e lucido nel peggio
    }
    fine = Math.min(Math.max(fine, primo + len), ultimo);
    const inizio = fine - len;
    return (inizio >= primo && fine <= ultimo) ? {a:inizio, b:fine, turno:true} : null;
  })();
  if(inTurno) naps.push(inTurno);


  // pisolino prima di un turno che attraversa la notte: pisolino → pasto → partenza
  // Chi ha scelto la tirata unica non lo vuole (state.sonnoDiurno === "unico"), o lo vuole
  // ma corto per motivi solo circadiani (unicoPisolino).
  if(spansNight(b) && !startsInNight(b) && state.sonnoDiurno !== "unico"){
    const napCorto = state.sonnoDiurno === "unicoPisolino";
    const profondo = deepNight(b) >= 120;
    const dormito = dormitoVero(wakePiano, sp.dur);
    const manca = state.need - (dormito === null ? sp.dur : dormito) + saltatiIeri();
    const veglia = s.onset - wake;
    const solaVeglia = !profondo && manca <= 30 && veglia > 960;
    if(profondo || manca > 30 || solaVeglia){
      const napEnd = b.start - state.cTo - CFG.mealGap - CFG.napGap;
      const giaCoperto = naps.reduce((a,x)=>a+(x.turno?(x.b-x.a):0),0);
      let bloccoN = 0;
      for(let k=0; k<10 && spansNight(block(k)); k++) bloccoN=k+1;
      const soglia = bloccoN >= CFG.adaptThreshold ? CFG.napPreLungo : CFG.napPre;
      const inPari = dormito !== null && manca <= 0;
      let len = napCorto ? CFG.napBreve
        : solaVeglia ? 25
        : inPari ? CFG.napBreve
        : clamp(Math.max(manca - giaCoperto, profondo ? soglia - giaCoperto : CFG.napMin),
                CFG.napMin, CFG.napMax);
      // Un ciclo intero (60 min o più) rende solo se è lontano dal sonno principale (almeno 4 ore dalla sveglia): più vicino la
      // pressione di sonno è bassa e non si addormenta; allora si ripiega sul pisolino breve di 20 minuti, senza inerzia.
      if(len >= 60 && napEnd - len < wake + 240) len = CFG.napBreve;
      let napStart = napEnd - len;
      if(napStart < wake + 60) napStart = wake + 60;
      if(napEnd - napStart >= 20 && napEnd < b.start){
        const p = dallaFine(napEnd, len, Math.max(wake + 60, napEnd - CFG.napMax),
          {first: !spansNight(pb) && !solaVeglia, corto: solaVeglia, ore: veglia});
        if(p) naps.push(p);
      }
    }
  }

  // Se ieri hai dormito davvero meno del previsto, il debito è reale e non
  // sparisce da solo. Prima si prova la soluzione migliore, poi si scende:
  // 0) pisolino normale prima del turno (comportamento di sempre)
  // 1) power nap: più corto (20 min, la durata con meno inerzia) e un
  //    margine di veglia più corto — quando lo spazio è poco ma non nullo
  // 2) recupero DOPO il turno, quando prima non c'è spazio in nessun caso
  // 3) nessun pisolino inventato: si dichiara il debito invece di tacerlo
  // "livelloMin" permette di saltare le opzioni già rifiutate dall'utente
  // per oggi ("non posso farlo → prossima opzione"), senza ripartire da zero.
  if(!naps.length){
    // Un solo conto (debito.js): le notti annotate degli ultimi giorni contro il
    // bisogno, i pisolini fatti e quelli saltati ieri compresi. Si chiede un
    // recupero solo a notte annotata, perché è il TUO dato che cambia il piano;
    // e se il sonno di stanotte è già allungato apposta, il pisolino non serve.
    const debito = dd.haFino && !s.meta.debitoExtra ? dd.min : 0;
    if(debito >= 60){
      const livelloMin = (state.pisolini && state.pisolini[iso(state.focus)] &&
        state.pisolini[iso(state.focus)].skipRecupero) || 0;
      // Una scadenza "prima del turno" ha senso solo se il turno lascia
      // davvero un margine dopo il risveglio. Prima la clip scattava solo se
      // b.start > wake+150 (con '>' stretto): sul confine esatto restava una
      // scadenza sbagliata (calcolata per stanotte, ore dopo la fine del
      // turno), e il controllo anti-collisione non sempre se ne accorgeva.
      // Ora: senza un margine minimo, i livelli 0/1 non si tentano nemmeno.
      const margineTurno = !b.rest ? (b.start - wake) : Infinity;
      const haSpazioPreTurno = margineTurno >= 75;   // almeno 45min di buffer + 20min di pisolino
      const fineBase = (()=>{ let f=s.onset-300;
        if(!b.rest && haSpazioPreTurno) f=Math.min(f, b.start-state.cTo-CFG.mealGap-CFG.napGap);
        return f; })();

      let p=null, livello=-1;
      // 0: normale, prima del turno, buffer pieno
      if(livelloMin<=0 && haSpazioPreTurno){
        const len=clamp(Math.round(debito*0.6),20,120);
        const inizio=Math.max(fineBase-len, wake+120);
        const scontro=!b.rest && inizio<b.end && fineBase>b.start;
        if(!scontro){ p=dallaFine(fineBase, fineBase-inizio, Math.max(wake+120, fineBase-120), {debito}); if(p) livello=0; }
      }
      // 1: power nap, buffer ridotto — quando lo spazio è poco ma non nullo
      if(!p && livelloMin<=1 && haSpazioPreTurno){
        const inizio=Math.max(fineBase-CFG.napBreve, wake+45);
        const scontro=!b.rest && inizio<b.end && fineBase>b.start;
        if(!scontro){ p=dallaFine(fineBase, CFG.napBreve, Math.max(wake+45, fineBase-CFG.napBreve), {debito,corto:true}); if(p) livello=1; }
      }
      // 2: dopo il turno, quando prima non c'è spazio in nessun caso
      if(!p && livelloMin<=2 && !b.rest){
        const dopoInizio=b.end+state.cFrom+CFG.windDown;
        const dopoLimite=Math.min(s.onset-60, dopoInizio+CFG.napMax+60);
        p=dallInizio(dopoInizio, clamp(Math.round(debito*0.6),20,90), dopoLimite, {debito,dopo:true});
        if(p) livello=2;
      }
      if(p){ p.livello=livello; naps.push(p); }
      else debitoScoperto = debito;   // livello 3: nessuna finzione, si dichiara
    }
  }


  // Veglia lunga. Se resti sveglio oltre le 16 ore e quelle ore arrivano a toccare
  // il tuo momento peggiore, il pisolino non è comodità: è la differenza sulla
  // strada di casa (Dawson & Reid). Sotto le 18, e lontano dal minimo, una
  // giornata lunga resta solo una giornata lunga e non serve prescrivere niente.
  if(!naps.length){
    const veglia = s.onset - wake;
    const minimo = minimoVicino(S, sp.mid + CFG.cbtOffset);
    const tocca  = s.onset >= minimo - 240;
    const soglia = s.meta.reset ? 1140 : 960;      // il rientro è una giornata lunga apposta
    if(veglia > soglia && (tocca || veglia > 1080)){
      const len = s.meta.reset ? 30 : clamp(Math.round(veglia/12), 30, 90);
      let fine = s.onset - 300;
      if(!b.rest && b.start > wake + 150)
        fine = Math.min(fine, b.start - state.cTo - CFG.mealGap - CFG.napGap);
      let inizio = Math.max(fine - len, wake + 180);
      // Il turno conta con il viaggio: un pisolino che parte appena finisce il
      // turno (12 ore di giorno, poi la notte) cadeva sulla strada di casa.
      // Se si sovrappone solo alla coda (rientro), parte appena a casa.
      if(!b.rest && inizio < b.end + state.cFrom && fine > b.end && inizio >= b.start)
        inizio = b.end + state.cFrom + 15;
      const scontro = !b.rest && inizio < b.end + state.cFrom && fine > b.start - state.cTo;
      if(fine - inizio >= CFG.napMin && !scontro)
        { const p = dallaFine(fine, fine - inizio, Math.max(wake + 180, fine - 90), {lungo:true, ore:veglia});
          if(p) naps.push(p); }
    }
  }

  // Reperibilità: si può essere chiamati di notte, e allora la notte di sonno
  // salta. Un pisolino nel primo pomeriggio mette da parte una riserva
  // [Dinges 1987, pisolino profilattico], abbastanza lontano dalla sera da
  // non rubare il sonno se poi non chiama nessuno.
  { const g = giornoA(0);
    if(g && g.t==="reperibile" && !naps.some(x=>!x.turno)){
      let inizio = Math.max(wake + 360, 780);
      if(!b.rest && b.start < inizio + 90 && b.end > inizio - 30) inizio = b.end + state.cFrom + CFG.windDown;
      const p = dallInizio(inizio, CFG.napCiclo, s.onset - 300, {rep:true});
      if(p) naps.push(p);
    } }

  // Stessa regola del sonno principale: niente pisolini mentre si è al lavoro
  // o in viaggio (quelli in pausa al lavoro, x.turno, sono voluti). Se uno
  // tocca il turno lo si accorcia; se non resta abbastanza, si toglie.
  for(let k=naps.length-1; k>=0; k--){
    const x = naps[k]; if(x.turno) continue;
    const [a, d] = dentroLeOre(0, x.a, x.b - x.a);
    if(d < CFG.napMin && d < (x.b - x.a)) naps.splice(k, 1);
    else if(a !== x.a || d !== x.b - x.a){ x.a = Math.round(a/5)*5; x.b = Math.round((a+d)/5)*5; }
  }
  // Nappuccino: un caffè subito prima di un pisolino breve. La caffeina entra in circolo in 20-30 minuti, proprio al
  // risveglio, e si somma al pisolino: più vigilanza di uno dei due da solo (Reyner & Horne 1997, al simulatore di guida;
  // Hayashi, Masuda & Hori 2003). Solo quando è la scelta giusta: pisolino di 30 minuti al massimo (in uno lungo la
  // caffeina arriverebbe a metà sonno), caffè entro la tua soglia dell'ultimo caffè (non ruba il sonno principale), e
  // dopo serve essere vigili: pisolino in turno, giornata molto lunga, o fine del pisolino entro 4 ore dal turno.
  for(const x of naps){
    const corto = x.b - x.a <= 30, inSoglia = x.a <= cut;
    const serve = !!x.turno || !!x.lungo || (!b.rest && b.start - x.b >= 0 && b.start - x.b <= 240);
    x.caffe = corto && inSoglia && serve;
    if(corto && serve && !inSoglia) x.caffeNo = "soglia";
  }
  const busy = sleeps.concat(naps), meals = [];
  if(spansNight(b) && !startsInNight(b)){
    meals.push({at:place(b.start - state.cTo - CFG.mealGap, busy), main:true});
    meals.push({at:place(b.start + 120, busy)});
    meals.push({at:place(s.onset - 25, busy), lt:true});
  } else {
    const main = b.rest ? wake+330 : (b.start > 720 ? b.start-90 : 750);
    meals.push({at:place(wake+30, busy), lt:true});
    meals.push({at:place(main, busy), main:true});
    meals.push({at:place(s.onset-180, busy), lt:true});
  }
  return {b, pb, nb, s, sp, S, wake, end, cut, cbt, cbtRegola: s.mid + CFG.cbtOffset, orologio, caff, shift, sleeps, naps, meals, busy,
          night:spansNight(b), lateStart:startsInNight(b), debitoScoperto, debitoMin:dd.haFino?dd.min:0,
          debitoNotti:dd.haFino ? dd.serie.filter(x=>x.manca>=30).sort((x,y)=>y.manca-x.manca).slice(0,3) : []};
}

// Il piano di un'altra persona non deve leggere il MIO diario (sveglie, letto, pisolini del giorno: cambierebbero
// il suo piano e il suo debito), né il mio impegno: si parte da zero, con il bisogno derivato dai SUOI orari
// liberi, e il sonno dopo la notte è una stima. Restituisce la funzione che rimette tutto com'era.
function isolaDalMio(){
  const w=state.wakes, b=state.beds, ps=state.pisolini, ev=state.evento, st=state.stima;
  state.wakes={}; state.beds={}; state.pisolini={}; state.evento=null; state.stima=true;
  sincronizzaNeed();
  return ()=>{ state.wakes=w; state.beds=b; state.pisolini=ps; state.evento=ev; state.stima=st; };
}
function asPartner(fn){
  // Il partner è un'entità autonoma: ha una sua sequenza, le SUE definizioni di
  // turno (può fare un orario fisso di giorno mentre tu ruoti) e la SUA finestra
  // di sonno. Se non le ha impostate, eredita le tue: retrocompatibile.
  // Senza un partner impostato non c'è niente da scambiare — sharedDays() ha
  // già questa guardia esplicita, e la versione multi-persona in index.html
  // pure (via "if(!pp.pattern) return null"): senza, questa versione
  // proseguiva trattando il partner assente come "sempre a riposo" invece di
  // restituire null, un'incoerenza interna scoperta in un audit (mai
  // raggiungibile dall'esterno: buildCoupleFeed() rifiuta già di chiamarla
  // senza partner — qui è solo per coerenza propria del modulo).
  if(!state.pPattern) return null;
  const p=state.pattern, a=state.anchor, sh=state.shifts, fw=state.freeWake, fb=state.freeBed, nd=state.need;
  state.pattern=state.pPattern; state.anchor=state.pAnchor||a;
  if(state.pShifts) state.shifts=state.pShifts;
  if(state.pWake) state.freeWake=state.pWake;
  if(state.pBed)  state.freeBed=state.pBed;
  const mio=isolaDalMio();
  let r=null; try{ r=fn(); }catch(e){}
  mio();
  state.pattern=p; state.anchor=a; state.shifts=sh; state.freeWake=fw; state.freeBed=fb; state.need=nd;
  return r;
}

function busyOf(off){
  const f=state.focus; state.focus=day(f,off);
  let out=[];
  try{
    // Usa P.busy (sleeps.concat(naps), da plan()) invece di ricostruire a mano
    // l'intervallo del sonno principale: la vecchia riga spingeva [s.onset,1440],
    // cioè "occupato da quando ti addormenti fino a mezzanotte" — corretto solo
    // per chi dorme a cavallo di mezzanotte. Per chi dorme di giorno, tutto
    // dentro la stessa giornata (il caso più comune per un turnista: es. dorme
    // 09:00-17:00), quella riga segnava come occupate anche le ore della sera
    // dopo il risveglio vero — sottostimando il tempo libero condiviso nel
    // feed "Riposo in comune" (buildCouple, più sotto). P.busy usa invece la
    // fine reale del sonno (s.onset+s.dur), stessa correzione già fatta in
    // index.html per lo stesso motivo.
    const P=plan();
    const b=P.b;
    const sp=P.sp||{}; // sonno di ieri (onset+dur relativi a ieri+1440)
    const wake=(sp.onset||0)+(sp.dur||0)-1440;
    if(wake>0) out.push([0,Math.min(wake,1440)]);
    for(const iv of P.busy){
      const a=iv.a, z=iv.b;
      if(a<1440 && z>0) out.push([Math.max(a,0),Math.min(z,1440)]);
    }
    if(!b.rest) out.push([Math.max(b.start,0),Math.min(b.end,1440)]);
    // turno di ieri che sconfina oltre mezzanotte
    const yb=block(-1);
    if(!yb.rest && yb.end>1440) out.push([Math.max(yb.start-1440,0),Math.min(yb.end-1440,1440)]);
  }catch(e){}
  state.focus=f;
  return out.filter(([a,z])=>z>a).sort((x,y)=>x[0]-y[0]);
}

function finestreCondivise(off){
  const A=busyOf(off), B=asPartner(()=>busyOf(off));
  if(!B) return null;
  const merged=[...A,...B].sort((x,y)=>x[0]-y[0]);
  let cur=0; const libere=[];
  for(const [a,z] of merged){ if(a>cur) libere.push([cur,a]); cur=Math.max(cur,z); }
  if(cur<1440) libere.push([cur,1440]);
  return libere;
}
function freeOverlap(off){
  const libere=finestreCondivise(off);
  if(!libere) return null;
  const free=libere.reduce((s,[a,z])=>s+(z-a),0);
  return free;
}

function sharedDays(n){
  if(!state.pPattern) return null;
  const out=[];
  for(let o=0;o<90 && out.length<n;o++){
    const mc=codeAt(o); if(mc==="?") continue;
    // Prima "in comune" voleva dire solo "riposo dal turno per entrambi" —
    // ma con orari di sonno sfasati due giorni di riposo possono non avere
    // nessuna ora vera in cui siete svegli insieme. Ora richiede una
    // sovrapposizione reale di almeno 3 ore, non solo lo stesso stato di
    // turno — stessa correzione fatta in index.html, per lo stesso motivo.
    const overlapReale = finestreCondivise(o);
    if(overlapReale && overlapReale.some(([a,z])=>z-a>=180)) out.push({off:o, d:day(state.focus,o)});
  }
  return out;
}

function icsDate(base, mins){
  const d=day(base, Math.floor(mins/1440));
  const m=mod1440(mins);
  return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")]
    .join("")+"T"+String(Math.floor(m/60)).padStart(2,"0")+String(m%60).padStart(2,"0")+"00";
}

function esc7986(t){   // nel formato iCalendar virgole e punti e virgola vanno protetti
  return String(t).replace(/\\/g,"\\\\").replace(/;/g,"\\;").replace(/,/g,"\\,").replace(/\n/g,"\\n");
}

// L'UID di un pisolino nell'ICS deve identificare IL TIPO di pisolino, non la
// sua posizione nell'array naps: plan() lo popola con più push() condizionali
// indipendenti (non tutti mutuamente esclusivi — un turno può generare sia un
// pisolino di recupero sia uno in-turno lo stesso giorno), quindi se cambi
// un'impostazione (es. napTurno) tra due esportazioni ravvicinate, l'insieme
// e l'ordine dei pisolini di un giorno possono cambiare: un UID basato
// sull'indice si riassegna a un pisolino diverso invece di sparire/comparire
// pulito, e l'evento nel calendario del telefono cambia contenuto invece di
// essere sostituito. Ogni ramo di plan() produce al più un pisolino per
// tipo/giorno, quindi il tipo da solo è già un identificatore stabile.
function tipoPisolino(n){
  if(n.turno) return "inturno";
  if(n.bifasico) return "recuperobif";
  if(n.rec) return "recupero";
  if(n.lungo) return "veglialunga";
  if(n.rep) return "reperibile";
  if(n.debito!=null) return "debito"+(n.livello!=null?n.livello:"");
  return "prenotte";
}

// RFC 5545 §3.1: una riga di contenuto non dovrebbe superare i 75 ottetti;
// oltre, va "piegata" — CRLF seguito da uno spazio, che il parser riconosce
// come continuazione della stessa riga logica. Le DESCRIPTION in italiano
// di questo file superano spesso quel limite (parole accentate = 2 ottetti
// ciascuna in UTF-8); mai piegate finora — alcuni parser rigorosi possono
// scartare l'intero file per una riga fuori norma, non solo quella riga.
// Va per code point (non per indice), altrimenti si rischia di tagliare in
// mezzo a un carattere UTF-8 multi-ottetto e corrompere la riga piegata.
function foldLine(line){
  const enc = new TextEncoder();
  if(enc.encode(line).length<=75) return line;
  // La prima riga ha 75 ottetti; le continuazioni cominciano con lo spazio, che conta: 74.
  let out="", cur="";
  for(const ch of line){
    if(enc.encode(cur+ch).length>(out?74:75)){ out += (out?"\r\n ":"")+cur; cur=ch; }
    else cur+=ch;
  }
  return out + (out?"\r\n ":"")+cur;
}

// Un istante locale reale (Date) da giorno di riferimento + minuti dalla sua
// mezzanotte, con la stessa aritmetica di icsDate(): serve al calendario
// nativo e alle notifiche, che vogliono un Date, non una stringa iCalendar.
function localAt(base, mins){
  const d=day(base, Math.floor(mins/1440));
  const m=mod1440(mins);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(m/60), m%60);
}

// Gli eventi del piano come dati, non come testo: UNA sola fonte per il file
// ICS (buildIcs qui sotto lo serializza e basta), per il calendario nativo
// dell'app (Android CalendarContract / iOS EventKit) e per i test. Prima la
// lista esisteva solo dentro la stringa ICS: per scriverla altrove bisognava
// riparsarla o duplicare la logica di cosa mettere nel calendario.
//   uid     stabile per giorno+tipo: risincronizzare aggiorna, non duplica
//   start/end  Date locali;  base/a/b  gli stessi valori in minuti (per l'ICS)
//   avvisa  preavviso in minuti (0 = nessuno);  sveglia  promemoria a fine evento
// pianoGiorni: per quanti giorni c'è il piano completo (sonno, pisolini, caffè, luce…); oltre, fino a «days», solo i turni,
// che vengono dal ciclo e non costano un piano al giorno (il calendario del telefono li vuole per mesi).
function buildEvents(days, pianoGiorni=days){
  const out=[];
  const f0=state.focus;
  const ev=(base,a,b,tipo,title,desc,avvisa,sveglia)=>{
    const al=avvisa && ICS.avviso>0;
    out.push({
      uid:"nt-"+iso(base)+"-"+tipo+"@notturnisti.club", tipo,
      start:localAt(base,a), end:localAt(base,b), base, a, b,
      title, desc:desc||"", avvisa:al?ICS.avviso:0, sveglia:!!(al&&sveglia)
    });
  };
  for(let o=0;o<days;o++){
    state.focus=day(f0,o);
    if(codeAt(0)==="?") continue;
    if(o>=pianoGiorni){
      if(ICS.turni){ const b=block(0); if(!b.rest) ev(day(f0,o),b.start,b.end,"turno",b.tipo==="formazione"?b.name:"Turno "+(b.name||b.c),"",false); }
      continue;
    }
    let P; try{ P=plan(); }catch(e){ continue; }
    const base=day(f0,o);
    // il turno lo sai già: evento sì, sveglia no
    if(ICS.turni && !P.b.rest) ev(base,P.b.start,P.b.end,"turno",P.b.tipo==="formazione"?P.b.name:"Turno "+(P.b.name||P.b.c),"",false);
    if(ICS.sonno && P.s.dur > 0) ev(base,P.s.onset,P.s.onset+P.s.dur,"sonno","Sonno",
      "Pianificato da notturnisti.club",true,true);
    if(ICS.pisolini) P.naps.forEach(n=>ev(base,n.a,n.b,"pisolino-"+tipoPisolino(n),
      (n.rec||n.debito)?"Pisolino di recupero":n.rep?"Pisolino preventivo":((n.b-n.a)<40?"Pisolino breve":"Pisolino"),
      n.rep?"Sei reperibile: un pisolino ora è una riserva se ti chiamano. Al risveglio, se puoi, aspetta un quarto d'ora prima di guidare.":"",true));
    if(ICS.caffe) ev(base,P.cut,P.cut+15,"caffe","Ultima caffeina",
      "Dopo quest'ora la caffeina è ancora in circolo quando provi a dormire.",true);
    // La luce è la leva principale sull'orologio: senza, il piano si disfa.
    if(ICS.luce && isFinite(P.wake))
      ev(base,P.wake+15,P.wake+35,"luce","Luce",
        "Luce forte adesso: aiuta a tenere l'orologio del corpo al passo con il turno.",true);
    if(ICS.pasti){
      const mm=(P.meals||[]).find(x=>x&&x.main);
      if(mm&&isFinite(mm.at)) ev(base,mm.at,mm.at+30,"pasti","Pasto principale",
        "Mangiare a orari stabili aiuta a tenere fermo l'orologio.",false);
    }
    // Il rientro dalla notte è il momento di massimo rischio alla guida.
    if(ICS.rientro && !P.b.rest && (P.night||P.lateStart))
      ev(base,P.b.end,P.b.end+20,"rientro","Rientro: non guidare stanco",
        "Occhiali da sole appena esci, solo con buona luce (se guidi: categoria 1–3, mai la 4; con l'alba scura toglili). Se hai sonno, meglio non guidare: se devi, un caffè e subito un pisolino di 15–20 minuti.",true);
  }
  state.focus=f0;
  return out;
}

function buildIcs(days){
  const L=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//notturnisti.club//pianificatore//IT",
           "CALSCALE:GREGORIAN","METHOD:PUBLISH","X-WR-CALNAME:Notturnisti",
           // dice al calendario ogni quanto ricontrollare: senza, alcune app
           // aggiornano di rado e "si aggiorna da solo" non si vede
           "REFRESH-INTERVAL;VALUE=DURATION:PT12H","X-PUBLISHED-TTL:PT12H"];
  const stamp=icsDate(new Date(),0)+"Z";
  // L'identificativo dipende solo da giorno e tipo: riesportando, il calendario
  // aggiorna gli eventi invece di duplicarli. Con un contatore progressivo,
  // ogni esportazione creava una copia nuova di tutto.
  for(const e of buildEvents(days)){
    L.push("BEGIN:VEVENT",
      "UID:"+e.uid,
      "DTSTAMP:"+stamp,"DTSTART:"+icsDate(e.base,e.a),"DTEND:"+icsDate(e.base,e.b),
      "SUMMARY:"+esc7986(e.title));
    if(e.desc) L.push("DESCRIPTION:"+esc7986(e.desc));
    if(e.avvisa){
      L.push("BEGIN:VALARM","ACTION:DISPLAY","TRIGGER:-PT"+e.avvisa+"M",
             "DESCRIPTION:"+esc7986(e.title),"END:VALARM");
      // Promemoria vero e proprio della sveglia, non un preavviso: scatta
      // esattamente alla fine del sonno (RELATED=END, offset zero), non
      // prima — è l'unico canale qui dove "svegliati adesso" ha senso, il
      // caso in cui l'affidabilità conta più di ogni altro. Stessa scelta
      // dell'utente sopra (spento se ha messo "nessun promemoria"): un solo
      // interruttore, non uno nascosto che ignora l'altro.
      if(e.sveglia)
        L.push("BEGIN:VALARM","ACTION:DISPLAY","TRIGGER;RELATED=END:PT0M",
               "DESCRIPTION:"+esc7986("Sveglia"),"END:VALARM");
    }
    L.push("END:VEVENT");
  }
  L.push("END:VCALENDAR");
  return L.filter(Boolean).map(foldLine).join("\r\n");
}

  // feed coppia: eventi tutto-il-giorno sui riposi in comune. Riusa asPartner /
  // freeOverlap (estratti verbatim): stessi numeri della striscia partner in app.
  function icsDay(base, o){ const d=day(base,o);
    return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join(""); }
  // Come buildEvents, ma per il calendario "insieme": eventi tutto-il-giorno.
  // start = mezzanotte del giorno, end = mezzanotte del giorno dopo.
  function buildCoupleEvents(days){
    const out=[];
    const f0=state.focus;
    for(let o=0;o<days;o++){
      state.focus=day(f0,o);
      const mc=codeAt(0); if(mc==="?") continue;
      // Prima creava l'evento solo controllando "riposo dal turno per
      // entrambi" — con orari di sonno sfasati, un giorno così può non
      // avere nessuna ora vera in cui siete svegli insieme, eppure l'evento
      // "Riposo in comune" veniva creato lo stesso (e la descrizione, che
      // invece usava freeOverlap correttamente, poteva dire "0 ore libere"
      // sullo stesso evento — due calcoli diversi in disaccordo fra loro).
      // Ora una sola soglia, la stessa ovunque nell'app: almeno 3 ore vere.
      const libere=finestreCondivise(0);
      if(!libere || !libere.some(([a,z])=>z-a>=180)) continue;
      const ov=libere.reduce((s,[a,z])=>s+(z-a),0);
      const base=day(f0,o);
      out.push({
        uid:"nt-"+iso(base)+"-coppia@notturnisti.club", tipo:"coppia", allDay:true,
        start:localAt(base,0), end:localAt(base,1440), base,
        title:"Riposo in comune", desc:"Circa "+Math.round(ov/60)+" ore libere insieme.",
        avvisa:0, sveglia:false
      });
    }
    state.focus=f0;
    return out;
  }
  function buildCouple(days){
    const L=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//notturnisti.club//coppia//IT",
             "CALSCALE:GREGORIAN","METHOD:PUBLISH","X-WR-CALNAME:Notturnisti - insieme"];
    const stamp=icsDate(new Date(),0)+"Z";
    for(const e of buildCoupleEvents(days)){
      L.push("BEGIN:VEVENT",
        "UID:"+e.uid,
        "DTSTAMP:"+stamp,
        "DTSTART;VALUE=DATE:"+icsDay(e.base,0),"DTEND;VALUE=DATE:"+icsDay(e.base,1),
        "SUMMARY:"+esc7986(e.title),
        "DESCRIPTION:"+esc7986(e.desc),
        "TRANSP:TRANSPARENT","END:VEVENT");
    }
    L.push("END:VCALENDAR");
    return L.filter(Boolean).map(foldLine).join("\r\n");
  }

  normalizza();
  return {
    state, plan, caffeinaOre, luceDelGiorno, _orologioPasso: (y, I, mi = 0) => fjkPasso(y, I, MODELLI[mi]), buildIcs, buildCouple, buildEvents, buildCoupleEvents, codeAt, block, etichetta, tipoDelGiorno, fasciaDelGiorno, nomeTurno, nomeOre, fasciaOre, oreNotturne, eNotte,
    sharedDays, freeOverlap, asPartner,
    setIcs(o){ Object.assign(ICS, o||{}); return ICS; },
    // Esposti anche questi: prima privati alla closure, ma index.html (che
    // ora carica questo file invece di tenerne una copia a mano — vedi il
    // commento in testa al file) ne ha bisogno per avvisi e calcoli di
    // supporto intorno al piano principale (soglia bifasica, finestra
    // naturale, debito di sonno annotato, ecc). Nessuna delle funzioni
    // stesse è cambiata: solo il return si è allargato.
    CFG, constraint, simulate, at,
    startsInNight, spansNight, oraDi, isolaDalMio,
    freeWakeOk, freeWakeUsata, naturalMid, durataLibera, sincronizzaNeed, setFestivo,
    // index.html la richiama di nuovo dopo aver ripristinato lo state da
    // link/localStorage (quei valori possono arrivare fuori dai limiti
    // sensati) — prima aveva una seconda copia di LIMITI/normalizza() tutta
    // sua, stesso rischio di divergenza già visto altrove in questo file.
    normalizza
  };
}

// A livello di modulo, non dentro createEngine: parseConfig() (più sotto) le
// chiama per decodificare la config in arrivo dal client, e prima di questo
// fix erano annidate dentro createEngine — invisibili da fuori quella
// chiusura. Bug reale: qualunque richiesta con turni personalizzati (il
// parametro "s", presente in QUALUNQUE config reale, mai solo nei casi
// limite) falliva con "decShifts is not defined", un 500 non gestito.
const safeName = x => String(x==null?"":x).replace(/[<>"'\r\n\t:|]/g,"").trim().slice(0,24);

function decShifts(str){
  const o={};
  for(const part of String(str).split("|")){
    const [k,n,s,e] = part.split(":");
    if(!k || !/^[A-Z]$/.test(k) || k==="R") continue;
    const S=+s, E=+e; if(!isFinite(S)||!isFinite(E)||E<=S) continue;
    o[k]={n:safeName(n)||k, s:S, e:E};
  }
  return Object.keys(o).length ? o : null;
}

// Eccezioni al ciclo (cambi turno, turni variabili inseriti giorno per
// giorno) in forma compatta per link e calendario automatico:
// "20261015N.20261016R" — data + codice turno, separati da punto. Prima non
// viaggiavano affatto: il feed ICS e il link "Salva la configurazione"
// mostravano il ciclo nudo, cioè turni sbagliati o assenti proprio per chi
// li inserisce a mano. Solo da `daGiorni` giorni fa in poi (il passato
// remoto non serve a niente e allungherebbe il link), al massimo 400 voci.
export function encEcc(ecc, daGiorni=60, oggi=new Date()){
  if(!ecc || typeof ecc!=="object") return "";
  const m = new Date(oggi); m.setDate(m.getDate()-daGiorni);
  const minIso = m.getFullYear()+"-"+String(m.getMonth()+1).padStart(2,"0")+"-"+String(m.getDate()).padStart(2,"0");
  return Object.keys(ecc).filter(k=>/^\d{4}-\d{2}-\d{2}$/.test(k) && k>=minIso && typeof ecc[k]==="string" && /^[A-Z]$/.test(ecc[k]))
    .sort().slice(-400).map(k=>k.replace(/-/g,"")+ecc[k]).join(".");
}
export function decEcc(str){
  const o={};
  for(const part of String(str||"").split(".").slice(0,400)){
    const m=/^(\d{4})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])([A-Z])$/.exec(part); if(!m) continue;
    o[m[1]+"-"+m[2]+"-"+m[3]]=m[4];
  }
  return o;
}

// Giorni speciali per link e calendario automatico: "20261015F",
// "20261016_420-900" (solo orari veri), "20261017C540-1020". Senza assenze
// (ferie, malattia) quando escono dal telefono verso il server: per il piano
// bastano le eccezioni "R", e la malattia è un dato di salute.
const LETTERA = {ferie:"F", malattia:"M", formazione:"C", reperibile:"P", extra:"X"};
const DA_LETTERA = Object.fromEntries(Object.entries(LETTERA).map(([k,v])=>[v,k]));
export function encGiorni(giorni, {daGiorni=60, oggi=new Date(), senzaAssenze=false}={}){
  if(!giorni || typeof giorni!=="object") return "";
  const m = new Date(oggi); m.setDate(m.getDate()-daGiorni);
  const minIso = m.getFullYear()+"-"+String(m.getMonth()+1).padStart(2,"0")+"-"+String(m.getDate()).padStart(2,"0");
  const out=[];
  for(const k of Object.keys(giorni).filter(k=>/^\d{4}-\d{2}-\d{2}$/.test(k) && k>=minIso).sort()){
    const g=giorni[k]; if(!g || typeof g!=="object") continue;
    const t = senzaAssenze && ASSENZE[g.t] ? null : g.t;
    const ore = (isFinite(+g.s) && isFinite(+g.e) && g.s!=null && g.e!=null) ? Math.round(+g.s)+"-"+Math.round(+g.e) : "";
    if(!LETTERA[t] && !ore) continue;
    out.push(k.replace(/-/g,"")+(LETTERA[t]||"_")+ore);
  }
  return out.slice(-400).join(".");
}
export function decGiorni(str){
  const o={};
  for(const part of String(str||"").split(".").slice(0,400)){
    const m=/^(\d{4})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])([FMCPX_])(?:(\d{1,4})-(\d{1,4}))?$/.exec(part); if(!m) continue;
    const g={}; if(DA_LETTERA[m[4]]) g.t=DA_LETTERA[m[4]];
    if(m[5]!=null){ g.s=+m[5]; g.e=+m[6]; }
    if(g.t || g.s!=null) o[m[1]+"-"+m[2]+"-"+m[3]]=g;
  }
  return o;
}

export function buildFeed(config, opts={}){
  const e = createEngine(config);
  if(opts.ics) e.setIcs(opts.ics);
  const days = Math.min(Math.max(parseInt(opts.days,10)||42, 1), 120);
  return e.buildIcs(days);
}

export function buildCoupleFeed(config, opts={}){
  const e = createEngine(config);
  if(!e.state.pPattern) throw new Error("partner non configurato");
  const days = Math.min(Math.max(parseInt(opts.days,10)||60, 1), 120);
  return e.buildCouple(days);
}

const _CAFF = {bassa:1, media:1, alta:1};

export function parseConfig(params){
  const p = params;
  const cfg = {};
  const num=(k,lo,hi)=>{ const v=+p.get(k); return isFinite(v)&&v>0?Math.min(Math.max(v,lo),hi):undefined; };
  const okDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||"") && !isNaN(+new Date(v+"T12:00:00"));
  const okTime=v=>/^([01]\d|2[0-3]):[0-5]\d$/.test(v||"");
  const seq=v=>(v||"").toUpperCase().replace(/[^A-Z]/g,"").slice(0,400);
  // usa safeName e decShifts già definiti nel modulo (erano _duplicati_ identici)
  if(p.get("s")){ const sh=decShifts(p.get("s")); if(sh) cfg.shifts=sh; }
  if(p.get("p")) cfg.pattern=seq(p.get("p"))||undefined;
  if(okDate(p.get("a"))) cfg.anchor=p.get("a");
  if(okTime(p.get("w"))) cfg.freeWake=p.get("w");
  if(okTime(p.get("wb"))) cfg.freeBed=p.get("wb");
  if(_CAFF[p.get("cs")]) cfg.caffSens=p.get("cs");
  // "n" (need) non va letto qui: createEngine() lo sovrascrive sempre subito
  // con sincronizzaNeed(), derivandolo da freeBed/freeWake — leggerlo in cfg
  // non avrebbe mai alcun effetto (era così anche prima, solo non dichiarato).
  const ct=num("ct",0,240);   if(ct!==undefined) cfg.cTo=ct;
  const cf=num("cf",0,240);   if(cf!==undefined) cfg.cFrom=cf;
  const pr=num("pr",5,240);   if(pr!==undefined) cfg.prep=pr;
  const adv=num("adv",15,180);if(adv!==undefined) cfg.maxAdvance=adv;
  cfg.repeat = p.get("rep")!=="0";
  if(p.get("x")){ const x=decEcc(p.get("x")); if(Object.keys(x).length) cfg.ecc=x; }
  if(p.get("g")){ const g=decGiorni(p.get("g")); if(Object.keys(g).length) cfg.giorni=g; }
  if(p.get("pp")){ cfg.pPattern=seq(p.get("pp")); cfg.pAnchor=okDate(p.get("pa"))?p.get("pa"):cfg.anchor;
    if(p.get("ps")){ const psh=decShifts(p.get("ps")); if(psh) cfg.pShifts=psh; }
    if(okTime(p.get("pw"))) cfg.pWake=p.get("pw");
    if(okTime(p.get("pwb"))) cfg.pBed=p.get("pwb"); }
  return cfg;
}
