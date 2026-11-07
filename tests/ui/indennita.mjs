// Test UI per la funzionalità «Verifica Turni, Indennità e Riposi di Legge (D.Lgs 66/2003)»
import pw from "./_pw.mjs";
const ok = (c, m) => { console.log((c ? "✔ " : "✘ ") + m); };
const b = await pw.chromium.launch();
const errs = [];

async function apri() {
  const ctx = await b.newContext({ locale: "it-IT", timezoneId: "Europe/Rome", viewport: { width: 360, height: 800 } });
  await ctx.addInitScript(() => {
    localStorage.setItem("nt:state", JSON.stringify({
      turniConfigurati: true,
      pattern: "MPNSR",
      anchor: "2026-10-01",
      shifts: {
        M: { n: "Mattino", s: 420, e: 840 },
        P: { n: "Pomeriggio", s: 840, e: 1260 },
        N: { n: "Notte", s: 1260, e: 1860 }
      },
      repeat: true
    }));
    localStorage.setItem("nt:turniConfigurati", "true");
    localStorage.setItem("nt:firstPlanBannerChiuso", "true");
    localStorage.setItem("nt:attivazioneNascosta", "true");
  });
  const p = await ctx.newPage();
  p.on("pageerror", e => errs.push(e.message));
  await p.goto("http://localhost:8765/index.html");
  await p.waitForTimeout(1200);
  return { p, ctx };
}

// 1. Apertura foglio indennità da #meseBox
{
  const { p, ctx } = await apri();
  await p.click('[data-tab="turni"]');
  await p.waitForTimeout(400);

  // Espandi dettagli mese
  const det = await p.$("#meseBox .mese-det");
  if (det) await p.evaluate(el => el.open = true, det);
  await p.waitForTimeout(300);

  const btnApri = await p.$("#btnApriIndennita");
  ok(!!btnApri, "Pulsante «Verifica indennità e riposi di legge» presente in #meseBox");

  await p.click("#btnApriIndennita");
  await p.waitForTimeout(400);

  const visibile = await p.evaluate(() => {
    const m = document.querySelector("#indennitaModal");
    return m && !m.hidden && m.getAttribute("aria-hidden") === "false";
  });
  ok(visibile, "Foglio #indennitaModal si apre al tocco");

  // Verifica presenza sezioni principali
  const sezioni = await p.evaluate(() => {
    const c = document.querySelector("#indennitaCorpo");
    if (!c) return {};
    return {
      testo: c.innerText,
      hasOre: /cartellino ore del mese/i.test(c.innerText),
      hasTutela: /tutela e riposi di legge/i.test(c.innerText),
      hasRiposoGiornaliero: c.innerText.includes("Riposo giornaliero"),
      hasRiposoSettimanale: c.innerText.includes("Riposo settimanale"),
      hasBtnConfig: !!c.querySelector("#btnConfigDaMese"),
      hasBtnCopia: !!c.querySelector("#btnCopiaRiepilogoIndennita")
    };
  });
  ok(sezioni.hasOre, "Il foglio contiene il cartellino ore del mese");
  ok(sezioni.hasTutela, "Il foglio contiene la sezione tutela e riposi di legge (D.Lgs. 66/2003)");
  ok(sezioni.hasRiposoGiornaliero, "Il foglio contiene la verifica riposo giornaliero");
  ok(sezioni.hasRiposoSettimanale, "Il foglio contiene la verifica riposo settimanale");
  ok(sezioni.hasBtnConfig && sezioni.hasBtnCopia, "Pulsanti «Configura» e «Copia riepilogo» presenti");

  // 2. Apertura configurazione tariffe e preset Sanità
  await p.click("#indennitaApriConfig");
  await p.waitForTimeout(400);

  const configVisibile = await p.evaluate(() => {
    const m = document.querySelector("#indennitaConfigModal");
    return m && !m.hidden;
  });
  ok(configVisibile, "Foglio #indennitaConfigModal si apre da «Tariffe»");

  // Clicca preset Sanità
  await p.click('[data-ccnl="sanita"]');
  await p.waitForTimeout(200);

  const valNotte = await p.evaluate(() => document.querySelector("#indNotteVal").value);
  const tipoNotte = await p.evaluate(() => document.querySelector("#indNotteTipo").value);
  ok(valNotte === "4.4" && tipoNotte === "ora", "Preset Sanità imposta 4.40 €/ora notturna");

  // Salva configurazione
  await p.click("#indennitaConfigSalva");
  await p.waitForTimeout(400);

  // Verifica aggiornamento stima nel foglio indennità
  const stimaAggiornata = await p.evaluate(() => {
    const c = document.querySelector("#indennitaCorpo");
    return c ? {
      totale: c.innerText.includes("Totale indennità stimato"),
      disclaimer: c.innerText.includes("Non sostituisce il cedolino")
    } : {};
  });
  ok(stimaAggiornata.totale && stimaAggiornata.disclaimer, "Stima calcolata con totale indennità e disclaimer visibile");

  // Chiudi foglio
  await p.click("#indennitaChiudi");
  await p.waitForTimeout(300);

  // 3. Verifica presenza voce in I tuoi turni
  await p.click("#tEdit");
  await p.waitForTimeout(300);
  await p.click('[data-mod="ciclo"]');
  await p.waitForTimeout(400);

  const btnTuoiTurni = await p.$('[data-tt="indennita"]');
  ok(!!btnTuoiTurni, "Riga «Indennità e riposi di legge» presente in I tuoi turni");

  const valTuoiTurni = await p.evaluate(() => {
    const el = document.querySelector("#ttValIndennita");
    return el ? el.textContent : "";
  });
  ok(valTuoiTurni.includes("Configurato"), "Stato indennità mostra «Configurato» dopo il salvataggio");

  await ctx.close();
}

console.log("Errori rilevati:", errs);
ok(errs.length === 0, "Nessun errore di pagina JavaScript");
await b.close();
