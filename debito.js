// debito.js — il debito di sonno: un solo conto per piano, diario e Andamenti. Puro.
//
// Un bilancio in minuti rispetto a quanto il PIANO chiedeva di dormire quella notte (il bisogno nelle notti
// libere, meno quando il turno non lascia di più: dopo l'ultima notte il piano stesso propone 4h30 per
// dormire normale la sera). Contare quei sonni brevi come debito faceva segnare 10 ore a chi seguiva il
// piano alla lettera. Ogni notte più corta del piano aumenta il debito per intero; ogni notte più lunga lo
// riduce solo in parte, perché il recupero è parziale [Banks 2010, Belenky 2003] — il coefficiente è una
// scelta prudente, non un valore misurato. Mai sotto zero, tetto a 6 ore (oltre, il consiglio non cambia)
// e finestra di 14 giorni, l'orizzonte degli studi di restrizione cronica [Van Dongen 2003]. Niente
// decadimento a tempo: il debito cala solo dormendo.
export const DEBITO = { rendimento: 0.5, tetto: 360, finestra: 14, minNotte: 15, maxNotte: 960, pisolinoMax: 300 };

const parseHM = s => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || "")); return m ? (+m[1]) * 60 + (+m[2]) : null; };
const giorno = k => Date.parse(k + "T12:00:00Z") / 864e5;
const durata = (a, b) => { if (a == null || b == null) return null; let d = b - a; while (d <= 0) d += 1440; return d; };

// Minuti di una notte annotata; null se manca o è un refuso (letto = sveglia, doppio tocco).
export function durataNotte(bed, wake) {
  const d = durata(parseHM(bed), parseHM(wake));
  return d !== null && d >= DEBITO.minNotte && d <= DEBITO.maxNotte ? d : null;
}

// Minuti dei pisolini FATTI di un giorno ({orario:{si,a,b}}).
export function minutiPisolini(seg) {
  let m = 0;
  for (const k in seg || {}) {
    const g = seg[k]; if (!g || !g.si) continue;
    const d = durata(parseHM(g.a || k), parseHM(g.b));
    if (d !== null && d < DEBITO.pisolinoMax) m += d;
  }
  return m;
}

// diario: {beds, wakes, pisolini, notti?}. notti: minuti già noti per data (vince sul diario:
// serve a chi ha solo la sveglia). fino: ultima data considerata (AAAA-MM-GG).
// obiettivo(data) → minuti che il piano chiedeva quella notte (default: need).
// I pisolini del giorno «fino» non contano: il piano li propone proprio quel giorno e
// contarli cambierebbe il piano che li ha proposti.
export function debitoSonno(diario, need, fino, finestra = DEBITO.finestra, obiettivo = () => need) {
  const { beds = {}, wakes = {}, pisolini = {}, notti = {} } = diario || {};
  // Si guardano solo i giorni della finestra, per data: con anni di diario scorrere
  // tutte le chiavi a ogni piano costava (il piano si ricalcola moltissime volte).
  const f = giorno(fino), date = [];
  for (let i = finestra - 1; i >= 0; i--) {
    const k = new Date((f - i) * 864e5).toISOString().slice(0, 10);
    if (wakes[k] != null || notti[k] != null) date.push(k);
  }
  let debito = 0, haFino = false; const serie = [];
  for (const k of date) {
    const notte = notti[k] != null ? notti[k] : durataNotte(beds[k], wakes[k]);
    if (notte === null) continue;
    const totale = notte + (k < fino ? minutiPisolini(pisolini[k]) : 0);
    const meta = obiettivo(k), delta = meta - totale;
    debito = Math.min(DEBITO.tetto, Math.max(0, debito + (delta > 0 ? delta : delta * DEBITO.rendimento)));
    serie.push({ date: k, debt: Math.round(debito), totale, meta, manca: Math.max(0, Math.round(delta)) });
    if (k === fino) haFino = true;
  }
  return { min: Math.round(debito), haFino, serie };
}
