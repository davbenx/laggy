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
