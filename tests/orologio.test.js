// L'orologio del motore: il modello di Forger, Jewett & Kronauer (1999) sui tuoi giorni. Nei giorni regolari dice
// quello che diceva la regola (minimo 2 h prima della sveglia libera); con i turni si sposta come un orologio vero:
// poco nelle rotazioni rapide, un po' ogni notte nei blocchi lunghi. E la caffeina che dura diversamente in ognuno.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "../engine.js";
import { alertness } from "../alertness.js";

const SH = { M: { n: "Mattino", s: 360, e: 840 }, P: { n: "Pomeriggio", s: 840, e: 1320 }, N: { n: "Notte", s: 1320, e: 1800 } };
const motore = (pattern, giorno, extra) => createEngine({ pattern, anchor: "2026-11-02", shifts: SH, repeat: true, focus: giorno + "T12:00:00", freeBed: "23:30", freeWake: "07:30", ...extra });
const ora = m => ((Math.round(m) % 1440) + 1440) % 1440;

test("giorni liberi regolari: il modello sta sulla regola (minimo 2 h prima della sveglia libera)", () => {
  const P = motore("RRRRRRR", "2026-11-12").plan();
  assert.ok(Math.abs(ora(P.cbt) - 330) <= 20, "minimo alle " + ora(P.cbt) + " invece di 05:30 circa");
});

test("rotazione rapida M-P-N-S-R: nella notte il minimo resta verso l'alba, dentro il turno (non nel sonno di giorno)", () => {
  const P = motore("MPNSR", "2026-11-14").plan();   // 14/11: N
  assert.ok(P.night, "è una notte");
  const m = ora(P.cbt);
  assert.ok(m >= 4 * 60 && m <= 7 * 60 + 30, "minimo alle " + m + ", atteso fra le 04:00 e le 07:30");
  assert.ok(Math.abs(ora(P.cbtRegola) - m) > 180, "e la vecchia regola lo metteva ore più in là, nel sonno di giorno");
  assert.ok(P.cbt >= P.b.start && P.cbt <= P.b.end, "cade dentro il turno: il picco di sonnolenza da tenere d'occhio");
});

test("blocco di 5 notti: l'orologio si sposta un po' ogni notte, nella direzione della notte", () => {
  const ore = [9, 10, 11, 12].map(g => motore("NNNNNSR", "2026-11-" + String(g).padStart(2, "0")).plan().cbt);   // le prime quattro notti del secondo blocco
  for (let i = 1; i < ore.length; i++) assert.ok(ore[i] > ore[i - 1], "notte " + (i + 1) + ": " + ore.join(" "));
});

test("caffeina: i fattori facoltativi allungano o accorciano la soglia, sempre fra 4 e 12 ore", () => {
  const ore = f => motore("RRRRRRR", "2026-11-12", { caffSens: "media", caffFattori: f }).caffeinaOre();
  assert.equal(ore({}).min, 360);
  assert.equal(ore({ fumo: true }).min, 210 < 240 ? 240 : 210);   // 6 h × 0,6 = 3,6 h → il minimo di 4 h
  assert.equal(ore({ pillola: true }).min, 615);                    // 6 h × 1,7 = 10,2 h, al quarto d'ora
  const g = ore({ gravidanza: "fine" }); assert.equal(g.min, 720); assert.ok(g.oltre, "oltre le 12 h lo dice");
  assert.equal(ore({ gravidanza: "chissà" }).fattore, 1, "un valore rotto non cambia niente");
});

test("caffeina nelle notti: anche con una soglia lunga resta un caffè a inizio turno", () => {
  const P = motore("MPNSR", "2026-11-14", { caffFattori: { pillola: true } }).plan();
  assert.ok(P.caff.notte && P.cut === P.b.start + 60, "ultimo caffè " + P.cut + ", inizio turno " + P.b.start);
  const Q = motore("MPNSR", "2026-11-14").plan();
  assert.ok(Q.cut >= Q.b.start + 60 && Math.abs(Q.cut - (Q.s.onset - 480)) <= 10, "senza fattori la soglia resta quella di sempre (8 h prima del sonno): " + Q.cut);
});

test("alertness: con il minimo del motore il calo si sposta con lui", () => {
  const d = (h, m = 0) => new Date(2026, 10, 14, h, m);
  const base = { now: d(23), freeWake: "07:30", freeBed: "23:30", lastSleepEnd: d(14), nextSleepStart: new Date(2026, 10, 15, 10) };
  const a = alertness({ ...base, nadir: 330 }), b = alertness({ ...base, nadir: 450 });
  assert.equal(a.nadirMin, 330); assert.equal(b.nadirMin, 450);
  assert.equal(a.risk.hhmm, "05:30"); assert.equal(b.risk.hhmm, "07:30", "un minimo due ore più tardi porta il calo due ore più tardi");
});

test("il diario sposta l'orologio: chi dorme davvero più tardi del piano ha il minimo più tardi", () => {
  const beds = {}, wakes = {};
  for (let g = 3; g <= 11; g++) { const k = "2026-11-" + String(g).padStart(2, "0"); beds[k] = "02:30"; wakes[k] = "10:30"; }
  const senza = motore("RRRRRRR", "2026-11-12").plan().cbt, con = motore("RRRRRRR", "2026-11-12", { beds, wakes }).plan().cbt;
  // la luce del giorno (novembre) tiene in parte l'orologio: tre ore di sonno più tardi lo spostano di circa un'ora
  assert.ok(con - senza >= 45, "dieci giorni a letto alle 2:30 invece delle 23:30: il minimo si sposta più tardi (" + senza + " → " + con + ")");
  const strano = motore("RRRRRRR", "2026-11-12", { beds: { "2026-11-10": "14:00" }, wakes: { "2026-11-10": "15:00" } }).plan().cbt;
  assert.equal(strano, senza, "un sonno del diario che non combacia con nessun sonno del piano non viene inventato");
});

test("due modelli: Forger 1999 e Hannay 2019 insieme, con l'incertezza della stima", () => {
  const P = motore("MPNSR", "2026-11-14").plan();
  assert.equal(P.orologio.modelli.length, 2, "un minimo per modello");
  assert.ok(Math.abs(P.cbt - (P.orologio.modelli[0] + P.orologio.modelli[1]) / 2) <= 1, "il minimo usato è la media");
  assert.ok(P.orologio.incertezza >= 30 && P.orologio.incertezza <= 240, "incertezza ragionevole: " + P.orologio.incertezza);
  const R = motore("RRRRRRR", "2026-11-12").plan();
  assert.ok(Math.abs(R.orologio.modelli[0] - R.orologio.modelli[1]) <= 20, "nei giorni regolari i due modelli coincidono");
});
