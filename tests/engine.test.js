// Test del motore (engine.js), via node:test — nessuna libreria, nessun build
// step, nessun package.json: `node --test tests/*.test.js` basta così com'è
// (Node riconosce da solo la sintassi ESM di engine.js).
//
// Obiettivo di questa prima passata: invarianti strutturali che proteggono da
// regressioni ovvie (crash, orari fuori range, eventi invertiti) su un buon
// campione di pattern di turno reali — NON una copertura esaustiva del
// modello di sonno/allerta, che richiede competenza di dominio sul motore
// che va oltre quello che si può validare da fuori in una prima passata.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createEngine, buildFeed, buildCoupleFeed, DEFAULTS } from "../engine.js";

// Pattern di cicli comuni nel lavoro a turni italiano: N=notte, M=mattino,
// P=pomeriggio, R=riposo (qualunque lettera fuori dalla mappa "shifts" è
// trattata dal motore come giorno libero).
const CICLI = {
  "2 notti / 2 riposi": "NNRR",
  "3 notti / 2 riposi": "NNNRR",
  "3 notti / 3 riposi": "NNNRRR",
  "4 notti / 2 riposi": "NNNNRR",
  "4 notti / 4 riposi": "NNNNRRRR",
  "5 notti / 2 riposi": "NNNNNRR",
  "pattern di default (MPNSR)": DEFAULTS.pattern
};

function parseIcsEvents(ics) {
  // Estrae le coppie DTSTART/DTEND di ogni VEVENT — bastano per verificare
  // che il motore non stia emettendo date non valide o eventi invertiti.
  const events = [];
  const blocks = ics.split("BEGIN:VEVENT").slice(1);
  for (const b of blocks) {
    const start = /DTSTART:(\d{8}T\d{6})/.exec(b);
    const end = /DTEND:(\d{8}T\d{6})/.exec(b);
    const summary = /SUMMARY:(.*)/.exec(b);
    if (start && end) events.push({ start: start[1], end: end[1], summary: summary && summary[1] });
  }
  return events;
}

function toDate(icsStamp) {
  // "YYYYMMDDTHHMMSS" locale (floating time, senza Z) → Date locale, solo per
  // confrontare due timestamp dello stesso formato fra loro nei test.
  const y = +icsStamp.slice(0, 4), mo = +icsStamp.slice(4, 6) - 1, d = +icsStamp.slice(6, 8);
  const h = +icsStamp.slice(9, 11), mi = +icsStamp.slice(11, 13), s = +icsStamp.slice(13, 15);
  return new Date(y, mo, d, h, mi, s);
}

for (const [label, pattern] of Object.entries(CICLI)) {
  test(`buildFeed non va in crash e produce ICS valido — ${label}`, () => {
    const ics = buildFeed({ pattern, anchor: "2026-07-13" }, { days: 21 });
    assert.match(ics, /^BEGIN:VCALENDAR/);
    assert.match(ics.trim(), /END:VCALENDAR$/);

    const events = parseIcsEvents(ics);
    assert.ok(events.length > 0, "il piano dovrebbe generare almeno un evento in 21 giorni");

    for (const ev of events) {
      assert.match(ev.start, /^\d{8}T\d{6}$/, `DTSTART malformato: ${ev.start} (${ev.summary})`);
      assert.match(ev.end, /^\d{8}T\d{6}$/, `DTEND malformato: ${ev.end} (${ev.summary})`);
      assert.ok(toDate(ev.end) >= toDate(ev.start), `evento con fine prima dell'inizio: ${ev.summary} ${ev.start}→${ev.end}`);
    }
  });
}

// La sveglia via calendario (VALARM alla fine dell'evento Sonno, non un
// preavviso) è la parte più affidabile di tutto il sistema di promemoria —
// niente service worker, niente timer che può perdersi: nato dall'audit
// generale sulle notifiche (il meccanismo interno via SW non garantisce la
// consegna ad app chiusa). Verifica solo che ci sia davvero, non il modello.
test("buildFeed mette un VALARM di sveglia (RELATED=END) sull'evento Sonno", () => {
  const ics = buildFeed({ pattern: "NNNRR", anchor: "2026-07-13" }, { days: 7, ics: { avviso: 30 } });
  const sonno = ics.split("BEGIN:VEVENT").slice(1).find(b => /UID:nt-.*-sonno@/.test(b));
  assert.ok(sonno, "nessun evento Sonno trovato");
  assert.match(sonno, /TRIGGER;RELATED=END:PT0M/, "manca il VALARM di sveglia alla fine del sonno");
  assert.equal((sonno.match(/BEGIN:VALARM/g) || []).length, 2, "attesi due VALARM: preavviso + sveglia");
});

