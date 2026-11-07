// Test del modulo indennita.js — Calcolo ore, indennità e verifica riposi di legge (D.Lgs 66/2003)
import { test } from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "../engine.js";
import {
  festivoNazionale,
  defaultFestivo,
  formatEuro,
  analizzaCartellinoMese,
  calcolaStimaIndennita,
  verificaRiposiLegge,
  testoRiepilogoIndennita,
  PRESET_CCNL_INDENNITA
} from "../indennita.js";

test("festività nazionali e domeniche", () => {
  assert.equal(festivoNazionale(new Date(2026, 0, 1)), true); // Capodanno
  assert.equal(festivoNazionale(new Date(2026, 3, 25)), true); // 25 aprile
  assert.equal(festivoNazionale(new Date(2026, 4, 1)), true); // 1 maggio
  assert.equal(festivoNazionale(new Date(2026, 5, 2)), true); // 2 giugno
  assert.equal(festivoNazionale(new Date(2026, 7, 15)), true); // Ferragosto
  assert.equal(festivoNazionale(new Date(2026, 11, 25)), true); // Natale
  assert.equal(festivoNazionale(new Date(2026, 9, 4)), true); // San Francesco 2026
  assert.equal(festivoNazionale(new Date(2026, 3, 6)), true); // Pasquetta 2026

  // Giorno normale
  assert.equal(festivoNazionale(new Date(2026, 9, 5)), false);

  // defaultFestivo include anche la domenica
  const domenica = new Date(2026, 9, 11); // 11 ottobre 2026 è domenica
  assert.equal(domenica.getDay(), 0);
  assert.equal(defaultFestivo(domenica), true);
});

test("formatEuro formatta correttamente valuta italiana", () => {
  assert.ok(formatEuro(12.5).includes("12,50"));
  assert.ok(formatEuro(12.5).includes("€"));
  assert.equal(formatEuro(null), "—");
});

test("analizzaCartellinoMese calcola ore totali e notturne su ciclo MPNSR", () => {
  // Configurazione classica in quinta: Mattino 7-14 (420-840), Pomeriggio 14-21 (840-1260), Notte 21-07 (1260-1860), Smonto, Riposo
  const engine = createEngine({
    pattern: "MPNSR",
    anchor: "2026-10-01",
    focus: "2026-10-15T12:00:00",
    shifts: {
      M: { n: "Mattino", s: 420, e: 840 },
      P: { n: "Pomeriggio", s: 840, e: 1260 },
      N: { n: "Notte", s: 1260, e: 1860 }
    }
  });

  const cartellino = analizzaCartellinoMese(engine, 0);

  const giorniAttesi = new Date(cartellino.primo.getFullYear(), cartellino.primo.getMonth() + 1, 0).getDate();
  assert.equal(cartellino.giorniNelMese, giorniAttesi);
  assert.ok(cartellino.turniTotali > 0);
  assert.ok(cartellino.oreTotali > 0);
  assert.ok(cartellino.nottiTotali > 0);
  assert.ok(cartellino.oreNotturne > 0);
  // In N (21:00-07:00), le ore tra 22:00 e 06:00 sono esattamente 8 ore per ogni notte
  assert.equal(cartellino.oreNotturne, cartellino.nottiTotali * 8);
  assert.ok(cartellino.turniTotali + cartellino.liberiTotali === giorniAttesi);
});

test("analizzaCartellinoMese rileva ore notturne parziali", () => {
  // Turno serale 17:00 - 23:00 (1020-1380): 1 ora notturna tra 22:00 e 23:00
  const engine = createEngine({
    pattern: "SR",
    anchor: "2026-10-01",
    focus: "2026-10-15T12:00:00",
    shifts: {
      S: { n: "Sera", s: 1020, e: 1380 }
    }
  });

  const cartellino = analizzaCartellinoMese(engine, 0);
  assert.ok(cartellino.turniTotali > 0);
  // Ogni turno da 6 ore ha 1 ora notturna
  assert.equal(cartellino.oreNotturne, cartellino.turniTotali * 1);
  assert.equal(cartellino.oreTotali, cartellino.turniTotali * 6);
  // Con solo 1 ora notturna (< 3h), non è classificato come turno notte
  assert.equal(cartellino.nottiTotali, 0);
});

