import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const dopo = (inizio, n) => { const i = html.indexOf(inizio); assert.ok(i > 0, inizio); return html.slice(i, i + n); };

test("il feedback non allega il ciclo e dice da dove arriva", () => {
  const f = dopo("function apriFeedback(da)", 900).split("$(\"#doFeed\")")[0];
  assert.ok(!/toHash\(\)|NT_APP\.base/.test(f), "niente link con il ciclo nella mail");
  assert.match(f, /non è allegato/);
  assert.match(f, /versioneApp/);
});

test("le richieste di partecipazione passano tutte dal budget unico", () => {
  const b = dopo("function partecipaOk()", 700);
  assert.match(b, /<3/); assert.match(b, /h<7 \|\| h>=22/); assert.match(b, />=7/);
  assert.match(dopo("function proponiRecensione()", 900), /partecipaOk\(\)/);
  assert.match(dopo("function consiglioFunzione()", 1400), /x\.partecipa \|\| partecipaOk\(\)/);
  assert.match(dopo("function chiediPerche(", 400), /partecipaOk\(\)/);
});

test("le novità sanno etichettare «Richiesto da voi»", () => {
  assert.match(html, /Richiesto da voi/);
});