test("buildFeed non mette nessun VALARM se l'utente ha scelto \"nessun promemoria\" (avviso:0)", () => {
  const ics = buildFeed({ pattern: "NNNRR", anchor: "2026-07-13" }, { days: 7, ics: { avviso: 0 } });
  const sonno = ics.split("BEGIN:VEVENT").slice(1).find(b => /UID:nt-.*-sonno@/.test(b));
  assert.ok(sonno, "nessun evento Sonno trovato");
  assert.doesNotMatch(sonno, /BEGIN:VALARM/, "la sveglia non deve ignorare la scelta esplicita \"nessun promemoria\"");
});

// RFC 5545 §3.1: una riga di contenuto non dovrebbe superare i 75 ottetti —
// le DESCRIPTION in italiano di questo motore ci arrivano spesso (parole
// accentate = 2 ottetti ciascuna in UTF-8). Trovato con la configurazione
// reale di un utente: parser rigorosi possono scartare l'intero file per
// una riga fuori norma, non solo quella riga.
test("buildFeed piega ogni riga di contenuto a 75 ottetti (RFC 5545)", () => {
  const ics = buildFeed({
    pattern: "MMMMPPPPNNNNRRRR", anchor: "2026-09-07",
    shifts: { M: { n: "Mattino", s: 360, e: 840 }, P: { n: "Pomeriggio", s: 840, e: 1320 }, N: { n: "Notte", s: 1320, e: 1800 } },
    freeWake: "09:15", freeBed: "00:30", caffSens: "alta", need: 525
  }, { days: 28 });
  const oltre = ics.split("\r\n").filter(l => Buffer.byteLength(l, "utf8") > 75);
  assert.deepEqual(oltre, [], "righe non piegate entro 75 ottetti: " + JSON.stringify(oltre.slice(0, 3)));
});

test("createEngine: il piano del giorno corrente ha una finestra di sonno con durata positiva", () => {
  const e = createEngine({ pattern: "NNNRR", anchor: "2026-07-13", focus: "2026-07-15" });
  const p = e.plan();
  assert.ok(isFinite(p.s.onset), "onset del sonno non finito");
  assert.ok(p.s.dur > 0, "durata del sonno pianificato deve essere positiva");
  assert.ok(isFinite(p.cut), "orario di ultimo caffè non finito");
});

// ── Cambio ora legale (Italia, 2026): l'ultima domenica di marzo (29/03,
// 02:00→03:00, -1h di notte) e l'ultima domenica di ottobre (25/10,
// 03:00→02:00, +1h di notte). Il motore lavora per minuti-orologio "piatti"
// (mod1440), non per istanti assoluti: un turno che attraversa una di queste
// due notti ha una durata REALE diversa di ±60 minuti da quella che leggi
// sull'orologio, cosa che qui NON viene corretta (vedi audit — impatto raro,
// 2 notti/anno, non affrontato in questa passata). Questo test non verifica
// che il valore sia "fisiologicamente corretto": fissa il comportamento
// ATTUALE come riferimento, così un cambio futuro del motore che tocca
// queste date si vede nel diff invece di passare inosservato.
test("buildFeed non va in crash attraversando il cambio ora legale (primavera 29/03/2026)", () => {
  const ics = buildFeed({ pattern: "NNNRR", anchor: "2026-03-26" }, { days: 7 });
  assert.match(ics, /^BEGIN:VCALENDAR/);
  const events = parseIcsEvents(ics);
  assert.ok(events.length > 0);
  for (const ev of events) assert.ok(toDate(ev.end) >= toDate(ev.start), `${ev.summary}: ${ev.start}→${ev.end}`);
});

test("buildFeed non va in crash attraversando il cambio ora legale (autunno 25/10/2026)", () => {
  const ics = buildFeed({ pattern: "NNNRR", anchor: "2026-10-22" }, { days: 7 });
  assert.match(ics, /^BEGIN:VCALENDAR/);
  const events = parseIcsEvents(ics);
  assert.ok(events.length > 0);
  for (const ev of events) assert.ok(toDate(ev.end) >= toDate(ev.start), `${ev.summary}: ${ev.start}→${ev.end}`);
});

test("stessa configurazione + stessa data → stesso risultato (determinismo)", () => {
  const cfg = { pattern: "NNNRR", anchor: "2026-07-13" };
  const a = buildFeed(cfg, { days: 14 });
  const b = buildFeed(cfg, { days: 14 });
  // Lo stamp DTSTAMP dipende dall'istante di generazione (new Date()): lo
  // escludiamo dal confronto, il resto deve essere identico.
  const strip = s => s.replace(/DTSTAMP:\d{8}T\d{6}Z/g, "DTSTAMP:");
  assert.equal(strip(a), strip(b));
});

