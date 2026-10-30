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
  for (const t of ["--ok-soft", "--ok-line", "--persona", "--persona-soft", "--notte", "--cool-tint"])
    assert.equal(html.split(t + ":").length - 1, 4, t + " definito nel tema scuro e chiaro, sia automatico sia forzato");
});

test("la persona seguita ha un colore suo, non quello di «tutto bene»", () => {
  for (const sel of [".cp{", ".key-pers .filo{", ".cbar.pers{"]) {
    const riga = html.split("\n").find(l => l.startsWith(sel));
    assert.ok(riga && riga.includes("var(--persona)") && !riga.includes("var(--ok)"), sel + " usa --persona");
  }
});

// ── Contrasti: ogni colore di testo regge su fondo e superfici, in tutti e quattro i blocchi dei temi ──
const luce = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
const contrasto = (a, b) => { const [x, y] = [luce(a), luce(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };
const blocchi = [...html.matchAll(/--bg:#[0-9A-Fa-f]{6};[^}]*}/g)].map(m => Object.fromEntries([...m[0].matchAll(/--([\w-]+):(#[0-9A-Fa-f]{6})/g)].map(x => [x[1], x[2]])));

test("quattro blocchi di tema: due scuri identici, due chiari identici", () => {
  assert.equal(blocchi.length, 4);
  const scuri = blocchi.filter(b => luce(b.bg) < .2), chiari = blocchi.filter(b => luce(b.bg) > .5);
  assert.equal(scuri.length, 2); assert.equal(chiari.length, 2);
  assert.deepEqual(scuri[0], scuri[1], "scuro automatico e scuro scelto a mano sono identici");
  assert.deepEqual(chiari[0], chiari[1], "chiaro automatico e chiaro scelto a mano sono identici");
});

test("contrasto del testo: almeno 4,5:1 su fondo e superfici (AA), 3:1 per le barre dei grafici", () => {
  for (const t of blocchi) for (const sfondo of ["bg", "s1", "s2"]) {
    for (const n of ["ink", "dim", "faint", "blue", "orange", "risk", "ok", "notte", "mattina", "sera", "persona", "picco"])
      assert.ok(contrasto(t[n], t[sfondo]) >= 4.5, `${n} ${t[n]} su ${sfondo} ${t[sfondo]}: ${contrasto(t[n], t[sfondo]).toFixed(2)}`);
    assert.ok(contrasto(t["sleep-fill"], t[sfondo]) >= 3 || sfondo === "s2" && contrasto(t["sleep-fill"], t.bg) >= 3, `sleep-fill ${t["sleep-fill"]} su ${sfondo}`);
  }
});
