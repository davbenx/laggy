// importa.js — I turni che arrivano da fuori: un file .ics (esportato da un
// altro calendario o dal gestionale dei turni), un foglio .csv o .xlsx, gli
// eventi del calendario del telefono. Tutto si legge qui, sul telefono: niente
// parte verso un server. Puro (niente DOM): gira identico in Node per i test.
//
// Il risultato è sempre lo stesso: una lista di giorni {data, etichetta, s, e}
// (s/e in minuti dalla mezzanotte, solo se la fonte ha gli orari). Cosa vuol
// dire ogni etichetta («N», «Notte», «PD», «Ferie»…) lo propone indovina() e
// lo conferma la persona: i fogli turni non hanno uno standard.

const pad = n => String(n).padStart(2, "0");
export const isoDi = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const valida = (a, m, g) => { const d = new Date(a, m - 1, g, 12); return d.getFullYear() === a && d.getMonth() === m - 1 && d.getDate() === g ? d : null; };
const pulisci = v => String(v == null ? "" : v).replace(/\s+/g, " ").trim();
const senzaAccenti = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/* ── iCalendar ─────────────────────────────────────────────────────────── */
// Solo quello che serve: titolo, inizio, fine. Le ripetizioni (RRULE) non si
// espandono: chi esporta i turni li esporta uno per uno.
export function leggiIcs(testo) {
  const righe = String(testo || "").replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  const out = []; let ev = null;
  for (const r of righe) {
    const R = r.trim().toUpperCase();
    if (R === "BEGIN:VEVENT") { ev = {}; continue; }
    if (R === "END:VEVENT") { if (ev && ev.inizio) out.push(ev); ev = null; continue; }
    if (!ev) continue;
    const i = r.indexOf(":"); if (i < 0) continue;
    const testa = r.slice(0, i), val = r.slice(i + 1), nome = testa.split(";")[0].toUpperCase();
    if (nome === "SUMMARY") ev.titolo = pulisci(val.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1"));
    else if (nome === "DTSTART" || nome === "DTEND") {
      const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(val.trim()); if (!m) continue;
      let d;
      if (!m[4]) d = new Date(+m[1], m[2] - 1, +m[3]);
      else if (m[7]) d = new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5]));
      else d = new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5]);   // TZID: l'ora del telefono
      if (nome === "DTSTART") { ev.inizio = d; ev.tuttoIlGiorno = !m[4]; } else ev.fine = d;
    }
  }
  return out;
}

// Eventi (dal file .ics o dal calendario del telefono) → giorni. Un evento di
// un giorno intero vale per ogni giorno che copre; uno con gli orari vale per
// il giorno in cui comincia (la notte è del giorno in cui si entra).
export function eventiInGiorni(eventi) {
  const out = [];
  for (const ev of eventi || []) {
    const titolo = pulisci(ev.titolo); if (!titolo || !(ev.inizio instanceof Date) || isNaN(ev.inizio)) continue;
    if (ev.tuttoIlGiorno) {
      const fine = ev.fine instanceof Date && !isNaN(ev.fine) ? ev.fine : new Date(+ev.inizio + 864e5);
      const d = new Date(ev.inizio.getFullYear(), ev.inizio.getMonth(), ev.inizio.getDate(), 12);
      for (let k = 0; k < 62 && d < fine; k++, d.setDate(d.getDate() + 1)) out.push({ data: isoDi(d), etichetta: titolo });
      continue;
    }
    const s = ev.inizio.getHours() * 60 + ev.inizio.getMinutes();
    const dur = ev.fine instanceof Date && !isNaN(ev.fine) ? Math.round((ev.fine - ev.inizio) / 6e4) : 0;
    if (dur > 0 && dur <= 960) out.push({ data: isoDi(ev.inizio), etichetta: titolo, s, e: s + dur });
    else out.push({ data: isoDi(ev.inizio), etichetta: titolo });
  }
  return out;
}

/* ── CSV ───────────────────────────────────────────────────────────────── */
export function leggiCsv(testo) {
  const t = String(testo || "").replace(/^﻿/, "");
  const prime = t.split(/\r?\n/).slice(0, 10).join("\n");
  const conta = c => prime.split(c).length;
  const sep = [";", "\t", ","].reduce((a, b) => conta(b) > conta(a) ? b : a);
  const righe = []; let riga = [], cella = "", virgolette = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (virgolette) {
      if (c === '"' && t[i + 1] === '"') { cella += '"'; i++; }
      else if (c === '"') virgolette = false;
      else cella += c;
    } else if (c === '"') virgolette = true;
    else if (c === sep) { riga.push(cella); cella = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; riga.push(cella); righe.push(riga); riga = []; cella = ""; }
    else cella += c;
  }
  if (cella || riga.length) { riga.push(cella); righe.push(riga); }
  return righe.map(r => r.map(pulisci)).filter(r => r.some(Boolean));
}