// ── Rami senza copertura finora: sonno bifasico, sonno diurno unico/con
// pisolino, pisolino in turno, calendario di coppia — trovati scoperti in
// un audit generale dell'app (proprio nel primo, sp.kind==="pre-turno-
// bifasico" nascondeva una divergenza reale fra questo file e la copia
// incollata in index.html: un pisolino di recupero mancante). Stesso
// livello dei test sopra: invarianti strutturali (non va in crash, ICS
// valido, eventi non invertiti), non validazione del modello fisiologico. ──

test("buildFeed non va in crash con sonno bifasico attivo (mattinoBifasico)", () => {
  // Turno di mattina molto presto (05:00): l'onset naturale del sonno prima
  // cade sotto la soglia (21:00) che fa scattare la scelta bifasica in
  // simulate() — è il ramo che aveva la divergenza fra engine.js e index.html.
  const cfg = {
    pattern: "MMMRR", anchor: "2026-07-13",
    shifts: { M: { n: "Mattino", s: 300, e: 720 } },
    mattinoBifasico: true
  };
  const ics = buildFeed(cfg, { days: 14 });
  assert.match(ics, /^BEGIN:VCALENDAR/);
  const events = parseIcsEvents(ics);
  assert.ok(events.length > 0);
  for (const ev of events) assert.ok(toDate(ev.end) >= toDate(ev.start), `${ev.summary}: ${ev.start}→${ev.end}`);
});

for (const sonnoDiurno of ["unico", "unicoPisolino", "diviso"]) {
  test(`buildFeed non va in crash con sonnoDiurno="${sonnoDiurno}"`, () => {
    const ics = buildFeed({ pattern: "NNNRR", anchor: "2026-07-13", sonnoDiurno }, { days: 14 });
    assert.match(ics, /^BEGIN:VCALENDAR/);
    const events = parseIcsEvents(ics);
    for (const ev of events) assert.ok(toDate(ev.end) >= toDate(ev.start), `${ev.summary}: ${ev.start}→${ev.end}`);
  });
}

for (const napTurno of ["pausa", "libero", "no"]) {
  test(`buildFeed non va in crash con napTurno="${napTurno}"`, () => {
    const ics = buildFeed({ pattern: "NNNRR", anchor: "2026-07-13", napTurno }, { days: 14 });
    assert.match(ics, /^BEGIN:VCALENDAR/);
    const events = parseIcsEvents(ics);
    for (const ev of events) assert.ok(toDate(ev.end) >= toDate(ev.start), `${ev.summary}: ${ev.start}→${ev.end}`);
  });
}

test("gli UID dei pisolini nell'ICS identificano il tipo, non la posizione nell'array", () => {
  // Prima l'UID era "pisolino"+indice nell'array naps: se l'insieme dei
  // pisolini di un giorno cambia forma tra due esportazioni (es. cambiando
  // napTurno), un vecchio "pisolino1" può riassegnarsi a un pisolino
  // semanticamente diverso invece di sparire/comparire pulito nel calendario
  // del telefono. Ogni tipo compare al più una volta per giorno (verificato
  // leggendo plan(): i rami sono a vicenda esclusivi o gated da
  // !naps.length), quindi il tipo da solo è già un identificatore stabile e
  // gli UID nello stesso feed devono essere tutti diversi.
  const ics = buildFeed({ pattern: "NNNRR", anchor: "2026-07-13", napTurno: "libero" }, { days: 14 });
  const uids = [...ics.matchAll(/UID:(nt-[^\r\n@]+)@/g)].map(m => m[1]);
  const pisoliniUids = uids.filter(u => u.includes("-pisolino-"));
  assert.ok(pisoliniUids.length > 0, "nessun pisolino generato: il test non verifica nulla");
  for (const u of pisoliniUids) assert.ok(!/-pisolino\d+$/.test(u), `UID ancora basato sulla posizione: ${u}`);
  assert.equal(new Set(uids).size, uids.length, "UID duplicati nello stesso feed");
});