test("calcolaStimaIndennita con quote orarie fisse (Sanità Pubblica)", () => {
  const fintoCartellino = {
    oreTotali: 150,
    turniTotali: 20,
    nottiTotali: 5,
    festiviTotali: 3,
    liberiTotali: 11,
    oreNotturne: 40,
    oreDiurneFeriali: 94,
    oreDiurneFestive: 16,
    oreNotturneFestive: 0,
    oreNotturneFeriali: 40,
    turniFestiviDiurni: 2,
    turniFestiviNotturni: 0,
    turniFerialiNotturni: 5,
    turniFerialiDiurni: 13,
    straordinarioMinuti: 120
  };

  const stima = calcolaStimaIndennita(fintoCartellino, {
    notteVal: 4.40,
    notteTipo: "ora",
    festivoVal: 17.41,
    festivoTipo: "turno",
    straordVal: 20,
    straordTipo: "ora"
  });

  assert.equal(stima.haTariffe, true);
  // Notte: 40 ore * 4.40 = 176.00 €
  // Festivo: 3 turni festivi * 17.41 = 52.23 €
  // Straordinario: 2 ore * 20 = 40.00 €
  // Totale: 176 + 52.23 + 40 = 268.23 €
  assert.equal(stima.totaleEuro, 268.23);
  assert.equal(stima.voci.length, 3);
});

test("calcolaStimaIndennita con percentuale su paga base oraria (Metalmeccanico)", () => {
  const fintoCartellino = {
    oreTotali: 160,
    turniTotali: 20,
    nottiTotali: 4,
    festiviTotali: 2,
    liberiTotali: 10,
    oreNotturne: 32,
    oreDiurneFeriali: 112,
    oreDiurneFestive: 16,
    oreNotturneFestive: 0,
    oreNotturneFeriali: 32,
    turniFestiviDiurni: 2,
    turniFestiviNotturni: 0,
    turniFerialiNotturni: 4,
    turniFerialiDiurni: 14,
    straordinarioMinuti: 0
  };

  const stima = calcolaStimaIndennita(fintoCartellino, {
    pagaBase: 12.00,
    notteVal: 20, // 20% su 12.00 = +2.40 €/h
    notteTipo: "perc",
    festivoVal: 50, // 50% su 12.00 = +6.00 €/h
    festivoTipo: "perc"
  });

  assert.equal(stima.haTariffe, true);
  // Notte: 32h * 2.40 € = 76.80 €
  // Festivo: 16h * 6.00 € = 96.00 €
  // Totale: 172.80 €
  assert.equal(stima.totaleEuro, 172.80);
});

test("verificaRiposiLegge: rileva violazione Art. 7 (<11h tra turni consecutivi)", () => {
  // Pomeriggio 14-22 (840-1320) seguito da Mattino 06-14 (360-840):
  // Stacco = (360 + 1440) - 1320 = 480 min = 8 ore (< 11 ore!)
  const engine = createEngine({
    pattern: "PMR",
    anchor: "2026-10-01",
    focus: "2026-10-15T12:00:00",
    shifts: {
      P: { n: "Pomeriggio", s: 840, e: 1320 },
      M: { n: "Mattino", s: 360, e: 840 }
    }
  });

  const riposi = verificaRiposiLegge(engine, 0);

  assert.equal(riposi.riposoGiornalieroOk, false);
  assert.ok(riposi.violazioniGiornaliere.length > 0);
  const primaViolazione = riposi.violazioniGiornaliere[0];
  assert.equal(primaViolazione.oreEffettive, 8);
  assert.equal(primaViolazione.oreMinime, 11);
  assert.equal(primaViolazione.mancanti, 3);
});

