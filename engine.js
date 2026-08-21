// engine.js — Motore di pianificazione Notturnisti, PURO.
// Nessun DOM, nessun browser, nessuno stato globale: gira identico nel browser,
// in Node e in un Worker Cloudflare. Le funzioni del motore sono estratte
// VERBATIM da index.html (stesso codice, stessi numeri). Il test differenziale
// prova che l'ICS generato qui e' identico byte-per-byte a quello del browser.

export const DEFAULTS = {
  pattern:"MPNSR", anchor:"2026-07-13",
  shifts:{ M:{n:"Mattino",s:420,e:840}, P:{n:"Pomeriggio",s:840,e:1260}, N:{n:"Notte",s:1260,e:1860} },
  repeat:true, cTo:25, cFrom:25, need:480, prep:45, freeBed:"23:30", freeWake:"07:30",
  maxAdvance:60, pPattern:"", pAnchor:"", evento:null, napTurno:"no", caffSens:"alta", pausa:""
};

const LIMITI = {need:[300,660,480], cTo:[0,240,25], cFrom:[0,240,25],
                prep:[10,180,45], maxAdvance:[20,120,60]};

export function createEngine(config){
  const state = Object.assign({}, DEFAULTS, {ecc:{}, wakes:{}, beds:{}, pisolini:{}}, config||{});
  state.focus = config && config.focus ? new Date(config.focus) : new Date();
  state.ecc = (state.ecc && typeof state.ecc==="object") ? state.ecc : {};
  state.wakes = state.wakes || {}; state.beds = state.beds || {}; state.pisolini = state.pisolini || {};

  const ICS = {turni:true, sonno:true, pisolini:true, caffe:true, luce:true, pasti:false, rientro:true, avviso:30};

  function normalizza(){
    for(const k in LIMITI){
      const [lo,hi,def]=LIMITI[k], v=+state[k];
      state[k] = (isFinite(v) && v>0) ? Math.min(Math.max(Math.round(v),lo),hi) : def;
    }
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
  napPreLungo: 120,             // davanti a un blocco lungo il pisolino pre-turno vale di più
  dormitaMax: 600,              // oltre le dieci ore il sonno in più rende poco
  caffeine:  480,    // [Drake 2013: minimo 6h] 8 = margine, ora è il valore di partenza
  caffScala: {bassa:240, media:360, alta:480},   // quanto prima smettere
  cbtOffset: 120,    // [SOLIDO] minimo corporeo ~2h prima della sveglia libera
  eveningDim:120, lightTaper: 120,
  daySleepMax:390,   // [DEFAULT] 6h30 di sonno diurno
  shortSleep: 270,   // [DEFAULT] 4h30 dopo l'ultimo turno notturno
  preShiftMax:330,   // [DEFAULT] 5h30 prima di un turno che parte nelle ore piccole
  napMin: 30, napMax: 120, napPre: 90, napGap: 30, mealGap: 75, napBuffer: 90,
  adaptThreshold: 4, // [AASM] sotto le 4 notti non conviene spostarsi
  preNightDelay:120, bindSlack: 20, H: 24
};

const t = s => (+s.slice(0,2))*60 + (+s.slice(3,5));

const clamp = (v,a,b) => Math.max(a, Math.min(b, v));

const day = (d,n) => { const x=new Date(d); x.setDate(x.getDate()+n); return x; };

const dnum = d => Math.floor(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/864e5);

const mod1440 = m => ((m % 1440) + 1440) % 1440;

const hhmm = m => { const x=mod1440(Math.round(m/5)*5);
  return String(Math.floor(x/60)).padStart(2,"0")+":"+String(x%60).padStart(2,"0"); };

const hhmm15 = m => { const x=mod1440(Math.round(m/15)*15);
  return String(Math.floor(x/60)).padStart(2,"0")+":"+String(x%60).padStart(2,"0"); };

const near = (m,r) => { while(m-r>720) m-=1440; while(m-r<-720) m+=1440; return m; };

const iso = d => d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");

function eccezioneA(off){
  const e = state.ecc && state.ecc[iso(day(state.focus,off))];
  return (typeof e === "string" && e) ? e : null;
}

function codeAt(off){
  const ecc = eccezioneA(off); if(ecc) return ecc;
  const p = (state.pattern.toUpperCase().replace(/[^A-Z]/g,"") || "R");
  const n = dnum(day(state.focus,off)) - dnum(new Date(state.anchor+"T12:00:00"));
  if(state.repeat === false) return (n < 0 || n >= p.length) ? "?" : p[n];
  return p[((n % p.length) + p.length) % p.length];
}

function block(off){
  const c = codeAt(off), d = state.shifts[c];
  if(!d) return {c, rest:true};
  return {c, name:d.n, start:d.s, end:d.e, rest:false};
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

function debitoVero(wakePianificato, durPianificata){
  const d = dormitoVero(wakePianificato, durPianificata);
  return d === null ? 0 : Math.min(Math.max(Math.round(durPianificata - d), 0), 480);
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
  return Math.min(m, 180);
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
  if(iso(day(state.focus,off)) !== e.d) return null;
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
    const dur = run ? (diGiorno ? Math.min(state.need, CFG.daySleepMax) : state.need)
                    : (diGiorno ? CFG.shortSleep : Math.min(state.need, CFG.daySleepMax));
    return {pin:true, onset, dur, mid:Math.round(onset+dur/2), kind: run ? "diurno" : "corto"};
  }
  // 2. il turno di domani obbliga a una sveglia più presta del naturale → vincolo
  if(!nb.rest && !startsInNight(nb)){
    const wake = nb.start + 1440 - state.cTo - state.prep;
    if(wake < winEnd() - CFG.bindSlack)
      return {pin:true, onset:wake-state.need, dur:state.need,
              mid:Math.round(wake-state.need/2), kind:"pre-turno"};
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
  const estendibile = (b.rest && spansNight(nb)) || recupero;
  // quante notti comincia domani: davanti a un blocco lungo si può dormire di più
  let bloccoDopo = 0;
  if(b.rest) for(let k=1; k<=10 && spansNight(block(off+k)); k++) bloccoDopo=k;
  return {pin:false, floor, ceil, estendibile, bloccoDopo, kind: spansNight(nb) ? "pre-notte" : "libero"};
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

  let prev = null;
  for(let i=0;i<N;i++){
    const c = C[i]; let target, dr = +(c.pin ? c.dur : state.need) || 480;
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
    onset = Math.round(onset/5)*5; dr = Math.round(dr/5)*5;
    mid[i] = Math.round(onset + dr/2);
    if(!c.pin && prev !== null && Math.abs(mid[i]-prev) > 15) meta[i].ramp = true;
    if(c.pin && prev !== null && !meta[i].reset){
      const jump = mid[i]-prev, lim = jump<0 ? state.maxAdvance : CFG.maxDelay;
      if(Math.abs(jump) > lim+1){ meta[i].gap = Math.abs(jump)-lim; meta[i].gapNight = isN(i); }
    }
    if(c.estendibile && !c.pin && !meta[i].tight){
      const tetto = isFinite(c.ceil) ? c.ceil : Infinity;
      const max = Math.min(state.need + CFG.estensionePreNotte, CFG.dormitaMax, tetto - onset);
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

function plan(){
  const S = simulate(), b = block(0), pb = block(-1), nb = block(1);
  const s = at(S,0), sp = at(S,-1);
  const end = s.onset + s.dur, wakePiano = sp.onset + sp.dur - 1440;
  const wake = svegliaVera(wakePiano);
  const oreCaffe = CFG.caffScala[state.caffSens] || CFG.caffeine;
  const cbt = s.mid + CFG.cbtOffset, cut = s.onset - oreCaffe, shift = s.mid - sp.mid;

  const sleeps = [{a:s.onset, b:end}], naps = [];
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
    const minimo = sp.mid + CFG.cbtOffset;              // dove cade il peggio
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
  if(spansNight(b) && !startsInNight(b)){
    const profondo = deepNight(b) >= 120;          // pesca davvero nel cuore della notte
    // se hai dormito più del previsto, «manca» diventa negativo e il pisolino
    // sparisce da solo: hai già coperto quello che serviva
    const dormito = dormitoVero(wakePiano, sp.dur);
    const manca = state.need - (dormito === null ? sp.dur : dormito) + saltatiIeri();
    const veglia = s.onset - wake;                 // quanto resti sveglio in tutto
    // Oltre le 16 ore la veglia da sola basta a peggiorare i riflessi, anche se hai
    // dormito bene e anche se il turno non tocca il cuore della notte. Lì però serve
    // un pisolino corto, che taglia la veglia senza aggiungere ore di sonno inutili.
    const solaVeglia = !profondo && manca <= 30 && veglia > 960;
    if(profondo || manca > 30 || solaVeglia){
      const napEnd = b.start - state.cTo - CFG.mealGap - CFG.napGap;
      // se dormirai in turno, quello prima di uscire serve meno: le due cose
      // si bilanciano, non si sommano
      const giaCoperto = naps.reduce((a,x)=>a+(x.turno?(x.b-x.a):0),0);
      // Davanti a un blocco lungo di notti il pisolino prima di uscire vale di
      // più: la sveglia non si può spostare al pomeriggio (servirebbero quindici
      // ore a letto), quindi le ore si recuperano qui. Davanti a un blocco corto
      // resta contenuto, perché lì il senso è non spostarsi affatto.
      let bloccoN = 0;
      for(let k=0; k<10 && spansNight(block(k)); k++) bloccoN=k+1;
      const soglia = bloccoN >= CFG.adaptThreshold ? CFG.napPreLungo : CFG.napPre;
      // Un ciclo intero serve a colmare un debito. Se hai già dormito quello che
      // ti serve, resta il motivo preventivo — la caduta delle ore centrali non
      // dipende da quanto hai dormito — ma bastano venti minuti, che danno la
      // stessa sveltezza senza il rimbambimento del risveglio dal sonno profondo.
      // Solo se l'hai annotato tu: quando è il piano stesso ad aver allungato il
      // sonno prima delle notti, il pisolino preventivo resta quello che è, ed è
      // il più importante del ciclo.
      const inPari = dormito !== null && manca <= 0;
      const len = solaVeglia ? 25
        : inPari ? CFG.napBreve
        : clamp(Math.max(manca - giaCoperto, profondo ? soglia - giaCoperto : CFG.napMin),
                CFG.napMin, CFG.napMax);
      let napStart = napEnd - len;
      if(napStart < wake + 60) napStart = wake + 60;   // lo accorcio invece di buttarlo
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
    const debito = debitoVero(wakePiano, sp.dur) + saltatiIeri();
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
    const minimo = sp.mid + CFG.cbtOffset;
    const tocca  = s.onset >= minimo - 240;
    const soglia = s.meta.reset ? 1140 : 960;      // il rientro è una giornata lunga apposta
    if(veglia > soglia && (tocca || veglia > 1080)){
      const len = s.meta.reset ? 30 : clamp(Math.round(veglia/12), 30, 90);
      let fine = s.onset - 300;
      if(!b.rest && b.start > wake + 150)
        fine = Math.min(fine, b.start - state.cTo - CFG.mealGap - CFG.napGap);
      const inizio = Math.max(fine - len, wake + 180);
      const scontro = !b.rest && inizio < b.end && fine > b.start;
      if(fine - inizio >= CFG.napMin && !scontro)
        { const p = dallaFine(fine, fine - inizio, Math.max(wake + 180, fine - 90), {lungo:true, ore:veglia});
          if(p) naps.push(p); }
    }
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
  return {b, pb, nb, s, sp, S, wake, end, cut, cbt, shift, sleeps, naps, meals, busy,
          night:spansNight(b), lateStart:startsInNight(b), debitoScoperto};
}

const safeName = x => String(x==null?"":x).replace(/[<>"'\r\n\t:|]/g,"").trim().slice(0,24);

const encShifts = o => Object.entries(o).map(([k,v])=>[k,safeName(v.n)||k,v.s,v.e].join(":")).join("|");

function decShifts(str){
  const o={};
  for(const part of str.split("|")){
    const [k,n,s,e] = part.split(":");
    if(!k || !/^[A-Z]$/.test(k) || k==="R") continue;
    const S=+s, E=+e; if(!isFinite(S)||!isFinite(E)||E<=S) continue;
    o[k]={n:safeName(n)||k, s:S, e:E};
  }
  return Object.keys(o).length ? o : null;
}

function asPartner(fn){
  // Il partner è un'entità autonoma: ha una sua sequenza, le SUE definizioni di
  // turno (può fare un orario fisso di giorno mentre tu ruoti) e la SUA finestra
  // di sonno. Se non le ha impostate, eredita le tue: retrocompatibile.
  const p=state.pattern, a=state.anchor, sh=state.shifts, fw=state.freeWake, fb=state.freeBed;
  state.pattern=state.pPattern; state.anchor=state.pAnchor||a;
  if(state.pShifts) state.shifts=state.pShifts;
  if(state.pWake) state.freeWake=state.pWake;
  if(state.pBed)  state.freeBed=state.pBed;
  let r=null; try{ r=fn(); }catch(e){}
  state.pattern=p; state.anchor=a; state.shifts=sh; state.freeWake=fw; state.freeBed=fb;
  return r;
}

function busyOf(off){
  const f=state.focus; state.focus=day(f,off);
  let out=[];
  try{
    const S=simulate(), s=at(S,0), sp=at(S,-1), b=block(0);
    const wake=sp.onset+sp.dur-1440;
    if(wake>0) out.push([0,Math.min(wake,1440)]);
    if(s.onset<1440) out.push([Math.max(s.onset,0),1440]);
    if(!b.rest) out.push([Math.max(b.start,0),Math.min(b.end,1440)]);
    // un turno di ieri che sconfina oltre mezzanotte occupa anche stamattina
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

function buildIcs(days){
  const L=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//notturnisti.club//pianificatore//IT",
           "CALSCALE:GREGORIAN","METHOD:PUBLISH","X-WR-CALNAME:Notturnisti",
           // dice al calendario ogni quanto ricontrollare: senza, alcune app
           // aggiornano di rado e "si aggiorna da solo" non si vede
           "REFRESH-INTERVAL;VALUE=DURATION:PT12H","X-PUBLISHED-TTL:PT12H"];
  const f0=state.focus, stamp=icsDate(new Date(),0)+"Z";
  // L'identificativo dipende solo da giorno e tipo: riesportando, il calendario
  // aggiorna gli eventi invece di duplicarli. Con un contatore progressivo,
  // ogni esportazione creava una copia nuova di tutto.
  const ev=(base,a,b,tipo,title,desc,avvisa)=>{
    L.push("BEGIN:VEVENT",
      "UID:nt-"+iso(base)+"-"+tipo+"@notturnisti.club",
      "DTSTAMP:"+stamp,"DTSTART:"+icsDate(base,a),"DTEND:"+icsDate(base,b),
      "SUMMARY:"+esc7986(title));
    if(desc) L.push("DESCRIPTION:"+esc7986(desc));
    if(avvisa && ICS.avviso>0)
      L.push("BEGIN:VALARM","ACTION:DISPLAY","TRIGGER:-PT"+ICS.avviso+"M",
             "DESCRIPTION:"+esc7986(title),"END:VALARM");
    L.push("END:VEVENT");
  };
  for(let o=0;o<days;o++){
    state.focus=day(f0,o);
    if(codeAt(0)==="?") continue;
    let P; try{ P=plan(); }catch(e){ continue; }
    const base=day(f0,o);
    // il turno lo sai già: evento sì, sveglia no
    if(ICS.turni && !P.b.rest) ev(base,P.b.start,P.b.end,"turno","Turno "+(P.b.name||P.b.c),"",false);
    if(ICS.sonno) ev(base,P.s.onset,P.s.onset+P.s.dur,"sonno","Sonno",
      "Pianificato da notturnisti.club",true);
    if(ICS.pisolini) P.naps.forEach((n,i)=>ev(base,n.a,n.b,"pisolino"+i,
      (n.rec||n.debito)?"Pisolino di recupero":((n.b-n.a)<40?"Pisolino breve":"Pisolino"),"",true));
    if(ICS.caffe) ev(base,P.cut,P.cut+15,"caffe","Ultimo caffè",
      "Dopo quest'ora la caffeina è ancora in circolo quando provi a dormire.",true);
    // La luce è la leva principale sull'orologio: senza, il piano si disfa.
    if(ICS.luce && isFinite(P.wake))
      ev(base,P.wake+15,P.wake+35,"luce","Luce",
        "Luce forte adesso: è ciò che tiene agganciato l'orologio al turno.",true);
    if(ICS.pasti){
      const mm=(P.meals||[]).find(x=>x&&x.main);
      if(mm&&isFinite(mm.at)) ev(base,mm.at,mm.at+30,"pasti","Pasto principale",
        "Mangiare a orari stabili aiuta a tenere fermo l'orologio.",false);
    }
    // Il rientro dalla notte è il momento di massimo rischio alla guida.
    if(ICS.rientro && !P.b.rest && (P.night||P.lateStart))
      ev(base,P.b.end,P.b.end+20,"rientro","Rientro: non guidare stanco",
        "Occhiali da sole appena esci. Se sei stanco, fermati 20 minuti e un caffè prima di ripartire.",true);
  }
  state.focus=f0;
  L.push("END:VCALENDAR");
  return L.filter(Boolean).join("\r\n");
}

  // feed coppia: eventi tutto-il-giorno sui riposi in comune. Riusa asPartner /
  // freeOverlap (estratti verbatim): stessi numeri della striscia partner in app.
  function icsDay(base, o){ const d=day(base,o);
    return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join(""); }
  function buildCouple(days){
    const L=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//notturnisti.club//coppia//IT",
             "CALSCALE:GREGORIAN","METHOD:PUBLISH","X-WR-CALNAME:Notturnisti - insieme"];
    const f0=state.focus, stamp=icsDate(new Date(),0)+"Z";
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
      L.push("BEGIN:VEVENT",
        "UID:nt-"+iso(base)+"-coppia@notturnisti.club",
        "DTSTAMP:"+stamp,
        "DTSTART;VALUE=DATE:"+icsDay(base,0),"DTEND;VALUE=DATE:"+icsDay(base,1),
        "SUMMARY:"+esc7986("Riposo in comune"),
        "DESCRIPTION:"+esc7986("Circa "+Math.round(ov/60)+" ore libere insieme."),
        "TRANSP:TRANSPARENT","END:VEVENT");
    }
    state.focus=f0;
    L.push("END:VCALENDAR");
    return L.filter(Boolean).join("\r\n");
  }


  normalizza();
  return {
    state, plan, buildIcs, buildCouple, codeAt, block,
    sharedDays, freeOverlap, asPartner,
    setIcs(o){ Object.assign(ICS, o||{}); return ICS; }
  };
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

const _safeName = x => String(x==null?"":x).replace(/[<>"'\r\n\t:|]/g,"").trim().slice(0,24);
function _decShifts(str){
  const o={};
  for(const part of String(str).split("|")){
    const [k,n,s,e] = part.split(":");
    if(!k || !/^[A-Z]$/.test(k) || k==="R") continue;
    const S=+s, E=+e; if(!isFinite(S)||!isFinite(E)||E<=S) continue;
    o[k]={n:_safeName(n)||k, s:S, e:E};
  }
  return Object.keys(o).length ? o : null;
}
const _CAFF = {bassa:1, media:1, alta:1};

export function parseConfig(params){
  const p = params;
  const cfg = {};
  const num=(k,lo,hi)=>{ const v=+p.get(k); return isFinite(v)&&v>0?Math.min(Math.max(v,lo),hi):undefined; };
  const okDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||"") && !isNaN(+new Date(v+"T12:00:00"));
  const okTime=v=>/^([01]\d|2[0-3]):[0-5]\d$/.test(v||"");
  const seq=v=>(v||"").toUpperCase().replace(/[^A-Z]/g,"").slice(0,400);
  if(p.get("s")){ const sh=_decShifts(p.get("s")); if(sh) cfg.shifts=sh; }
  if(p.get("p")) cfg.pattern=seq(p.get("p"))||undefined;
  if(okDate(p.get("a"))) cfg.anchor=p.get("a");
  if(okTime(p.get("w"))) cfg.freeWake=p.get("w");
  if(okTime(p.get("wb"))) cfg.freeBed=p.get("wb");
  if(_CAFF[p.get("cs")]) cfg.caffSens=p.get("cs");
  const n=num("n",240,900);   if(n!==undefined) cfg.need=n;
  const ct=num("ct",0,240);   if(ct!==undefined) cfg.cTo=ct;
  const cf=num("cf",0,240);   if(cf!==undefined) cfg.cFrom=cf;
  const pr=num("pr",5,240);   if(pr!==undefined) cfg.prep=pr;
  const adv=num("adv",15,180);if(adv!==undefined) cfg.maxAdvance=adv;
  cfg.repeat = p.get("rep")!=="0";
  if(p.get("pp")){ cfg.pPattern=seq(p.get("pp")); cfg.pAnchor=okDate(p.get("pa"))?p.get("pa"):cfg.anchor;
    if(p.get("ps")){ const psh=_decShifts(p.get("ps")); if(psh) cfg.pShifts=psh; }
    if(okTime(p.get("pw"))) cfg.pWake=p.get("pw");
    if(okTime(p.get("pwb"))) cfg.pBed=p.get("pwb"); }
  return cfg;
}