test("asPartner: scambia temporaneamente pattern/orari e li ripristina sempre, anche se fn lancia", () => {
  const e = createEngine({
    pattern: "NNNRR", anchor: "2026-07-13", freeWake: "07:30", freeBed: "23:30",
    pPattern: "MMMRR", pAnchor: "2026-07-14", pWake: "06:00", pBed: "22:00"
  });
  const prima = { pattern: e.state.pattern, anchor: e.state.anchor, freeWake: e.state.freeWake, freeBed: e.state.freeBed };
  let vistoDaDentro = null;
  e.asPartner(() => { vistoDaDentro = { pattern: e.state.pattern, anchor: e.state.anchor, freeWake: e.state.freeWake }; });
  assert.deepEqual(vistoDaDentro, { pattern: "MMMRR", anchor: "2026-07-14", freeWake: "06:00" },
    "dentro asPartner lo state deve riflettere il partner, non l'utente");
  assert.deepEqual({ pattern: e.state.pattern, anchor: e.state.anchor, freeWake: e.state.freeWake, freeBed: e.state.freeBed }, prima,
    "asPartner deve ripristinare lo state dell'utente dopo");
  // fn che lancia: il ripristino deve avvenire comunque (asPartner ha un try/catch interno)
  e.asPartner(() => { throw new Error("boom"); });
  assert.deepEqual({ pattern: e.state.pattern, anchor: e.state.anchor, freeWake: e.state.freeWake, freeBed: e.state.freeBed }, prima,
    "asPartner deve ripristinare lo state anche se fn lancia un'eccezione");
});

test("asPartner/sharedDays/freeOverlap restituiscono null senza un partner configurato", () => {
  const e = createEngine({ pattern: "NNNRR", anchor: "2026-07-13" });
  assert.equal(e.asPartner(() => "qualunque cosa"), null);
  assert.equal(e.sharedDays(5), null);
  assert.equal(e.freeOverlap(0), null);
});

test("sharedDays: con orari di sonno completamente incompatibili, nessun giorno conta come \"in comune\" anche se i turni coincidono", () => {
  // Stesso pattern, stesso ancoraggio → stessi giorni di riposo per entrambi,
  // ma orari di sonno all'opposto (uno dorme di notte, l'altro all'alba
  // seguente) — prima di una correzione fatta in questa sessione, "in
  // comune" significava solo "riposo dal turno per entrambi": con questi
  // orari sfasati due riposi possono non avere nessuna ora vera in cui
  // sono svegli insieme. Verifica che la soglia di sovrapposizione reale
  // (≥3 ore) sia ancora rispettata.
  const e = createEngine({
    pattern: "RRRR", anchor: "2026-07-13", freeWake: "07:00", freeBed: "23:00",
    pPattern: "RRRR", pAnchor: "2026-07-13", pWake: "23:00", pBed: "07:00"
  });
  const giorni = e.sharedDays(10);
  assert.ok(Array.isArray(giorni));
  // Non deve semplicemente restituire "tutti i giorni di riposo in comune":
  // la sovrapposizione va verificata via freeOverlap per ogni giorno incluso.
  for (const g of giorni) {
    const overlap = e.freeOverlap(g.off);
    assert.ok(overlap === null || overlap >= 180, `giorno incluso in sharedDays con overlap insufficiente: off=${g.off} overlap=${overlap}`);
  }
});

test("freeOverlap: con orari di sonno identici (stesso pattern, stessi orari), la sovrapposizione libera è ampia", () => {
  const e = createEngine({
    pattern: "RRRR", anchor: "2026-07-13", freeWake: "07:00", freeBed: "23:00",
    pPattern: "RRRR", pAnchor: "2026-07-13", pWake: "07:00", pBed: "23:00"
  });
  const overlap = e.freeOverlap(0);
  assert.ok(overlap !== null && overlap > 600, `atteso ampio tempo libero condiviso con orari identici, trovato: ${overlap}`);
});

test("buildCoupleFeed non va in crash con un partner configurato e produce ICS valido", () => {
  const cfg = {
    pattern: "NNNRR", anchor: "2026-07-13",
    pPattern: "NNNRR", pAnchor: "2026-07-15"   // sfasato di due giorni: qualche riposo in comune, non tutti
  };
  const ics = buildCoupleFeed(cfg, { days: 30 });
  assert.match(ics, /^BEGIN:VCALENDAR/);
  assert.match(ics.trim(), /END:VCALENDAR$/);
  // Eventi tutto-il-giorno (DATE, non DATE-TIME): stesso parser non basta,
  // verifichiamo solo che ogni DTSTART;VALUE=DATE preceda o coincida col
  // DTEND;VALUE=DATE associato.
  const blocks = ics.split("BEGIN:VEVENT").slice(1);
  for (const b of blocks) {
    const s = /DTSTART;VALUE=DATE:(\d{8})/.exec(b), e = /DTEND;VALUE=DATE:(\d{8})/.exec(b);
    assert.ok(s && e, "evento coppia senza DTSTART/DTEND a tutto il giorno");
    assert.ok(+e[1] >= +s[1], `evento coppia con fine prima dell'inizio: ${s[1]}→${e[1]}`);
  }
});

