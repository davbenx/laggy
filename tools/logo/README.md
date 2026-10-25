# Il logo

`civetta.svg` è la sorgente: la civetta con il berretto da notte e l'orologio sulla pancia. Il berretto ha due strisce
**azzurro chiaro** e blu: così si stacca dallo sfondo e si riconosce anche a 48 px. Sfondo delle icone: `#FBEFE3`.

`genera.mjs` disegna da quell'SVG tutti i file (Playwright, come i test della pagina):

| File | Dove si usa |
|---|---|
| `icon-512.png` (trasparente), `icon-192.png`, `icon-180.png` | PWA, icona in home, anteprime |
| `icon-maskable-512.png` | PWA «maschera»: la civetta sta nel cerchio sicuro del 40% |
| `owl-mark.png` | intestazione dell'onboarding e badge delle notifiche |
| `docs/play/img/icona-app-512.png` | scheda di Play |
| `mipmap-*/ic_launcher_foreground.png` | icona adattiva di Android (sta nel cerchio sicuro di 66 su 108 dp), sfondo `#FBEFE3` |
| `mipmap-*/ic_launcher.png`, `ic_launcher_round.png` | Android senza icone adattive |
| `drawable*/splash.png` (11 file) | schermata di avvio: riquadro crema su `#14161A` |

Per rigenerare: `node tools/logo/genera.mjs` dalla radice (serve Playwright, vedi `tests/ui/_pw.mjs`). Per cambiare il
disegno si modifica solo `civetta.svg`. Restano com'erano l'icona monocromatica (la luna) e quella delle notifiche.
Il test `tests/icone.test.js` controlla che ogni file ci sia con le misure giuste.
