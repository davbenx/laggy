// Test di regressione e unit test per:
// 1. Registrazioni rapide da widget e notifiche («Preso ✓» per caffeina, pasto, luce)
// 2. Finestra dei pasti facoltativa («mangia fra le X e le Y», senza promesse metaboliche)
// 3. Luce ed energia nell'orologio biologico (luce reale nel modello circadiano; voti di energia per tarare la vigilanza)
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildSchedule, TIPI, TIPI_TUTTI, TIPI_ESSENZIALI } from "../notifications.js";
import { createEngine } from "../engine.js";
import { alertness, calibraFaseEnergia } from "../alertness.js";

const iso = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const SH = { M: { n: "Mattino", s: 360, e: 840 }, P: { n: "Pomeriggio", s: 840, e: 1320 }, N: { n: "Notte", s: 1320, e: 1860 } };

test("notifiche pasti: catalogo e programmazione con toggle", () => {
  const tipoPasti = TIPI.find(t => t.k === "pasti");
  assert.ok(tipoPasti, "tipo pasti presente nel catalogo TIPI");
  assert.equal(tipoPasti.canale, "suggerimenti");
  assert.equal(tipoPasti.essenziale, false);

  const oggi = new Date();
  const cfg = { pattern: "MPNSR", anchor: iso(oggi), shifts: SH };

  // Con tutti i tipi accesi e piano pasti attivo (default): deve generare notifiche pasti
  const scheduleConPasti = buildSchedule(cfg, { days: 7, types: TIPI_TUTTI, piano: { pasti: true } });
  const notifichePasti = scheduleConPasti.filter(n => n.kind === "pasti");
  assert.ok(notifichePasti.length > 0, "genera notifiche per la finestra dei pasti");
  assert.ok(notifichePasti.some(n => /Mangia fra le/.test(n.body) || /Finestra dei pasti/.test(n.title)));

  // Con piano pasti spento: nessuna notifica pasti
  const scheduleSenzaPasti = buildSchedule(cfg, { days: 7, types: TIPI_TUTTI, piano: { pasti: false } });
  const nessunPasto = scheduleSenzaPasti.filter(n => n.kind === "pasti");
  assert.equal(nessunPasto.length, 0, "nessuna notifica pasti quando disattivata nel piano");
});

test("azioni rapide notifiche in sw.js e platform.js", () => {
  const swCode = fs.readFileSync(path.resolve("sw.js"), "utf-8");
  assert.ok(swCode.includes('action: "preso"'), "sw.js contiene l'azione rapida 'preso'");
  assert.ok(swCode.includes('title: "Preso ✓"'), "sw.js contiene il titolo 'Preso ✓'");
  assert.ok(swCode.includes('"preso:"'), "sw.js gestisce il tap di preso rimandando con preso:<kind>");

  const platCode = fs.readFileSync(path.resolve("platform.js"), "utf-8");
  assert.ok(platCode.includes('coffee: "quick_preso"'), "platform.js associa quick_preso a coffee");
  assert.ok(platCode.includes('luce: "quick_preso"'), "platform.js associa quick_preso a luce");
  assert.ok(platCode.includes('pasti: "quick_preso"'), "platform.js associa quick_preso a pasti");
  assert.ok(platCode.includes('id: "quick_preso"'), "platform.js registra actionType quick_preso");
});

test("modello circadiano: esposizione a luce reale sposta la fase circadiana", () => {
  const anchor = "2026-11-02";
  const focus = "2026-11-08T12:00:00";

  // Senza attività registrate: baseline
  const engBase = createEngine({ pattern: "NNNNNSR", anchor, shifts: SH, repeat: true, focus });
  const pBase = engBase.plan();
  const cbtBase = pBase.cbt;

  // Con luce forte registrata al risveglio nei giorni precedenti (es. 16:30 - 17:30 dopo sonno diurno)
  const attivita = {};
  for (let g = 3; g <= 7; g++) {
    const k = "2026-11-" + String(g).padStart(2, "0");
    attivita[k] = [{ t: "luce", fine: "17:30", min: 60 }];
  }

  const engLuce = createEngine({ pattern: "NNNNNSR", anchor, shifts: SH, repeat: true, focus, attivita });
  const pLuce = engLuce.plan();
  const cbtLuce = pLuce.cbt;

  // La luce reale modifica l'integrazione differenziale circadiana (Hannay / Forger)
  assert.notEqual(cbtBase, cbtLuce, "la presenza di luce reale registrata deve modulare la fase stimata cbt");

  // Verifica che datiSonno conteggi i giorni di luce
  const dati = engLuce.datiSonno();
  assert.ok(dati.luce >= 5, "conteggia i giorni con esposizione a luce registrata");

  // Stima orologio nel piano riporta i giorni di luce
  assert.ok(pLuce.orologio.giorniLuce >= 5, "stima orologio indica giorniLuce");
});

test("alertness: calibraFaseEnergia con pochi voti vs con voti sufficienti", () => {
  // Con meno di 6 voti: nessun offset applicato
  const pochiVoti = [
    { voto: 4, at: new Date("2026-11-05T09:00:00").getTime() },
    { voto: 3, at: new Date("2026-11-06T09:30:00").getTime() }
  ];
  const calPochi = calibraFaseEnergia(pochiVoti, { freeWake: "07:30", nadir: 330 });
  assert.equal(calPochi.solido, false);
  assert.equal(calPochi.faseOffset, 0);

  // Con 7 voti concordi con un risveglio più tardivo
  const moltiVoti = [
    { voto: 1, at: new Date("2026-11-01T08:00:00").getTime() },
    { voto: 1, at: new Date("2026-11-02T08:15:00").getTime() },
    { voto: 2, at: new Date("2026-11-03T08:30:00").getTime() },
    { voto: 4, at: new Date("2026-11-04T12:00:00").getTime() },
    { voto: 5, at: new Date("2026-11-05T12:30:00").getTime() },
    { voto: 5, at: new Date("2026-11-06T13:00:00").getTime() },
    { voto: 4, at: new Date("2026-11-07T12:00:00").getTime() }
  ];
  const calMolti = calibraFaseEnergia(moltiVoti, { freeWake: "07:30", nadir: 330 });
  assert.equal(calMolti.solido, true);
  assert.ok(calMolti.faseOffset >= -45 && calMolti.faseOffset <= 45, "faseOffset vincolato a +/- 45 min");

  // Applicando faseOffset alla funzione alertness
  const d = (h, m = 0) => new Date(2026, 10, 8, h, m);
  const base = { now: d(12), freeWake: "07:30", freeBed: "23:30", lastSleepEnd: d(7), nextSleepStart: d(23), nadir: 330 };
  const alertBase = alertness({ ...base, faseOffset: 0 });
  const alertShift = alertness({ ...base, faseOffset: 30 });
  assert.notEqual(alertBase.now.value, alertShift.now.value, "lo scostamento di fase calibra il livello di vigilanza percepita");
});