test("buildCoupleFeed rifiuta esplicitamente una config senza partner", () => {
  assert.throws(() => buildCoupleFeed({ pattern: "NNNRR", anchor: "2026-07-13" }, { days: 30 }));
});

// index.html tiene una seconda copia di alcune utility pure di engine.js
// (deliberatamente: sono generiche/stabili, mai state la sede di un bug
// reale — unificarle vorrebbe dire toccare centinaia di punti di chiamata
// scorrelati). Ma questa stessa sessione ha già trovato due divergenze nate
// esattamente così tra le due copie di altra logica (LIMITI/normalizza,
// busyOf) — un rischio strutturale che nessun test teneva sotto controllo.
// Estrae il testo sorgente di ciascuna funzione da entrambi i file e lo
// confronta byte per byte: non prova che siano corrette, solo che non sono
// silenziosamente andate fuori sincrono.
function estraiFunzione(sorgente, nome) {
  const decl = new RegExp(`(?:^|\\n)(?:const ${nome} = |function ${nome}\\()`);
  const m = decl.exec(sorgente);
  if (!m) return null;
  const start = m.index + (m[0].startsWith("\n") ? 1 : 0);
  let i = start, depth = 0, started = false;
  for (; i < sorgente.length; i++) {
    const c = sorgente[i];
    if (c === "{" || c === "(") { depth++; started = true; }
    else if (c === "}" || c === ")") { depth--; if (started && depth === 0 && c === "}") { i++; break; } }
    else if (c === ";" && depth === 0 && started) { i++; break; }
    else if (c === ";" && depth === 0 && !started) { i++; break; } // const NAME = espressione-senza-parentesi;
  }
  return sorgente.slice(start, i).trim();
}

