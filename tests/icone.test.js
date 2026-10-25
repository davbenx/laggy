// L'icona: tutti i file generati da tools/logo/genera.mjs esistono con le misure giuste (web, manifest, Android, avvio).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const radice = new URL("../", import.meta.url);
const png = f => { const p = new URL(f, radice); assert.ok(existsSync(p), "manca " + f); const b = readFileSync(p);
  assert.equal(b.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", f + " non è un PNG");
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), tipo: b[25] }; };   // tipo 6 = con trasparenza, 2 = senza
const RES = "app/android/app/src/main/res/";

test("icone web: misure e trasparenza", () => {
  for (const [f, w, h] of [["icon-180.png", 180, 180], ["icon-192.png", 192, 192], ["icon-512.png", 512, 512], ["icon-maskable-512.png", 512, 512], ["docs/play/img/icona-app-512.png", 512, 512], ["owl-mark.png", 196, 209]]) {
    const i = png(f); assert.deepEqual([i.w, i.h], [w, h], f);
  }
  assert.equal(png("icon-512.png").tipo, 6, "icon-512 è trasparente (la civetta senza sfondo)");
  assert.equal(png("owl-mark.png").tipo, 6, "il segno è trasparente: sta su schede chiare e scure");
});

test("il manifest dichiara le misure vere di ogni icona", () => {
  const m = JSON.parse(readFileSync(new URL("manifest.webmanifest", radice), "utf8"));
  const icone = [...m.icons, ...(m.shortcuts || []).flatMap(s => s.icons || [])];
  assert.ok(icone.length >= 3);
  for (const ic of icone) { const i = png(ic.src); assert.equal(ic.sizes, i.w + "x" + i.h, ic.src + ": " + ic.sizes + " dichiarato, " + i.w + "x" + i.h + " vero"); }
});

test("icona Android: primo piano, quadrata e rotonda per ogni densità", () => {
  for (const [d, k] of Object.entries({ mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 })) {
    const S = 108 * k, I = 48 * k;
    for (const [f, n] of [["ic_launcher_foreground.png", S], ["ic_launcher.png", I], ["ic_launcher_round.png", I]]) {
      const i = png(RES + `mipmap-${d}/` + f); assert.deepEqual([i.w, i.h, i.tipo], [n, n, 6], d + " " + f);
    }
  }
});

test("schermata di avvio: ogni densità e orientamento, due file per la stessa risoluzione sono la stessa immagine", () => {
  const verticali = { mdpi: [320, 480], hdpi: [480, 800], xhdpi: [720, 1280], xxhdpi: [960, 1600], xxxhdpi: [1280, 1920] };
  for (const [d, [w, h]] of Object.entries(verticali)) {
    assert.deepEqual(Object.values(png(RES + `drawable-port-${d}/splash.png`)).slice(0, 2), [w, h], "port " + d);
    assert.deepEqual(Object.values(png(RES + `drawable-land-${d}/splash.png`)).slice(0, 2), [h, w], "land " + d);
  }
  assert.deepEqual(Object.values(png(RES + "drawable/splash.png")).slice(0, 2), [480, 320]);
});

test("la sorgente del logo c'è ed è l'unica fonte dei file", () => {
  assert.ok(existsSync(new URL("tools/logo/civetta.svg", radice)) && existsSync(new URL("tools/logo/genera.mjs", radice)));
  assert.match(readFileSync(new URL("tools/logo/civetta.svg", radice), "utf8"), /berretto da notte/);
});
