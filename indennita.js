// indennita.js — Calcolo ore, indennità di turno e verifica riposi di legge (D.Lgs 66/2003).
// Modulo PURO, privo di DOM e testabile in Node.js e browser.

// Festività nazionali italiane (fisse + mobili come Pasquetta e San Francesco d'Assisi dal 2026).
export function festivoNazionale(d) {
  const m = d.getMonth() + 1, g = d.getDate();
  if (["1-1", "1-6", "4-25", "5-1", "6-2", "8-15", "11-1", "12-8", "12-25", "12-26"].includes(m + "-" + g)) return true;
  const y = d.getFullYear();
  if (m === 10 && g === 4 && y >= 2026) return true; // Legge 151/2025
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, dd = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
    gg = Math.floor((b - f + 1) / 3), h = (19 * a + b - dd - gg + 15) % 30, i = Math.floor(c / 4), k = c % 4,
    l = (32 + 2 * e + 2 * i - h - k) % 7, mm = Math.floor((a + 11 * h + 2 * l) / 451),
    mese = Math.floor((h + l - 7 * mm + 114) / 31), giorno = ((h + l - 7 * mm + 114) % 31) + 1;
  const pasquetta = new Date(y, mese - 1, giorno + 1);
  return m === pasquetta.getMonth() + 1 && g === pasquetta.getDate();
}

export function defaultFestivo(d) {
  return d.getDay() === 0 || festivoNazionale(d);
}

// Preset contrattuali indicativi (precompilabili con 1 tocco, personalizzabili dall'utente).
export const PRESET_CCNL_INDENNITA = {
  sanita: {
    nome: "Sanità Pubblica (Comparto)",
    desc: "Indennità oraria notturna fissa + festivo per turno intero",
    oreSettimana: 36,
    pagaBase: null, // non strettamente necessaria con quote fisse
    notteVal: 4.40,
    notteTipo: "ora", // € 4,40 per ogni ora notturna 22-06 (Art. 106 CCNL Sanità)
    festivoVal: 17.41,
    festivoTipo: "turno", // € 17,41 lordi a turno festivo di almeno 6 ore
    notteFestivaVal: null, // cumula notte oraria + festivo turno
    notteFestivaTipo: "auto",
    straordVal: 15,
    straordTipo: "perc"
  },
  metalmeccanico: {
    nome: "Metalmeccanico (CCNL Industria)",
    desc: "Maggiorazioni percentuali su paga oraria (turni 20%, festivo 50%)",
    oreSettimana: 40,
    pagaBase: 12.50,
    notteVal: 20, // 20% turno notturno a turni (25%-30% per notturno fisso o straordinario)
    notteTipo: "perc",
    festivoVal: 50, // 50% festivo diurno
    festivoTipo: "perc",
    notteFestivaVal: 55, // 55% notturno festivo
    notteFestivaTipo: "perc",
    straordVal: 20,
    straordTipo: "perc"
  },
  commercio: {
    nome: "Commercio e Terziario",
    desc: "Maggiorazioni percentuali (notturno 15%, festivo 30%)",
    oreSettimana: 40,
    pagaBase: 11.00,
    notteVal: 15,
    notteTipo: "perc",
    festivoVal: 30,
    festivoTipo: "perc",
    notteFestivaVal: 40,
    notteFestivaTipo: "perc",
    straordVal: 15,
    straordTipo: "perc"
  },
  vigilanza: {
    nome: "Vigilanza Privata e Fiduciari",
    desc: "Notturno a percentuale (25%) e indennità domenicale/festiva",
    oreSettimana: 40,
    pagaBase: 10.50,
    notteVal: 25,
    notteTipo: "perc",
    festivoVal: 20,
    festivoTipo: "perc",
    notteFestivaVal: 40,
    notteFestivaTipo: "perc",
    straordVal: 20,
    straordTipo: "perc"
  },
  trasporti: {
    nome: "Trasporti e Logistica",
    desc: "Turno notturno 20-25%, lavoro domenicale 30%",
    oreSettimana: 39,
    pagaBase: 12.00,
    notteVal: 25,
    notteTipo: "perc",
    festivoVal: 30,
    festivoTipo: "perc",
    notteFestivaVal: 50,
    notteFestivaTipo: "perc",
    straordVal: 25,
    straordTipo: "perc"
  },
  personalizzato: {
    nome: "Personalizzato",
    desc: "Imposta liberamente le cifre della tua busta paga",
    oreSettimana: 36,
    pagaBase: null,
    notteVal: 20,
    notteTipo: "perc",
    festivoVal: 20,
    festivoTipo: "perc",
    notteFestivaVal: null,
    notteFestivaTipo: "auto",
    straordVal: 15,
    straordTipo: "perc"
  }
};