test("verificaRiposiLegge: conforme quando tutti i turni hanno almeno 11 ore di riposo", () => {
  // Mattino 07-15 (420-900) seguito da Pomeriggio 15-23 (900-1380):
  // Stacco tra M ed P: (900 + 1440) - 900 = 1440 min = 24 ore!
  // Tra P ed R: riposo.
  const engine = createEngine({
    pattern: "MPR",
    anchor: "2026-10-01",
    focus: "2026-10-15T12:00:00",
    shifts: {
      M: { n: "Mattino", s: 420, e: 900 },
      P: { n: "Pomeriggio", s: 900, e: 1380 }
    }
  });

  const riposi = verificaRiposiLegge(engine, 0);
  assert.equal(riposi.riposoGiornalieroOk, true);
  assert.equal(riposi.violazioniGiornaliere.length, 0);
});

test("verificaRiposiLegge: rileva violazione Art. 9 (>6 giorni consecutivi di lavoro)", () => {
  // 8 giorni di mattina consecutivi seguiti da 1 riposo
  const engine = createEngine({
    pattern: "MMMMMMMMR",
    anchor: "2026-10-01",
    focus: "2026-10-15T12:00:00",
    shifts: {
      M: { n: "Mattino", s: 420, e: 840 }
    }
  });

  const riposi = verificaRiposiLegge(engine, 0);
  assert.equal(riposi.riposoSettimanaleOk, false);
  assert.ok(riposi.violazioniSettimanali.length > 0);
  assert.ok(riposi.violazioniSettimanali[0].giorniConsecutivi >= 7);
});

test("testoRiepilogoIndennita genera un report formattato e coerente", () => {
  const fintoCartellino = {
    oreTotali: 152,
    turniTotali: 21,
    nottiTotali: 4,
    festiviTotali: 3,
    liberiTotali: 10,
    oreNotturne: 32,
    straordinarioMinuti: 90
  };
  const fintaStima = {
    haTariffe: true,
    totaleEuro: 185.50,
    voci: [
      { titolo: "Indennità notturna", quantita: "32 h", tariffa: "20%", subtotale: 76.80 },
      { titolo: "Indennità festiva", quantita: "16 h", tariffa: "30%", subtotale: 57.60 },
      { titolo: "Straordinario", quantita: "1.5 h", tariffa: "+15%", subtotale: 51.10 }
    ]
  };
  const fintiRiposi = {
    riposoGiornalieroOk: false,
    violazioniGiornaliere: [
      {
        data: new Date(2026, 9, 14),
        turnoPrecedente: { nome: "Pomeriggio" },
        turnoAttuale: { nome: "Mattino" },
        oreEffettive: 8,
        mancanti: 3
      }
    ],
    riposoSettimanaleOk: true,
    violazioniSettimanali: []
  };

  const testo = testoRiepilogoIndennita(fintoCartellino, fintaStima, fintiRiposi, "Ottobre 2026");
  assert.ok(testo.includes("Verifica Turni e Indennità — Ottobre 2026"));
  assert.ok(testo.includes("152 h"));
  assert.ok(testo.includes("185,50"));
  assert.ok(testo.includes("D.Lgs. 66/2003"));
  assert.ok(testo.includes("rientro/i rapido/i"));
  assert.ok(testo.includes("solo 8h di riposo"));
});

test("preset contrattuali contengono le configurazioni previste", () => {
  assert.ok(PRESET_CCNL_INDENNITA.sanita);
  assert.equal(PRESET_CCNL_INDENNITA.sanita.notteTipo, "ora");
  assert.equal(PRESET_CCNL_INDENNITA.sanita.notteVal, 4.40);

  assert.ok(PRESET_CCNL_INDENNITA.metalmeccanico);
  assert.equal(PRESET_CCNL_INDENNITA.metalmeccanico.notteTipo, "perc");
  assert.equal(PRESET_CCNL_INDENNITA.metalmeccanico.notteVal, 20);

  assert.ok(PRESET_CCNL_INDENNITA.commercio);
  assert.ok(PRESET_CCNL_INDENNITA.vigilanza);
  assert.ok(PRESET_CCNL_INDENNITA.trasporti);
  assert.ok(PRESET_CCNL_INDENNITA.personalizzato);
});
