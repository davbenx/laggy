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
  /più sicur/i, /per quanto costi/i, /\briflessi\b/i, /chiedono testa/i, /fermati 20 minuti/i, /nemico numero uno/i];

// Solo il testo dentro le virgolette, senza i commenti (// … e /* … */, <!-- … -->).
function stringhe(src) {
  const senza = src.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'\\])\/\/[^\n]*/g, "$1");
  return [...senza.matchAll(/"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|>([^<>{}\n]{3,})</g)].map(m => m[1] ?? m[2] ?? m[3]);
}

test("nessuna frase punitiva o allarmista nei testi", () => {
  const trovate = [];
  for (const f of FILE) for (const s of stringhe(readFileSync(new URL("../" + f, import.meta.url), "utf8")))
    for (const r of VIETATE) if (r.test(s)) trovate.push(f + ": " + r + " in «" + s.slice(0, 90) + "»");
  assert.deepEqual(trovate, []);
});

// Sicurezza alla guida (revisione scientifica del 04/11/2026): ogni frase che parla di
// lenti o occhiali da sole per chi guida dice anche «solo con buona luce», come il sito.
// Da novembre a febbraio al rientro dalla notte è ancora buio.
test("lenti per la guida: sempre con «solo con buona luce»", () => {
  const trovate = [];
  for (const f of FILE) for (const s of stringhe(readFileSync(new URL("../" + f, import.meta.url), "utf8")))
    if (/(lenti|occhiali)[^.;]*guid|guid[^.;]*(lenti|occhiali)/i.test(s) && /categoria/i.test(s) && !/solo con buona luce/i.test(s))
      trovate.push(f + ": «" + s.slice(0, 120) + "»");
  assert.deepEqual(trovate, []);
});
