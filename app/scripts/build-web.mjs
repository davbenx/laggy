// Copia in www/ i file web della cartella sopra, così come sono: nessun build
// step, nessuna trasformazione. L'elenco è esplicito (non "tutto tranne…"):
// nell'app finisce solo ciò che serve a farla girare, mai codice server,
// test, documenti o chiavi.
import { cpSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const out = join(here, "..", "www");

const FILES = [
  "index.html",
  "engine.js", "alertness.js", "history.js", "debito.js", "calendario.js", "notifications.js",
  "platform.js", "pdf.js", "lingua.js", "analytics.js", "paid.js", "migrate.js", "importa.js",
  "manifest.webmanifest",
  "icon-180.png", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "owl-mark.png", "badge-96.png",
  "fonts/inter-latin.woff2", "fonts/noto-serif-latin.woff2",
  // Avvisi delle licenze: MIT e OFL chiedono che accompagnino le copie
  // distribuite, quindi stanno anche dentro l'app, non solo sul sito.
  "licenze/index.html", "fonts/OFL-Inter.txt", "fonts/OFL-NotoSerif.txt"
];

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const f of FILES) {
  const src = join(root, f);
  if (!existsSync(src)) throw new Error("manca " + f);
  mkdirSync(dirname(join(out, f)), { recursive: true });
  cpSync(src, join(out, f));
}
// Pagina di riserva dell'app (capacitor.config.json › server.errorPath):
// WebView troppo vecchio o pagina che non si carica. Solo nell'app.
cpSync(join(here, "..", "aggiorna.html"), join(out, "aggiorna.html"));
console.log("www/: " + (FILES.length + 1) + " file copiati da " + root);
