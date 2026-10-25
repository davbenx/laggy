// Genera tutte le icone dalla sorgente civetta.svg (Playwright disegna l'SVG e salva i PNG):
//   web (180, 192, 512, maschera 512), il segno dell'onboarding e delle notifiche, la scheda di Play (512),
//   l'icona di Android (livello in primo piano, quadrata e rotonda per ogni densità) e la schermata di avvio.
// Si lancia dalla radice del repository:  node tools/logo/genera.mjs
import pw from "../../tests/ui/_pw.mjs";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
const radice = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const svg = readFileSync(join(radice, "tools/logo/civetta.svg"), "utf8");
const res = join(radice, "app/android/app/src/main/res/");
const CREMA = "#FBEFE3", SCURO = "#14161A";
const R_MAX = 428;      // il punto della civetta più lontano dal centro (in unità del foglio): serve a farla stare in un cerchio
const CX = 559, CY = 528; // centro del cerchio che la contiene

const b = await pw.chromium.launch(); const p = await b.newPage();
// una tela di L×A pixel: sfondo (crema, scuro o niente), un riquadro arrotondato facoltativo, la civetta con il suo punto più lontano a `rho` pixel
async function disegna(file, L, A, { sfondo = null, riquadro = null, rho, cerchio = false, angolo = 0 }) {
  const k = rho / R_MAX, vb = `${CX - (L / 2) / k} ${CY - (A / 2) / k} ${L / k} ${A / k}`;
  const interno = svg.replace(/<svg [^>]*>/, "").replace("</svg>", "");
  let html = `<body style="margin:0;background:transparent"><svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${A}" viewBox="${vb}">`;
  const u = v => v / k;   // pixel → unità del foglio
  const x0 = CX - (L / 2) / k, y0 = CY - (A / 2) / k;
  if (sfondo) html += cerchio ? `<circle cx="${CX}" cy="${CY}" r="${u(Math.min(L, A) / 2)}" fill="${sfondo}"/>`
    : angolo ? `<rect x="${x0}" y="${y0}" width="${u(L)}" height="${u(A)}" rx="${u(angolo)}" fill="${sfondo}"/>` : `<rect x="${x0}" y="${y0}" width="${u(L)}" height="${u(A)}" fill="${sfondo}"/>`;
  if (riquadro) html += `<rect x="${CX - u(riquadro.s) / 2}" y="${CY - u(riquadro.s) / 2}" width="${u(riquadro.s)}" height="${u(riquadro.s)}" rx="${u(riquadro.s * 0.2)}" fill="${riquadro.colore}"/>`;
  html += `<g>${interno}</g></svg></body>`;
  // le unità di <g> sono quelle del foglio: il viewBox di civetta.svg è annidato, quindi si usa il contenuto senza il suo viewBox
  await p.setViewportSize({ width: L, height: A }); await p.setContent(html);
  await p.screenshot({ path: join(radice, file), omitBackground: true, clip: { x: 0, y: 0, width: L, height: A } });
}

// ── web ──
await disegna("icon-512.png", 512, 512, { rho: 0.46 * 512 });                               // trasparente
await disegna("icon-192.png", 192, 192, { sfondo: CREMA, rho: 0.42 * 192 });
await disegna("icon-180.png", 180, 180, { sfondo: CREMA, rho: 0.42 * 180 });
await disegna("icon-maskable-512.png", 512, 512, { sfondo: CREMA, rho: 0.38 * 512 });       // zona sicura delle icone «maschera»: cerchio del 40%
await disegna("docs/play/img/icona-app-512.png", 512, 512, { sfondo: CREMA, rho: 0.42 * 512 });
// il segno (onboarding e badge delle notifiche): solo la civetta, trasparente, un po' più alta che larga
{ const L = 196, A = 209, k = L / 780, vb = `125 100 780 ${A / k}`;
  const interno = svg.replace(/<svg [^>]*>/, "").replace("</svg>", "");
  await p.setViewportSize({ width: L, height: A }); await p.setContent(`<body style="margin:0;background:transparent"><svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${A}" viewBox="${vb}">${interno}</svg></body>`);
  await p.screenshot({ path: join(radice, "owl-mark.png"), omitBackground: true, clip: { x: 0, y: 0, width: L, height: A } }); }

// ── Android: primo piano (108dp: la civetta sta nel cerchio sicuro di 66dp), quadrata e rotonda per le 5 densità ──
const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [nome, d] of Object.entries(dens)) {
  const S = Math.round(108 * d), I = Math.round(48 * d);
  await disegna(`app/android/app/src/main/res/mipmap-${nome}/ic_launcher_foreground.png`, S, S, { rho: (33 / 108) * S * 0.97 });
  await disegna(`app/android/app/src/main/res/mipmap-${nome}/ic_launcher.png`, I, I, { sfondo: CREMA, angolo: I * 0.2, rho: 0.41 * I });
  await disegna(`app/android/app/src/main/res/mipmap-${nome}/ic_launcher_round.png`, I, I, { sfondo: CREMA, cerchio: true, rho: 0.40 * I });
}

// ── schermata di avvio: sfondo scuro, riquadro crema al centro, la civetta dentro ──
const lato = { mdpi: 132, hdpi: 198, xhdpi: 300, xxhdpi: 402, xxxhdpi: 534 };
const dim = { port: { mdpi: [320, 480], hdpi: [480, 800], xhdpi: [720, 1280], xxhdpi: [960, 1600], xxxhdpi: [1280, 1920] }, land: { mdpi: [480, 320], hdpi: [800, 480], xhdpi: [1280, 720], xxhdpi: [1600, 960], xxxhdpi: [1920, 1280] } };
for (const [orient, mappa] of Object.entries(dim)) for (const [nome, [L, A]] of Object.entries(mappa)) {
  await disegna(`app/android/app/src/main/res/drawable-${orient}-${nome}/splash.png`, L, A, { sfondo: SCURO, riquadro: { s: lato[nome], colore: CREMA }, rho: 0.40 * lato[nome] });
}
await disegna("app/android/app/src/main/res/drawable/splash.png", 480, 320, { sfondo: SCURO, riquadro: { s: lato.mdpi, colore: CREMA }, rho: 0.40 * lato.mdpi });
await b.close();
console.log("icone generate");
