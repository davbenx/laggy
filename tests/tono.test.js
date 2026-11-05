// Il tono dell'app: incoraggiante, mai punitivo né allarmista. Le parole che fanno sentire inadeguati o in pericolo
// senza dare una via d'uscita restano fuori dai testi che l'utente legge (i commenti nel codice non contano).
// Se una frase serve davvero (sicurezza alla guida), si scrive come proposta: «se hai sonno, meglio non guidare».
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const FILE = ["index.html", "engine.js", "alertness.js", "notifications.js", "debito.js", "luce-ottima.js"];
const VIETATE = [/stasera devi/i, /rischio alto/i, /impedit/i, /sospettat/i, /sbagliat/i, /\bcolpa\b/i, /fallit/i, /massima cautela/i,
  /\bWCOL\b/, /minimo biologico/i, /minimo corporeo/i, /sonnolenza massima/i, /picco di sonnolenza/i, /\bPenombra\b/, /\bInsight\b/,
  /rischio fatica/i, /non hai rispettato/i, /\bobbligatori/i,
  // revisione scientifica del 04/11/2026 (secondo giro): promesse sulla sicurezza, divieti assoluti,
  // «riflessi» (gli studi misurano la coordinazione), momenti «per la testa» che sembrano buoni per guidare,
  // e il caffè alla guida a fine notte proposto senza pisolino
  /più sicur/i, /per quanto costi/i, /\briflessi\b/i, /chiedono testa/i, /nemico numero uno/i,
  // giro 4, per CONCETTO e non per frase: la guida con sonno, le promesse sulla strada di casa e sulla
  // lucidità, le soglie di sicurezza, il debito che si chiude in fretta, gli effetti dati per certi
  /fermati\W+20/i, /qualche minuto[^.]*guid/i, /tornare a casa più/i, /strada di casa/i, /lucidità ottimale|picco di lucidità|lucidità ok/i,
  /(?<!di solito )sei più lucid/i, /più rischios/i, /pochi giorni tranquilli/i, /migliora sia/i, /soglia delle 17/i,
  /con un revisore/i, /anche col cielo coperto/i, /per i più è/i,
  // giro 5: l'inerzia che «passa in pochi minuti» prima di guidare, il debito dato per recuperato tutto,
  // l'alba simulata come certezza, le promesse di risultato («arrivarci in forma», «mente lucida»)
  /(pochi|qualche) minut[^.]*(guid|ripart)/i, /rimette a posto il conto|recuperi quello perso|portare il conto a domani/i,
  /molto meno intontit/i, /arrivarci in forma/i, /mente lucida/i,
  // giro 6: il sonno al volante che «non avvisa», le certezze sulla caffeina, il recupero completo, «al meglio»
  /non avvisa/i, /oltre la quale[^.]*disturbano/i, /recupera quello che|il resto lo recuperi/i, /sono al meglio/i,
  /ti fa stare meglio/i, /si recupera bene/i,
  // giro 7: confronti senza fonte sul modo di prendere il caffè
  /reggono meglio di un doppio|meglio di un doppio/i];

// La scheda di Google Play è testo semplice: ogni riga conta.
const SCHEDA = "docs/play/scheda.md";
const testi = f => f.endsWith(".md") ? readFileSync(new URL("../" + f, import.meta.url), "utf8").split("\n")
                                     : stringhe(readFileSync(new URL("../" + f, import.meta.url), "utf8"));
// Solo il testo dentro le virgolette, senza i commenti (// … e /* … */, <!-- … -->).
function stringhe(src) {
  const senza = src.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'\\])\/\/[^\n]*/g, "$1");
  return [...senza.matchAll(/"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|>([^<>{}\n]{3,})</g)].map(m => m[1] ?? m[2] ?? m[3]);
}

test("nessuna frase punitiva o allarmista nei testi", () => {
  const trovate = [];
  for (const f of [...FILE, SCHEDA]) for (const s of testi(f))
    for (const r of VIETATE) if (r.test(s)) trovate.push(f + ": " + r + " in «" + s.slice(0, 90) + "»");
  assert.deepEqual(trovate, []);
});

// Sicurezza alla guida (revisione scientifica del 04/11/2026, giro 4): ogni frase che parla di occhiali da sole
// o di lenti per chi guida dice anche «buona luce», come il sito. Da novembre a febbraio al rientro dalla notte
// è ancora buio. Per concetto: non serve che nella frase ci sia «categoria» (così ne erano passate sei).
test("occhiali e lenti: sempre con «buona luce»", () => {
  const trovate = [];
  for (const f of [...FILE, SCHEDA]) for (const s of testi(f))
    if ((/occhiali da sole/i.test(s) || /(lenti|occhiali)[^.;]*guid|guid[^.;]*(lenti|occhiali)/i.test(s)) && !/buona luce|se non guidi/i.test(s))
      trovate.push(f + ": «" + s.slice(0, 120) + "»");
  assert.deepEqual(trovate, []);
});
