// La palette sta nelle variabili (:root, tema scuro e chiaro): niente colori «a mano» che sul tema chiaro non
// raggiungono il contrasto (erano #10b981, #ef4444, #f59e0b, #2ecc71), e i token comuni a tutti i temi ci sono.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("nessun colore fuori palette (verde, rosso e ambra a mano)", () => {
  for (const c of ["#10b981", "#ef4444", "#f59e0b", "#2ecc71", "rgba(16,185,129", "rgba(239,68,68", "rgba(245,158,11"])
    assert.ok(!html.toLowerCase().includes(c), "colore fuori palette: " + c);
});

test("i token di colore ci sono in tutti e quattro i blocchi dei temi", () => {
  for (const t of ["--ok-soft", "--ok-line", "--persona", "--notte", "--cool-tint"])
    assert.equal(html.split(t + ":").length - 1, 4, t + " definito nel tema scuro e chiaro, sia automatico sia forzato");
});

test("la persona seguita ha un colore suo, non quello di «tutto bene»", () => {
  for (const sel of [".cp{", ".key-pers .filo{", ".cbar.pers{"]) {
    const riga = html.split("\n").find(l => l.startsWith(sel));
    assert.ok(riga && riga.includes("var(--persona)") && !riga.includes("var(--ok)"), sel + " usa --persona");
  }
});