// Formatta un importo in euro italiano.
export function formatEuro(num) {
  if (num == null || !isFinite(num)) return "—";
  return num.toLocaleString("it-IT", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Analisi dettagliata delle presenze e delle ore del mese.
export function analizzaCartellinoMese(engine, meseOff = 0, festivoFn = defaultFestivo) {
  const oggi = new Date();
  const primo = new Date(oggi.getFullYear(), oggi.getMonth() + meseOff, 1, 12);
  const ultimo = new Date(primo.getFullYear(), primo.getMonth() + 1, 0, 12);
  const offsetGiorniPrimo = Math.round((primo.getTime() - new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate(), 12).getTime()) / 864e5);

  const out = {
    primo,
    ultimo,
    giorniNelMese: ultimo.getDate(),
    oreTotali: 0,
    turniTotali: 0,
    nottiTotali: 0,
    festiviTotali: 0,
    liberiTotali: 0,
    ignotiTotali: 0,
    oreNotturne: 0,
    oreDiurneFeriali: 0,
    oreDiurneFestive: 0,
    oreNotturneFestive: 0,
    oreNotturneFeriali: 0,
    turniFestiviDiurni: 0,
    turniFestiviNotturni: 0,
    turniFerialiNotturni: 0,
    turniFerialiDiurni: 0,
    straordinarioMinuti: 0,
    speciali: { ferie: 0, malattia: 0, formazione: 0, reperibile: 0, extra: 0 },
    giorni: [] // dettaglio giorno per giorno
  };

  const focusOriginale = engine.state.focus;

  for (let g = 1; g <= out.giorniNelMese; g++) {
    const dataGiorno = new Date(primo.getFullYear(), primo.getMonth(), g, 12);
    const offGiorno = offsetGiorniPrimo + (g - 1);
    engine.state.focus = dataGiorno;

    let c = "?";
    try { c = engine.codeAt(0); } catch (e) {}
    let b = null;
    try { b = engine.block(0); } catch (e) {}

    const isFest = festivoFn(dataGiorno);
    const giornoDettaglio = {
      giorno: g,
      data: dataGiorno,
      festivo: isFest,
      codice: c,
      block: b,
      lavorato: false,
      ore: 0,
      oreNotte: 0,
      isNotte: false,
      straordinarioMin: 0
    };

    if (b && b.tipo && out.speciali[b.tipo] != null) {
      out.speciali[b.tipo]++;
    }

    if (c === "?" && !(b && b.tipo)) {
      out.ignotiTotali++;
      out.giorni.push(giornoDettaglio);
      continue;
    }

    if (!b || b.rest) {
      out.liberiTotali++;
      out.giorni.push(giornoDettaglio);
      continue;
    }

    // Giorno di lavoro effettivo
    giornoDettaglio.lavorato = true;
    out.turniTotali++;
    const durataMin = Math.max(0, b.end - b.start);
    const oreLavoro = durataMin / 60;
    giornoDettaglio.ore = oreLavoro;
    out.oreTotali += oreLavoro;

    // Straordinario su orari effettivi
    if (b.oreVere && b.previsto && durataMin > b.previsto) {
      const extraMin = durataMin - b.previsto;
      giornoDettaglio.straordinarioMin = extraMin;
      out.straordinarioMinuti += extraMin;
    }

    // Ore notturne (22:00 - 06:00)
    const minNotte = engine.oreNotturne(b);
    const oreNotte = minNotte / 60;
    giornoDettaglio.oreNotte = oreNotte;
    out.oreNotturne += oreNotte;

    const eNotte = engine.eNotte ? engine.eNotte(b) : (oreNotte >= 3);
    giornoDettaglio.isNotte = eNotte;
    if (eNotte) out.nottiTotali++;

    if (isFest) {
      out.festiviTotali++;
      out.oreNotturneFestive += oreNotte;
      const oreDiurne = Math.max(0, oreLavoro - oreNotte);
      out.oreDiurneFestive += oreDiurne;
      if (eNotte) out.turniFestiviNotturni++;
      else out.turniFestiviDiurni++;
    } else {
      out.oreNotturneFeriali += oreNotte;
      const oreDiurne = Math.max(0, oreLavoro - oreNotte);
      out.oreDiurneFeriali += oreDiurne;
      if (eNotte) out.turniFerialiNotturni++;
      else out.turniFerialiDiurni++;
    }

    out.giorni.push(giornoDettaglio);
  }

  engine.state.focus = focusOriginale;

  // Arrotondamenti pratici a 2 decimali
  out.oreTotali = Math.round(out.oreTotali * 100) / 100;
  out.oreNotturne = Math.round(out.oreNotturne * 100) / 100;
  out.oreNotturneFeriali = Math.round(out.oreNotturneFeriali * 100) / 100;
  out.oreNotturneFestive = Math.round(out.oreNotturneFestive * 100) / 100;
  out.oreDiurneFeriali = Math.round(out.oreDiurneFeriali * 100) / 100;
  out.oreDiurneFestive = Math.round(out.oreDiurneFestive * 100) / 100;

  return out;
}

// Calcolo delle indennità e maggiorazioni stimate sulla base delle impostazioni utente.
export function calcolaStimaIndennita(cartellino, cfg = {}) {
  const c = Object.assign({
    pagaBase: null,
    oreSettimana: 36,
    notteVal: null,
    notteTipo: "perc", // "perc" | "ora" | "turno"
    festivoVal: null,
    festivoTipo: "perc",
    notteFestivaVal: null,
    notteFestivaTipo: "auto",
    straordVal: null,
    straordTipo: "perc"
  }, cfg || {});

  const paga = (c.pagaBase != null && isFinite(c.pagaBase) && +c.pagaBase > 0) ? +c.pagaBase : null;
  const voci = [];
  let totaleEuro = 0;
  let haTariffe = false;

  // 1. Indennità Notturna (Feriale o Totale se non scorporata la notte festiva)
  const notteFestivaDifferenziata = (c.notteFestivaVal != null && isFinite(c.notteFestivaVal) && c.notteFestivaTipo !== "auto");
  const oreNotteDaCalcolare = notteFestivaDifferenziata ? cartellino.oreNotturneFeriali : cartellino.oreNotturne;
  const nottiTurniDaCalcolare = notteFestivaDifferenziata ? cartellino.turniFerialiNotturni : cartellino.nottiTotali;

  if (c.notteVal != null && isFinite(c.notteVal) && +c.notteVal > 0) {
    haTariffe = true;
    let euro = 0;
    let tariffaStr = "";
    if (c.notteTipo === "perc" && paga) {
      const quotaOraria = paga * (+c.notteVal / 100);
      euro = oreNotteDaCalcolare * quotaOraria;
      tariffaStr = `${c.notteVal}% (+${formatEuro(quotaOraria)}/h)`;
    } else if (c.notteTipo === "ora") {
      euro = oreNotteDaCalcolare * (+c.notteVal);
      tariffaStr = `${formatEuro(+c.notteVal)}/h`;
    } else if (c.notteTipo === "turno") {
      euro = nottiTurniDaCalcolare * (+c.notteVal);
      tariffaStr = `${formatEuro(+c.notteVal)}/turno`;
    }

    if (euro > 0 || c.notteTipo !== "perc" || paga) {
      voci.push({
        id: "notte",
        titolo: notteFestivaDifferenziata ? "Indennità notturna feriale" : "Indennità notturna (22–06)",
        quantita: c.notteTipo === "turno" ? `${nottiTurniDaCalcolare} turni` : `${oreNotteDaCalcolare} h`,
        tariffa: tariffaStr || `${c.notteVal}% (richiede paga base)`,
        subtotale: Math.round(euro * 100) / 100,
        valido: euro > 0 || (c.notteTipo === "perc" && !paga ? false : true)
      });
      totaleEuro += euro;
    }
  }

  // 2. Indennità Festiva / Domenicale (Diurna o Totale se non scorporata)
  const oreFestiveDaCalcolare = notteFestivaDifferenziata ? cartellino.oreDiurneFestive : (cartellino.oreDiurneFestive + cartellino.oreNotturneFestive);
  const turniFestiviDaCalcolare = notteFestivaDifferenziata ? cartellino.turniFestiviDiurni : cartellino.festiviTotali;

  if (c.festivoVal != null && isFinite(c.festivoVal) && +c.festivoVal > 0) {
    haTariffe = true;
    let euro = 0;
    let tariffaStr = "";
    if (c.festivoTipo === "perc" && paga) {
      const quotaOraria = paga * (+c.festivoVal / 100);
      euro = oreFestiveDaCalcolare * quotaOraria;
      tariffaStr = `${c.festivoVal}% (+${formatEuro(quotaOraria)}/h)`;
    } else if (c.festivoTipo === "ora") {
      euro = oreFestiveDaCalcolare * (+c.festivoVal);
      tariffaStr = `${formatEuro(+c.festivoVal)}/h`;
    } else if (c.festivoTipo === "turno") {
      euro = turniFestiviDaCalcolare * (+c.festivoVal);
      tariffaStr = `${formatEuro(+c.festivoVal)}/turno`;
    }

    if (euro > 0 || c.festivoTipo !== "perc" || paga) {
      voci.push({
        id: "festivo",
        titolo: notteFestivaDifferenziata ? "Indennità festiva diurna" : "Indennità festiva e domenicale",
        quantita: c.festivoTipo === "turno" ? `${turniFestiviDaCalcolare} turni` : `${oreFestiveDaCalcolare} h`,
        tariffa: tariffaStr || `${c.festivoVal}% (richiede paga base)`,
        subtotale: Math.round(euro * 100) / 100,
        valido: euro > 0 || (c.festivoTipo === "perc" && !paga ? false : true)
      });
      totaleEuro += euro;
    }
  }

  // 3. Notturna Festiva specifica (se prevista dal contratto, es. metalmeccanici 55%)
  if (notteFestivaDifferenziata && cartellino.oreNotturneFestive > 0) {
    haTariffe = true;
    let euro = 0;
    let tariffaStr = "";
    if (c.notteFestivaTipo === "perc" && paga) {
      const quotaOraria = paga * (+c.notteFestivaVal / 100);
      euro = cartellino.oreNotturneFestive * quotaOraria;
      tariffaStr = `${c.notteFestivaVal}% (+${formatEuro(quotaOraria)}/h)`;
    } else if (c.notteFestivaTipo === "ora") {
      euro = cartellino.oreNotturneFestive * (+c.notteFestivaVal);
      tariffaStr = `${formatEuro(+c.notteFestivaVal)}/h`;
    } else if (c.notteFestivaTipo === "turno") {
      euro = cartellino.turniFestiviNotturni * (+c.notteFestivaVal);
      tariffaStr = `${formatEuro(+c.notteFestivaVal)}/turno`;
    }

    voci.push({
      id: "notte_festiva",
      titolo: "Indennità notturna festiva",
      quantita: c.notteFestivaTipo === "turno" ? `${cartellino.turniFestiviNotturni} turni` : `${cartellino.oreNotturneFestive} h`,
      tariffa: tariffaStr || `${c.notteFestivaVal}% (richiede paga base)`,
      subtotale: Math.round(euro * 100) / 100,
      valido: euro > 0 || (c.notteFestivaTipo === "perc" && !paga ? false : true)
    });
    totaleEuro += euro;
  }

  // 4. Straordinario (su orari effettivi annotati)
  const oreStraord = Math.round((cartellino.straordinarioMinuti / 60) * 100) / 100;
  if (oreStraord > 0 && c.straordVal != null && isFinite(c.straordVal) && +c.straordVal > 0) {
    haTariffe = true;
    let euro = 0;
    let tariffaStr = "";
    if (c.straordTipo === "perc" && paga) {
      const quotaMaggiorata = paga * (+c.straordVal / 100);
      euro = oreStraord * quotaMaggiorata;
      tariffaStr = `+${c.straordVal}% maggioraz. (${formatEuro(quotaMaggiorata)}/h)`;
    } else if (c.straordTipo === "ora") {
      euro = oreStraord * (+c.straordVal);
      tariffaStr = `${formatEuro(+c.straordVal)}/h`;
    }

    voci.push({
      id: "straordinario",
      titolo: "Maggiorazione straordinario",
      quantita: `${oreStraord} h`,
      tariffa: tariffaStr || `${c.straordVal}%`,
      subtotale: Math.round(euro * 100) / 100,
      valido: euro > 0 || (c.straordTipo === "perc" && !paga ? false : true)
    });
    totaleEuro += euro;
  }

  return {
    voci,
    totaleEuro: haTariffe ? Math.round(totaleEuro * 100) / 100 : null,
    haTariffe,
    pagaBase: paga,
    disclaimer: "Stima indicativa per controllare il cartellino ore. Non sostituisce il cedolino aziendale né ha valore fiscale o previdenziale."
  };
}

// Verifica dei riposi previsti dalla legge ai sensi del D.Lgs. 66/2003:
// - Art. 7: Riposo giornaliero minimo di 11 ore consecutive ogni 24 ore tra due turni
// - Art. 9: Riposo settimanale di almeno 24 ore consecutive ogni 7 giorni (o 35h con riposo giornaliero)
// - Monitoraggio serie notti prolungate (≥4 notti)
export function verificaRiposiLegge(engine, meseOff = 0) {
  const oggi = new Date();
  const primo = new Date(oggi.getFullYear(), oggi.getMonth() + meseOff, 1, 12);
  const ultimo = new Date(primo.getFullYear(), primo.getMonth() + 1, 0, 12);
  const offsetGiorniPrimo = Math.round((primo.getTime() - new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate(), 12).getTime()) / 864e5);
  const giorniMese = ultimo.getDate();

  const focusOriginale = engine.state.focus;

  // Scandiamo con margine di sicurezza: 2 giorni prima del 1° e 2 giorni dopo la fine del mese
  // per verificare correttamente le transizioni di confine mese.
  const blocchi = [];
  for (let g = -1; g <= giorniMese + 2; g++) {
    const dataGiorno = new Date(primo.getFullYear(), primo.getMonth(), g, 12);
    const offGiorno = offsetGiorniPrimo + (g - 1);
    engine.state.focus = dataGiorno;
    let b = null;
    try { b = engine.block(0); } catch (e) {}
    blocchi.push({
      giornoMese: g,
      data: dataGiorno,
      nelMese: g >= 1 && g <= giorniMese,
      block: b,
      lavorato: b && !b.rest && isFinite(b.start) && isFinite(b.end),
      isNotte: b && (engine.eNotte ? engine.eNotte(b) : ((engine.oreNotturne(b) / 60) >= 3))
    });
  }

  engine.state.focus = focusOriginale;

  // 1. Controllo Art. 7: Riposo giornaliero (11 ore = 660 minuti)
  const violazioniGiornaliere = [];
  for (let i = 0; i < blocchi.length - 1; i++) {
    const a = blocchi[i];
    const b = blocchi[i + 1];
    if (!a.lavorato || !b.lavorato) continue;
    // Solo le violazioni che atterrano su un giorno del mese in esame
    if (!b.nelMese) continue;

    // Distanza temporale: inizio turno 2 (+ 1440) - fine turno 1
    const margineMin = (b.block.start + 1440) - a.block.end;
    if (margineMin < 660) {
      const oreStacco = Math.round((margineMin / 60) * 10) / 10;
      violazioniGiornaliere.push({
        data: b.data,
        giornoNumero: b.giornoMese,
        turnoPrecedente: {
          nome: a.block.name || "Turno",
          end: a.block.end
        },
        turnoAttuale: {
          nome: b.block.name || "Turno",
          start: b.block.start
        },
        oreEffettive: oreStacco,
        oreMinime: 11,
        mancanti: Math.round((11 - oreStacco) * 10) / 10
      });
    }
  }

  // 2. Controllo Art. 9: Riposo settimanale (almeno 24h consecutive ogni 7 giorni)
  // Rileviamo se vi sono più di 6 giorni consecutivi di lavoro senza almeno un giorno di riposo (24h)
  const violazioniSettimanali = [];
  let streakLavoro = 0;
  let streakInizio = null;
  for (let i = 0; i < blocchi.length; i++) {
    const g = blocchi[i];
    if (g.lavorato) {
      streakLavoro++;
      if (streakLavoro === 1) streakInizio = g.data;
      if (streakLavoro > 6 && g.nelMese) {
        const giaPresente = violazioniSettimanali.some(v => v.dataFine.toDateString() === g.data.toDateString());
        if (!giaPresente) {
          violazioniSettimanali.push({
            dataInizio: streakInizio,
            dataFine: g.data,
            giorniConsecutivi: streakLavoro,
            descrizione: `${streakLavoro} giorni consecutivi di lavoro senza un riposo settimanale di 24 ore`
          });
        }
      }
    } else {
      streakLavoro = 0;
      streakInizio = null;
    }
  }

  // 3. Monitoraggio serie notti prolungate (≥4 notti consecutive)
  const serieNottiLunghe = [];
  let streakNotti = 0;
  let nottiInizio = null;
  for (let i = 0; i < blocchi.length; i++) {
    const g = blocchi[i];
    if (g.lavorato && g.isNotte) {
      streakNotti++;
      if (streakNotti === 1) nottiInizio = g.data;
      if (streakNotti >= 4 && g.nelMese) {
        serieNottiLunghe.push({
          dataInizio: nottiInizio,
          dataFine: g.data,
          nottiConsecutive: streakNotti
        });
      }
    } else {
      streakNotti = 0;
      nottiInizio = null;
    }
  }

  return {
    riposoGiornalieroOk: violazioniGiornaliere.length === 0,
    violazioniGiornaliere,
    riposoSettimanaleOk: violazioniSettimanali.length === 0,
    violazioniSettimanali,
    serieNottiLunghe,
    tuttoConforme: violazioniGiornaliere.length === 0 && violazioniSettimanali.length === 0
  };
}