/* ── XLSX ──────────────────────────────────────────────────────────────── */
// Un .xlsx è uno zip di file XML. Si legge il primo foglio con le stringhe
// condivise; per decomprimere basta il DecompressionStream del browser.
async function inflate(byte) {
  if (typeof DecompressionStream === "undefined") throw new Error("xlsx-non-supportato");
  const s = new Blob([byte]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
async function unzip(buf, vuoi) {
  const b = new Uint8Array(buf), v = new DataView(b.buffer, b.byteOffset, b.byteLength), out = {};
  let fine = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65558); i--) if (v.getUint32(i, true) === 0x06054b50) { fine = i; break; }
  if (fine < 0) throw new Error("zip-non-valido");
  const n = v.getUint16(fine + 10, true); let p = v.getUint32(fine + 16, true);
  const dec = new TextDecoder();
  for (let k = 0; k < n; k++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const metodo = v.getUint16(p + 10, true), dim = v.getUint32(p + 20, true);
    const ln = v.getUint16(p + 28, true), lx = v.getUint16(p + 30, true), lc = v.getUint16(p + 32, true);
    const loc = v.getUint32(p + 42, true), nome = dec.decode(b.subarray(p + 46, p + 46 + ln));
    p += 46 + ln + lx + lc;
    if (!vuoi(nome)) continue;
    const inizio = loc + 30 + v.getUint16(loc + 26, true) + v.getUint16(loc + 28, true);
    const dati = b.subarray(inizio, inizio + dim);
    out[nome] = dec.decode(metodo === 0 ? dati : await inflate(dati));
  }
  return out;
}
const entita = s => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, "&");
const testi = xml => entita((xml.match(/<t\b[^>]*>([\s\S]*?)<\/t>/g) || []).map(x => x.replace(/<[^>]+>/g, "")).join(""));
const colonna = ref => { let n = 0; for (const c of ref.replace(/\d+/g, "")) n = n * 26 + (c.charCodeAt(0) - 64); return n - 1; };
export async function leggiXlsx(buf) {
  const f = await unzip(buf, n => /^xl\/(sharedStrings\.xml|worksheets\/sheet\d+\.xml)$/.test(n));
  const ss = f["xl/sharedStrings.xml"] ? (f["xl/sharedStrings.xml"].match(/<si\b[\s\S]*?<\/si>/g) || []).map(testi) : [];
  const fogli = Object.keys(f).filter(n => /worksheets\/sheet/.test(n)).sort((a, b) => parseInt(a.match(/\d+/)) - parseInt(b.match(/\d+/)));
  if (!fogli.length) throw new Error("xlsx-vuoto");
  const righe = [];
  for (const r of f[fogli[0]].match(/<row\b[\s\S]*?<\/row>/g) || []) {
    const riga = [];
    for (const c of r.match(/<c\b[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) || []) {
      const ref = (/\br="([A-Z]+\d+)"/.exec(c) || [])[1]; if (!ref) continue;
      const tipo = (/\bt="(\w+)"/.exec(c) || [])[1], val = (/<v>([\s\S]*?)<\/v>/.exec(c) || [])[1];
      let x = "";
      if (tipo === "s") x = ss[+val] || "";
      else if (tipo === "inlineStr") x = testi(c);
      else if (val != null) x = entita(val);
      riga[colonna(ref)] = pulisci(x);
    }
    righe.push(Array.from(riga, x => x || ""));
  }
  return righe.filter(r => r.some(Boolean));
}

/* ── Tabelle → giorni ──────────────────────────────────────────────────── */
const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
// "2026-11-03", "03/11/2026", "3/11/26", "03.11.2026", "lun 3/11", un numero
// di serie di Excel (giorni dal 1900). Giorno prima del mese, all'italiana.
export function leggiData(v, anno) {
  const t = pulisci(v); if (!t) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
  if (m) return valida(+m[1], +m[2], +m[3]);
  m = /(?:^|\s)(\d{1,2})([\/.\-])(\d{1,2})(?:[\/.\-](\d{2,4}))?(?:\s|$)/.exec(t);
  // senza anno solo con la barra: «07.30» è un'ora, non il 7 marzo
  if (m && (m[4] || m[2] === "/")) {
    let g = +m[1], me = +m[3], a = m[4] ? +m[4] : anno;
    if (a && a < 100) a += 2000;
    if (me > 12 && g <= 12) [g, me] = [me, g];
    return a ? valida(a, me, g) : null;
  }
  if (/^\d{5}(\.\d+)?$/.test(t) && +t >= 36526 && +t <= 73051) {   // 2000–2099
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(+t) * 864e5);
    return valida(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  return null;
}
const ORA = /(\d{1,2})[:.](\d{2})/;
const minuti = v => { const m = ORA.exec(v || ""); return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : null; };
// "07:00-14:00", "21.00 – 07.00": orari dentro una cella
function orariIn(v) {
  const m = /(\d{1,2}[:.]\d{2})\s*[-–—a]\s*(\d{1,2}[:.]\d{2})/.exec(v || ""); if (!m) return null;
  const s = minuti(m[1]); let e = minuti(m[2]); if (s == null || e == null) return null;
  while (e <= s) e += 1440;
  return { s, e };
}
const giornoNum = v => { const t = pulisci(v); const m = /^(?:[a-zà-ù]{1,4}\.?\s*)?(\d{1,2})(?:\s*[a-zà-ù]{1,4}\.?)?$/i.exec(t); return m && +m[1] >= 1 && +m[1] <= 31 ? +m[1] : null; };
function meseIn(righe) {
  for (const r of righe) for (const c of r) {
    const t = senzaAccenti(pulisci(c).toLowerCase());
    for (let i = 0; i < 12; i++) if (t.includes(MESI[i])) { const a = /(20\d{2})/.exec(t); return { mese: i + 1, anno: a ? +a[1] : null }; }
  }
  return null;
}
const trasponi = r => { const n = Math.max(0, ...r.map(x => x.length)); return Array.from({ length: n }, (_, j) => r.map(x => x[j] || "")); };

// Riconosce la forma del foglio:
//  "date"    una colonna di date e una col turno (ed eventualmente gli orari)
//  "griglia" i giorni del mese in intestazione (1…31 o date), una riga per
//            persona: va scelta la propria (o le colonne, se il foglio è girato)
// opz: {anno, mese} per i fogli che hanno solo i numeri dei giorni;
//      riga: l'indice della persona scelta (fra quelle restituite).
export function tabellaInGiorni(righe, opz = {}) {
  const anno = opz.anno || new Date().getFullYear();
  if (!righe || !righe.length) return { tipo: "vuoto", giorni: [] };
  // 1) colonna di date
  const nc = Math.max(...righe.map(r => r.length));
  let best = -1, nBest = 0;
  for (let c = 0; c < nc; c++) { const n = righe.filter(r => leggiData(r[c], anno)).length; if (n > nBest) { nBest = n; best = c; } }
  if (best >= 0 && nBest >= 3 && nBest >= righe.filter(r => r[best]).length * 0.5) {
    const conDate = righe.filter(r => leggiData(r[best], anno));
    const altre = [...Array(nc).keys()].filter(c => c !== best);
    const orari = altre.filter(c => conDate.filter(r => /^\d{1,2}[:.]\d{2}$/.test(r[c] || "")).length >= conDate.length * 0.5);
    const etich = altre.filter(c => !orari.includes(c))
      .map(c => ({ c, n: conDate.filter(r => r[c] && r[c].length <= 30 && !leggiData(r[c], anno)).length }))
      .sort((a, b) => b.n - a.n)[0];
    const giorni = [];
    for (const r of conDate) {
      const d = leggiData(r[best], anno), et = etich && etich.n ? pulisci(r[etich.c]) : "";
      let o = orari.length >= 2 ? { s: minuti(r[orari[0]]), e: minuti(r[orari[1]]) } : orariIn(et);
      if (o && (o.s == null || o.e == null)) o = null;
      if (o) while (o.e <= o.s) o.e += 1440;
      const etichetta = et.replace(/(\d{1,2}[:.]\d{2})\s*[-–—a]\s*(\d{1,2}[:.]\d{2})/, "").trim() || (o ? "Turno" : "");
      if (!etichetta) continue;
      giorni.push(Object.assign({ data: isoDi(d), etichetta }, o || {}));
    }
    return { tipo: "date", giorni };
  }
  // 2) griglia: giorni in una riga (o in una colonna, se il foglio è girato)
  for (const girato of [false, true]) {
    const R = girato ? trasponi(righe) : righe;
    for (let h = 0; h < Math.min(R.length, 15); h++) {
      const col = {};
      R[h].forEach((v, j) => { const d = leggiData(v, anno); const g = d ? d : giornoNum(v); if (g) col[j] = g; });
      const js = Object.keys(col).map(Number);
      if (js.length < 7) continue;
      const persone = [];
      for (let i = h + 1; i < R.length; i++) {
        const piene = js.filter(j => pulisci(R[i][j])).length;
        if (piene < Math.min(5, js.length / 2)) continue;
        const nome = R[i].slice(0, Math.min(...js)).map(pulisci).filter(Boolean).join(" ") || ("Riga " + (persone.length + 1));
        persone.push({ indice: i, nome });
      }
      if (!persone.length) continue;
      const mi = meseIn(R.slice(0, h + 1)) || {};
      const mese = opz.mese || mi.mese || (new Date().getMonth() + 1), annoG = opz.anno || mi.anno || anno;
      const scelta = persone.length === 1 ? persone[0] : persone.find(p => p.indice === opz.riga);
      const giorni = [];
      if (scelta) for (const j of js) {
        const v = pulisci(R[scelta.indice][j]); if (!v) continue;
        const d = col[j] instanceof Date ? col[j] : valida(annoG, mese, col[j]); if (!d) continue;
        const o = orariIn(v);
        giorni.push(Object.assign({ data: isoDi(d), etichetta: v.replace(/(\d{1,2}[:.]\d{2})\s*[-–—a]\s*(\d{1,2}[:.]\d{2})/, "").trim() || "Turno" }, o || {}));
      }
      const conDate = js.some(j => col[j] instanceof Date);
      return { tipo: "griglia", persone, scelta: scelta ? scelta.indice : null, mese, anno: annoG, meseNoto: conDate || !!mi.mese, giorni };
    }
  }
  return { tipo: "sconosciuto", giorni: [] };
}

/* ── Cosa vuol dire un'etichetta ───────────────────────────────────────── */
// Restituisce la chiave di un turno ("M", "N"…), "R" (riposo), un giorno
// speciale ("ferie", "malattia", "reperibile", "formazione") o null (ignora).
export function indovina(etichetta, s, e, shifts) {
  shifts = shifts || {};
  const raw = pulisci(etichetta), L = senzaAccenti(raw.toLowerCase());
  const chiavi = Object.keys(shifts);
  // la lettera del turno, scritta così com'è
  const K = raw.toUpperCase();
  if (/^[A-Z]$/.test(K) && shifts[K]) return K;
  if (/^(r|rp|rip|riposo|libero|lib|l|off|day off|-|–|\/|x|rs|riposo settimanale|rc|riposo compensativo)$/.test(L) || /\briposo\b|\blibero\b|day off/.test(L)) return "R";
  if (/^(s|sm|smonto|smo)$/.test(L) || /smonto/.test(L)) return shifts.S ? "S" : "R";
  if (/^(f|fe|fer|ferie|v|vac)$/.test(L) || /ferie|vacanz|holiday|congedo|permesso/.test(L)) return "ferie";
  if (/^(mal|mt|ml)$/.test(L) || /malatt|sick|infortun/.test(L)) return "malattia";
  if (/^(rep|re|pd|prd|pr)$/.test(L) || /reperib|pronta disp|on.?call/.test(L)) return "reperibile";
  if (/^(fo|for|ecm|agg)$/.test(L) || /formaz|corso|aggiornam|training/.test(L)) return "formazione";
  // il nome del turno ("Notte", "Pomeriggio 14-21")
  for (const k of chiavi) { const n = senzaAccenti(String(shifts[k].n || "").toLowerCase()); if (n.length >= 3 && (L.startsWith(n) || (L.length >= 3 && n.startsWith(L)))) return k; }
  // gli orari: il turno che comincia e finisce più vicino (entro un'ora)
  if (s != null && e != null) {
    let meglio = null, dist = Infinity;
    for (const k of chiavi) { const d = Math.abs(shifts[k].s - s) + Math.abs(shifts[k].e - e); if (d < dist) { dist = d; meglio = k; } }
    if (meglio && dist <= 120) return meglio;
  }
  // parole comuni nei fogli turni
  const per = f => chiavi.find(k => f(shifts[k]));
  if (/^(m|mat|am|mattina|mattino|morning|1)$/.test(L) || /^matt/.test(L)) return per(x => x.s >= 240 && x.s < 600) || null;
  if (/^(p|pom|pm|pomeriggio|afternoon|2)$/.test(L) || /^pom/.test(L)) return per(x => x.s >= 600 && x.s < 1080) || null;
  if (/^(n|nt|not|notte|night|3)$/.test(L) || /^nott/.test(L)) return per(x => x.e > 1440 || x.s >= 1200) || null;
  if (/^(g|gi|giorno|diurno|d|12h)$/.test(L)) return per(x => x.s >= 360 && x.s < 600 && x.e - x.s >= 600) || null;
  // orari diversi da ogni turno: il più vicino per inizio, con gli orari veri.
  // Solo per qualcosa che dura come un turno: un'ora dal dentista non lo è.
  if (s != null && e != null && e - s >= 240) {
    let meglio = null, dist = Infinity;
    for (const k of chiavi) { const d = Math.abs(shifts[k].s - s); if (d < dist) { dist = d; meglio = k; } }
    if (meglio && dist <= 180) return meglio;
  }
  return null;
}

// Gruppi di etichette da confermare: «N» · 9 giorni → Notte.
export function gruppi(giorni, shifts) {
  const g = new Map();
  for (const x of giorni) {
    const chiave = pulisci(x.etichetta).toLowerCase() + (x.s != null ? "|" + x.s + "-" + x.e : "");
    if (!g.has(chiave)) g.set(chiave, { chiave, etichetta: pulisci(x.etichetta), s: x.s, e: x.e, n: 0 });
    g.get(chiave).n++;
  }
  return [...g.values()].sort((a, b) => b.n - a.n).map(x => Object.assign(x, { v: indovina(x.etichetta, x.s, x.e, shifts) }));
}
const chiaveDi = x => pulisci(x.etichetta).toLowerCase() + (x.s != null ? "|" + x.s + "-" + x.e : "");

// Da giorni + scelte ({chiave: valore}) alle modifiche da fare, una per data:
// prima il tipo di giornata (turno, riposo, ferie…), poi la reperibilità che
// si aggiunge. Lo stesso giorno con più voci: vince il turno.
export function piano(giorni, scelte, shifts) {
  const PESO = { R: 1, ferie: 3, malattia: 3, formazione: 2 };
  const out = {};
  for (const x of giorni) {
    const v = scelte[chiaveDi(x)]; if (!v) continue;
    const o = out[x.data] || (out[x.data] = { data: x.data });
    if (v === "reperibile") { o.rep = true; continue; }
    const peso = shifts[v] ? 4 : (PESO[v] || 0);
    if (o.peso != null && o.peso >= peso) continue;
    o.peso = peso; o.v = v; delete o.s; delete o.e;
    if (x.s != null && (v === "formazione" || (shifts[v] && (Math.abs(shifts[v].s - x.s) > 10 || Math.abs(shifts[v].e - x.e) > 10)))) { o.s = x.s; o.e = x.e; }
  }
  return Object.values(out).sort((a, b) => a.data < b.data ? -1 : 1).map(o => { delete o.peso; return o; });
}

/* ── Riconoscere un ciclo ───────────────────────────────────────────────── */
// Dai giorni importati (date e turno di ognuno) capisce se si ripetono: il
// foglio di un mese di un turnista a ciclo è lo stesso schema ripetuto, e in
// quel caso conviene continuarlo invece di chiedere un altro foglio. Prudente:
// serve una fila di giorni consecutivi, lunga almeno due giri interi, in cui
// ogni giorno uguale a quello di un periodo prima; ferie e simili la spezzano.
// Restituisce { periodo, pattern, inizio } o null.
export function rilevaCiclo(giorni, turni) {
  const giorno = k => Math.round(new Date(k + "T12:00:00").getTime() / 864e5);
  const ok = x => x && x.v && turni[x.v] && !x.s;
  const riposo = x => x && x.v === "R";
  const ordinati = (giorni || []).filter(x => x && x.data && (ok(x) || riposo(x))).sort((a, b) => a.data < b.data ? -1 : 1);
  // la fila consecutiva più lunga
  let best = [], cur = [];
  for (const x of ordinati) {
    if (cur.length && giorno(x.data) - giorno(cur[cur.length - 1].data) === 1) cur.push(x); else cur = [x];
    if (cur.length > best.length) best = cur;
  }
  const L = best.length, codice = best.map(x => x.v);
  for (let p = 2; p <= 28 && 2 * p <= L; p++) {
    let uguale = true;
    for (let i = p; i < L; i++) if (codice[i] !== codice[i % p]) { uguale = false; break; }
    if (!uguale) continue;
    const pat = codice.slice(0, p);
    if (new Set(pat).size < 2 || !pat.some(c => c !== "R")) continue;   // un solo valore non è un ciclo
    return { periodo: p, pattern: pat.join(""), inizio: best[0].data };
  }
  return null;
}
