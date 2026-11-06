// Test per le icone dei turni nel widget calendario e nel modello dati.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "..", "index.html"), "utf8");

const SHIFT_WIDGET_MAP = {
  sun: "☀️",
  dim: "🌅",
  moon: "🌙",
  sparkles: "✨",
  alarm: "⏰",
  briefcase: "💼"
};

// Logica di parsing identica a CalendarioModel.java (righe 70-78)
function parseCella(s) {
  let segni = "";
  const u = s.lastIndexOf(":");
  if (u >= 2 && s.charAt(u - 2) === ":" && /^[fx]*$/.test(s.substring(u + 1))) {
    segni = s.substring(u + 1);
    s = s.substring(0, u);
  }
  const k = s.lastIndexOf(":");
  const sigla = k > 0 ? s.substring(0, k) : s;
  let tipo = k >= 0 && k + 1 < s.length ? s.charAt(k + 1) : "?";
  if (!"nlrmps".includes(tipo)) tipo = "?";
  return { sigla, tipo, festivo: segni.includes("f"), modificato: segni.includes("x") };
}

test("mappatura icone turni per widget Android", () => {
  assert.equal(SHIFT_WIDGET_MAP.sun, "☀️");
  assert.equal(SHIFT_WIDGET_MAP.dim, "🌅");
  assert.equal(SHIFT_WIDGET_MAP.moon, "🌙");
  assert.equal(SHIFT_WIDGET_MAP.sparkles, "✨");
  assert.equal(SHIFT_WIDGET_MAP.alarm, "⏰");
  assert.equal(SHIFT_WIDGET_MAP.briefcase, "💼");
  assert.equal(Object.keys(SHIFT_WIDGET_MAP).length, 6);
});

test("index.html contiene SHIFT_WIDGET_MAP e supporto perWidget", () => {
  assert.ok(html.includes("const SHIFT_WIDGET_MAP ="), "SHIFT_WIDGET_MAP definito");
  assert.ok(html.includes("SHIFT_WIDGET_MAP[sh.icon]"), "usato per il turno personale");
  assert.ok(html.includes("SHIFT_WIDGET_MAP[shp.icon]"), "usato per il turno del partner");
  assert.ok(html.includes("function meseWidget(prima, tot, perWidget)"), "firma con perWidget");
});

test("parsing CalendarioModel delle celle con icone", () => {
  const c1 = parseCella("☀️ M:m");
  assert.equal(c1.sigla, "☀️ M");
  assert.equal(c1.tipo, "m");
  assert.equal(c1.festivo, false);
  assert.equal(c1.modificato, false);

  const c2 = parseCella("🌙 N:n:f");
  assert.equal(c2.sigla, "🌙 N");
  assert.equal(c2.tipo, "n");
  assert.equal(c2.festivo, true);
  assert.equal(c2.modificato, false);

  const c3 = parseCella("✨ R:r:fx");
  assert.equal(c3.sigla, "✨ R");
  assert.equal(c3.tipo, "r");
  assert.equal(c3.festivo, true);
  assert.equal(c3.modificato, true);

  const c4 = parseCella("🌅 P:p:x");
  assert.equal(c4.sigla, "🌅 P");
  assert.equal(c4.tipo, "p");
  assert.equal(c4.festivo, false);
  assert.equal(c4.modificato, true);
});

test("formato stringa compatibile con regex widget", () => {
  const regex = /^[^:]+:[nlrmps?](:[fx]+)?$/;
  assert.ok(regex.test("☀️ M:m"));
  assert.ok(regex.test("🌅 P:p"));
  assert.ok(regex.test("🌙 N:n:f"));
  assert.ok(regex.test("⏰ S:s:x"));
  assert.ok(regex.test("✨ R:r:fx"));
  assert.ok(regex.test("💼 L:l"));
  assert.ok(regex.test("M:m"), "senza icona resta compatibile");
});
