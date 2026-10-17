# Verifiche prima della pubblicazione

Stato al 17 ottobre 2026. ✔ = verificato, △ = da fare o da controllare a mano.

## App Android
- ✔ targetSdk 36, compileSdk 36, minSdk 24 (Android 7): in regola con i requisiti di Play.
- ✔ Nessuna libreria nativa (.so): nessun problema con le pagine da 16 KB.
- ✔ Tasto indietro con OnBackPressedCallback: compatibile con il "back predittivo" di Android 16.
- ✔ Permessi: solo quelli che servono (notifiche, sveglia esatta solo per "Ora di alzarti", calendario, avvio). Nessun permesso con dichiarazione speciale.
- ✔ Lint Android: 0 errori (solo avvisi estetici).
- ✔ Firma e AAB: workflow `android-release`, build provata con chiave di prova.
- ✔ Icona adattiva e icona a tema (Android 13+); icona delle notifiche monocromatica.
- ✔ Backup di Android attivo: chi cambia telefono ritrova i dati (dichiarato nella privacy).
- ✔ Prova completa su emulatore Android 11 (sessioni precedenti): calendario con gli eventi, allarmi programmati, notifica di prova.
- △ Prova sul tuo telefono dell'APK finale: widget, PDF, notifiche "Come hai dormito?".

## Web app (PWA)
- ✔ Lighthouse (mobile): accessibilità 100, SEO 100, layout stabile (CLS 0,003).
- ✔ Testi minimi a 12px, logo non deformato, avvio più rapido (render −28% da configurato).
- ✔ Content-Security-Policy ristretta e senza violazioni; HSTS; nessun servizio esterno.
- ✔ Manifest: id, nome e descrizione come su Play, screenshot dell'app attuale.
- ✔ Compressione Brotli (pagina da 574 KB a 176 KB in rete).
- △ Cloudflare Web Analytics: il sito prova a caricarne lo script, che la CSP blocca (errore in console,
  e non è citato nella privacy). Spegnilo: Cloudflare → Workers & Pages → laggy → Metriche → Web Analytics.

## Stabilità
- ✔ 3000 tocchi casuali (app simulata e web), con ricariche e conferme a caso: 0 errori dell'app.
- ✔ Tocchi oltre 100 ms: 1 su 3000 (apertura delle Impostazioni, 104 ms).
- ✔ Memoria dopo 1500 tocchi: 11–15 MB.
- ✔ Suite di test: 54 unitari, 21 suite di interfaccia (accessibilità, testo ingrandito, indietro, inviti, notifiche, cancellazione dati).

## Scheda e moduli Play
- ✔ Testi, grafica, moduli e piano in `scheda.md`, `moduli.md`, `lancio.md`.
- ✔ Privacy, termini e licenze online e raggiungibili dall'app.
- △ Pagina Ko-fi: non verificabile da qui (protezione anti-bot). Aprila dal telefono.
- △ Dopo la pubblicazione: accendere l'invito web → Play (`NT_APP.play`), badge su notturnisti.club.

## Dopo il lancio (cose che solo Play mostra)
- Rapporto pre-lancio (Play Console → Test → Rapporto pre-lancio): crash, accessibilità, screenshot su dispositivi veri.
- Android vitals: crash sotto l'1,09% e ANR sotto lo 0,47% degli utenti.
- Termini di ricerca e conversione della scheda.