// Genera un testo di riepilogo pulito e condivisibile.
export function testoRiepilogoIndennita(cartellino, stima, riposi, nomeMese = "Mese") {
  const righe = [];
  righe.push(`*Verifica Turni e Indennità — ${nomeMese}*`);
  righe.push(`• Ore totali di turno: ${cartellino.oreTotali} h (${cartellino.turniTotali} turni svolti)`);
  if (cartellino.nottiTotali) {
    righe.push(`• Notti: ${cartellino.nottiTotali} turni (${cartellino.oreNotturne} ore in fascia 22–06)`);
  }
  if (cartellino.festiviTotali) {
    righe.push(`• Domeniche e festivi: ${cartellino.festiviTotali} turni`);
  }
  if (cartellino.straordinarioMinuti >= 15) {
    const hStr = Math.round((cartellino.straordinarioMinuti / 60) * 10) / 10;
    righe.push(`• Straordinario registrato: +${hStr} h oltre il previsto`);
  }

  if (stima && stima.haTariffe && stima.totaleEuro != null) {
    righe.push("");
    righe.push("*Stima maggiorazioni e indennità:*");
    for (const v of stima.voci) {
      righe.push(`  - ${v.titolo}: ${v.quantita} (${v.tariffa}) → ${formatEuro(v.subtotale)}`);
    }
    righe.push(`• TOTALE INDENNITÀ LORDO STIMATO: ${formatEuro(stima.totaleEuro)}`);
    righe.push(`  (Stima per controllo cartellino, non sostituisce il cedolino)`);
  }

  righe.push("");
  righe.push("*Verifica Tutela e Riposi (D.Lgs. 66/2003):*");
  if (riposi.riposoGiornalieroOk) {
    righe.push(`• Riposo giornaliero: CONFORME (almeno 11 ore tra tutti i turni)`);
  } else {
    righe.push(`• Riposo giornaliero: ATTENZIONE, ${riposi.violazioniGiornaliere.length} rientro/i rapido/i (<11h):`);
    for (const v of riposi.violazioniGiornaliere) {
      const dataStr = v.data.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
      righe.push(`  - ${dataStr}: solo ${v.oreEffettive}h di riposo tra ${v.turnoPrecedente.nome} e ${v.turnoAttuale.nome} (-${v.mancanti}h rispetto alle 11h di legge)`);
    }
  }

  if (riposi.riposoSettimanaleOk) {
    righe.push(`• Riposo settimanale: CONFORME (almeno 24h consecutive ogni 7 giorni)`);
  } else {
    righe.push(`• Riposo settimanale: ${riposi.violazioniSettimanali.length} periodo/i con oltre 6 giorni consecutivi di lavoro`);
  }

  return righe.join("\n");
}