test("le utility pure duplicate tra engine.js e index.html restano identiche", () => {
  const engineSrc = readFileSync(fileURLToPath(new URL("../engine.js", import.meta.url)), "utf8");
  const htmlSrc = readFileSync(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8");
  const NOMI = ["iso", "day", "dnum", "mod1440", "safeName", "decShifts"];
  const divergenti = [];
  for (const nome of NOMI) {
    const a = estraiFunzione(engineSrc, nome), b = estraiFunzione(htmlSrc, nome);
    if (a === null || b === null) { divergenti.push(`${nome}: non trovata in ${a === null ? "engine.js" : "index.html"} — l'estrattore del test va aggiornato, non necessariamente il codice`); continue; }
    if (a !== b) divergenti.push(`${nome}:\n  engine.js:   ${a}\n  index.html:  ${b}`);
  }
  assert.deepEqual(divergenti, [], "utility duplicate divergenti tra engine.js e index.html:\n" + divergenti.join("\n\n"));
});

// buildEvents è la fonte unica: l'ICS deve esserne solo la serializzazione, e
// i Date (usati da calendario nativo e notifiche) devono coincidere con
// DTSTART/DTEND.
test("buildEvents: stessi eventi, stessi UID e stessi orari dell'ICS", () => {
  for (const pattern of Object.values(CICLI)) {
    const e = createEngine({ pattern, anchor: "2026-07-13", focus: "2026-10-20T09:00:00" });
    const events = e.buildEvents(21);
    const ics = e.buildIcs(21);
    const uids = [...ics.matchAll(/UID:(\S+)/g)].map(m => m[1]);
    assert.deepEqual(events.map(x => x.uid), uids);
    const parsed = parseIcsEvents(ics);
    events.forEach((ev, i) => {
      assert.equal(ev.start.getTime(), toDate(parsed[i].start).getTime(), `start ${ev.uid}`);
      assert.equal(ev.end.getTime(), toDate(parsed[i].end).getTime(), `end ${ev.uid}`);
      assert.ok(ev.end > ev.start, `evento invertito ${ev.uid}`);
    });
    assert.equal(e.state.focus.toISOString(), new Date("2026-10-20T09:00:00").toISOString(), "focus ripristinato");
  }
});

test("buildEvents: il sonno porta sveglia e preavviso, avviso:0 li toglie a tutti", () => {
  const e = createEngine({ pattern: "NNNRR", anchor: "2026-07-13" });
  const sonno = e.buildEvents(7).find(x => x.tipo === "sonno");
  assert.equal(sonno.avvisa, 30);
  assert.equal(sonno.sveglia, true);
  e.setIcs({ avviso: 0 });
  assert.ok(e.buildEvents(7).every(x => x.avvisa === 0 && x.sveglia === false));
});

test("buildCoupleEvents: eventi tutto-il-giorno coerenti con il feed di coppia", () => {
  const e = createEngine({ pattern: "NNRR", anchor: "2026-07-13", pPattern: "NNRR", pAnchor: "2026-07-13" });
  const events = e.buildCoupleEvents(30);
  const ics = e.buildCouple(30);
  assert.deepEqual(events.map(x => x.uid), [...ics.matchAll(/UID:(\S+)/g)].map(m => m[1]));
  for (const ev of events) {
    assert.equal(ev.allDay, true);
    assert.equal(ev.start.getHours(), 0);
    assert.equal(ev.end.getHours(), 0);
  }
});

// Le eccezioni (cambi turno, turni variabili) devono arrivare al calendario
// automatico e al link di backup: prima il feed mostrava il ciclo nudo.
import { encEcc, decEcc, parseConfig } from "../engine.js";
test("eccezioni: andata e ritorno, e il feed le rispetta", () => {
  const oggi = new Date(2026, 9, 15, 10);
  const ecc = { "2026-10-15": "N", "2026-10-16": "R", "2026-01-01": "M", "2026-10-17": "notte", "x": "N" };
  const s = encEcc(ecc, 60, oggi);
  assert.equal(s, "20261015N.20261016R", "solo date valide, recenti, con codice di una lettera");
  assert.deepEqual(decEcc(s), { "2026-10-15": "N", "2026-10-16": "R" });
  assert.deepEqual(decEcc("2026101N.abc.20261016notte"), {}, "voci malformate scartate");
  const cfg = parseConfig(new URLSearchParams("p=N&a=2026-10-15&rep=0&x=20261015N.20261016M&s=N:Notte:1260:1860|M:Mattino:420:840"));
  const ics = buildFeed({ ...cfg, focus: "2026-10-15T10:00:00" }, { days: 3 });
  const turni = [...ics.matchAll(/SUMMARY:(Turno [^\r]*)/g)].map(m => m[1]);
  assert.deepEqual(turni, ["Turno Notte", "Turno Mattino"]);
});

test("mai a letto durante il turno: il sonno principale comincia dopo il rientro a casa", () => {
  // Pomeriggio fino a sera seguito da mattino presto (il "rientro"): prima il
  // sonno si contava a ritroso dalla sveglia e finiva in pieno turno.
  const oggi = new Date(); oggi.setHours(12, 0, 0, 0);
  const casi = [
    [{ P: { n: "Pomeriggio", s: 840, e: 1260 }, Q: { n: "Presto", s: 360, e: 780 } }, "PQRRRRR"],
    [{ P: { n: "Pomeriggio", s: 840, e: 1320 }, M: { n: "Mattino", s: 360, e: 840 } }, "PMRRRRR"],
    [{ M: { n: "Mattino", s: 360, e: 840 }, P: { n: "Pomeriggio", s: 840, e: 1320 }, N: { n: "Notte", s: 1320, e: 1860 } }, "MPNSRPMMR"]
  ];
  for (const [shifts, pattern] of casi) for (const bif of [false, true]) {
    const e = createEngine({ pattern, anchor: oggi.toISOString().slice(0, 10), shifts, repeat: true, mattinoBifasico: bif, cFrom: 25, focus: oggi });
    for (let o = 0; o < pattern.length; o++) {
      const d = new Date(oggi); d.setDate(d.getDate() + o); e.state.focus = d;
      const P = e.plan();
      if (P.b.rest || P.night || P.lateStart) continue;
      assert.ok(P.s.onset >= P.b.end + 25, pattern + " giorno " + o + (bif ? " bifasico" : "") + ": a letto " + P.s.onset + " prima della fine turno " + P.b.end);
    }
  }
});

test("tutte le combinazioni di tre giorni: sonno e pisolini mai dentro un turno o il viaggio", () => {
  // Dieci forme di turno (alba, mattino, mattino tardi, giorno 12h, pomeriggio,
  // sera, sera tardi, notte, notte 12h, notte fonda da mezzanotte) più il riposo,
  // in ogni sequenza di tre giorni possibile (escluse quelle con meno di 2 ore
  // fra un turno e l'altro), con viaggi corti e lunghi e un cronotipo mattiniero.
  // I pisolini in pausa al lavoro (x.turno) sono voluti e non contano.
  const T = { A: { n: "Alba", s: 300, e: 780 }, M: { n: "Mattino", s: 360, e: 840 }, L: { n: "Mattino tardi", s: 480, e: 960 },
    D: { n: "Giorno 12h", s: 420, e: 1140 }, P: { n: "Pomeriggio", s: 840, e: 1320 }, S: { n: "Sera", s: 1080, e: 1440 },
    X: { n: "Sera tardi", s: 1140, e: 1500 }, N: { n: "Notte", s: 1320, e: 1860 }, K: { n: "Notte 12h", s: 1140, e: 1860 }, Z: { n: "Notte fonda", s: 0, e: 480 } };
  const codes = Object.keys(T).concat(["R"]);
  const oggi = new Date(); oggi.setHours(12, 0, 0, 0);
  const problemi = [];
  for (const V of [{ cTo: 25, cFrom: 25 }, { cTo: 60, cFrom: 60, freeBed: "22:00", freeWake: "04:00" }])
  for (const a of codes) for (const b of codes) for (const c of codes) {
    const seq = [a, b, c]; let ok = true;
    for (let i = 0; i < 2; i++) { const x = T[seq[i]], y = T[seq[i + 1]]; if (x && y && 1440 + y.s - x.e < 120) ok = false; }
    if (!ok) continue;
    const pat = a + b + c + "RRRR";
    const e = createEngine(Object.assign({ pattern: pat, anchor: oggi.toISOString().slice(0, 10), shifts: T, repeat: true, focus: oggi }, V));
    const occ = []; for (let o = -1; o < 5; o++) { const w = e.block(o); if (!w.rest) occ.push([o * 1440 + w.start - V.cTo, o * 1440 + w.end + V.cFrom]); }
    for (let o = 0; o < 3; o++) {
      const d = new Date(oggi); d.setDate(d.getDate() + o); e.state.focus = d;
      const P = e.plan();
      const items = [[P.s.onset, P.s.onset + P.s.dur]].concat((P.naps || []).filter(x => !x.turno).map(x => [x.a, x.b]));
      for (const [s0, z0] of items) { if (!(z0 > s0)) continue;
        if (occ.some(([da, al]) => o * 1440 + s0 < al - 1 && o * 1440 + z0 > da + 1)) problemi.push(pat + " giorno " + o + " " + s0 + "-" + z0); }
    }
  }
  assert.equal(problemi.length, 0, problemi.slice(0, 10).join(" | "));
});

// ── Debito di sonno: un solo conto (debito.js), sui giorni, rispetto al bisogno ──
import { debitoSonno } from "../debito.js";

test("debito: le notti corte si sommano, quelle lunghe ripagano solo in parte, mai sotto zero", () => {
  const d = (wakes, beds) => debitoSonno({ wakes, beds }, 480, "2026-10-30").min;
  assert.equal(d({ "2026-10-29": "06:00", "2026-10-30": "06:00" }, { "2026-10-29": "00:00", "2026-10-30": "00:00" }), 240, "due notti da 6 ore: 2+2 ore");
  assert.equal(d({ "2026-10-29": "06:00", "2026-10-30": "10:00" }, { "2026-10-29": "00:00", "2026-10-30": "00:00" }), 120 - 60, "10 ore dopo 6: 2 ore − metà delle 2 in più");
  assert.equal(d({ "2026-10-30": "12:00" }, { "2026-10-30": "00:00" }), 0, "12 ore da sole non vanno sotto zero");
  assert.equal(debitoSonno({ wakes: { "2026-10-01": "05:00" }, beds: { "2026-10-01": "00:00" } }, 480, "2026-10-30").min, 0, "una notte di 29 giorni fa è fuori finestra");
});

test("debito: un pisolino fatto ieri conta; quelli di oggi no (cambierebbero il piano che li propone)", () => {
  const diario = { wakes: { "2026-10-29": "06:00", "2026-10-30": "06:00" }, beds: { "2026-10-29": "00:00", "2026-10-30": "00:00" },
    pisolini: { "2026-10-29": { "15:00": { si: true, a: "15:00", b: "16:00" } }, "2026-10-30": { "15:00": { si: true, a: "15:00", b: "17:00" } } } };
  assert.equal(debitoSonno(diario, 480, "2026-10-30").min, 120 + 120 - 60, "ieri 6h+1h, oggi 6h; i 2h di oggi non contano");
});

test("piano: un sonno corto annotato dà un pisolino di recupero, uno lungo no; oltre 3 ore si allunga la notte libera", () => {
  const base = { pattern: "PRRMMRR", anchor: "2026-10-30", focus: "2026-10-30T11:00:00", freeBed: "00:30", freeWake: "08:30",
    shifts: { P: { n: "Pomeriggio", s: 840, e: 1260 }, M: { n: "Mattino", s: 420, e: 840 } } };
  const con = (bed, wake, prima = {}) => createEngine({ ...base, beds: { ...prima.beds, "2026-10-30": bed }, wakes: { ...prima.wakes, "2026-10-30": wake } }).plan();
  assert.equal(con("00:30", "10:30").naps.length, 0, "10 ore: niente recupero");
  assert.equal(con("02:30", "08:30").naps.filter(n => n.debito).length, 1, "6 ore su 8: recupero");
  const tre = { beds: { "2026-10-28": "02:30", "2026-10-29": "02:30" }, wakes: { "2026-10-28": "08:30", "2026-10-29": "08:30" } };
  const p = con("02:30", "08:30", tre);
  const normale = createEngine({ ...base }).plan().s.dur;
  assert.ok(p.s.dur > normale, "con 6 ore di debito la notte libera è più lunga: " + normale + " → " + p.s.dur);
  assert.equal(p.naps.filter(n => n.debito).length, 0, "e allora il pisolino di recupero non serve");
});

// ── Un'altra persona: il suo sonno è una stima dai suoi turni, mai dal MIO diario ──
test("partner in smonto: dopo la notte dorme il sonno pieno di giorno, non il «corto» consigliato a chi usa l'app", () => {
  const sh = { N: { n: "Notte", s: 1320, e: 1800 }, M: { n: "Mattino", s: 420, e: 840 } };
  const e = createEngine({ pattern: "RRRRRRRR", anchor: "2026-11-01", focus: "2026-11-01T12:00:00", shifts: sh, freeBed: "23:30", freeWake: "07:30",
    pPattern: "NNRR", pAnchor: "2026-10-30", pShifts: sh });
  const sonno = e.asPartner(() => { const P = e.plan(); return P.sp.dur; });
  assert.ok(sonno >= 360, "sonno dopo la notte di almeno 6 ore: " + sonno);
  assert.equal(e.state.need, 480, "il bisogno di chi guarda torna com'era");
  assert.ok(!e.state.stima, "la stima non resta accesa");
});

test("partner: il mio diario, il mio debito e il mio impegno non entrano nel suo piano", () => {
  const sh = { N: { n: "Notte", s: 1320, e: 1800 } };
  const cfg = { pattern: "RRRRRRRR", anchor: "2026-11-01", focus: "2026-11-01T12:00:00", shifts: sh, freeBed: "23:30", freeWake: "07:30", pPattern: "NNRR", pAnchor: "2026-10-30", pShifts: sh };
  const vuoto = createEngine(cfg);
  const mio = createEngine({ ...cfg, beds: { "2026-10-30": "03:00", "2026-10-31": "03:00", "2026-11-01": "03:00" }, wakes: { "2026-10-30": "07:00", "2026-10-31": "07:00", "2026-11-01": "07:00" } });
  const di = (e) => e.asPartner(() => { const P = e.plan(); return JSON.stringify([P.s.onset, P.s.dur, P.naps.map(n => [n.a, n.b])]); });
  assert.equal(di(mio), di(vuoto), "con un diario corto il piano di lei non cambia");
  assert.deepEqual(Object.keys(mio.state.wakes), ["2026-10-30", "2026-10-31", "2026-11-01"], "il mio diario è intatto dopo");
});

// ── Debito: chi segue il piano non ha debito; chi dorme sistematicamente meno sì ──
function debitoDopo(pattern, fb, fw, dormiMeno) {
  const sh = { M: { n: "Mattino", s: 420, e: 840 }, P: { n: "Pomeriggio", s: 840, e: 1260 }, N: { n: "Notte", s: 1320, e: 1800 } };
  const hhmm = m => { m = ((Math.round(m) % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); };
  const base = new Date("2026-10-01T12:00:00"), beds = {}, wakes = {}, cfg = { pattern, anchor: "2026-10-01", shifts: sh, freeBed: fb, freeWake: fw };
  for (let i = 1; i <= 14; i++) {
    const d = new Date(base); d.setDate(d.getDate() + i);
    const P = createEngine({ ...cfg, focus: d }).plan(), k = d.toISOString().slice(0, 10);
    beds[k] = hhmm(P.sp.onset); wakes[k] = hhmm(P.sp.onset + P.sp.dur - dormiMeno);
  }
  const f = new Date(base); f.setDate(f.getDate() + 14);
  return createEngine({ ...cfg, beds, wakes, focus: f }).plan().debitoMin;
}
for (const [pattern, fb, fw] of [["MPNSR", "00:30", "09:45"], ["MPNSR", "23:30", "07:30"], ["NNNRR", "23:30", "07:30"]]) {
  test(`debito ${pattern} ${fb}→${fw}: seguire il piano per 14 giorni non lascia debito, un'ora in meno ogni notte sì`, () => {
    assert.ok(debitoDopo(pattern, fb, fw, 0) <= 30, "segue il piano: " + debitoDopo(pattern, fb, fw, 0));
    assert.ok(debitoDopo(pattern, fb, fw, 60) >= 180, "un'ora in meno ogni notte: " + debitoDopo(pattern, fb, fw, 60));
  });
}
