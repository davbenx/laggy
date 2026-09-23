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
  "engine.js", "alertness.js", "history.js", "notifications.js",
  "platform.js", "analytics.js", "paid.js", "migrate.js",
  "manifest.webmanifest",
  "icon-180.png", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "owl-mark.png"
];

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const f of FILES) {
  const src = join(root, f);
  if (!existsSync(src)) throw new Error("manca " + f);
  cpSync(src, join(out, f));
}
console.log("www/: " + FILES.length + " file copiati da " + root);
