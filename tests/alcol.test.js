// Il paragone veglia–alcol (Dawson & Reid, Nature 1997): 17 h ≈ 0,5 g/l, 24 h ≈ 1 g/l. Fra i due punti si
// interpola; lo studio misura fino a 26 h, oltre si dice «oltre 1». Il revisore (giro 4) aveva trovato 0,8 a 24 h.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const riga = src.match(/const gl = (m => [^\n]+;)/);

test("formula dell'alcol: i due punti dello studio e niente estrapolazione oltre le 26 ore", () => {
  assert.ok(riga, "la funzione gl esiste ancora in index.html");
  const gl = eval(riga[1].replace(/;$/, ""));
  assert.equal(gl(17 * 60), "circa 0,5");
  assert.equal(gl(24 * 60), "circa 1,0");
  assert.equal(gl(20 * 60 + 30), "circa 0,8");
  assert.equal(gl(26 * 60), "oltre 1");
  assert.equal(gl(30 * 60), "oltre 1");
});
