# Notturnisti — app nativa (Capacitor)

Guscio nativo attorno alla stessa app web della cartella sopra: **nessuna
copia del codice**. `scripts/build-web.mjs` copia in `www/` i file web così
come sono, e Capacitor li impacchetta. Il piano completo è in
[`../docs/app-nativa.md`](../docs/app-nativa.md).

## Cosa fa di diverso dal web
- **Notifiche** del sistema operativo (`@capacitor/local-notifications`):
  arrivano ad app chiusa e dopo un riavvio, 21 giorni armati in anticipo.
  La sveglia è esatta solo se l'utente concede "Sveglie e promemoria" (link
  in Opzioni); tutto il resto ammette qualche minuto di scarto.
- **Trasloco dati** dalla vecchia TWA (`../migrate.js`): al primo avvio, se
  l'app è vuota, propone di recuperare i dati dal browser con
  `notturnisti://import#…`, senza server.
- **Calendario del telefono**: calendario locale «Notturnisti» (non va su
  Google), aggiornato a ogni cambio di turni. Permesso calendario chiesto
  solo quando lo si attiva.
- **Widget** «Notturnisti · adesso»: cosa fare adesso e le prossime due cose.
- Tasto indietro, pannello di condivisione di sistema, barre di sistema
  e font integrati.
- Niente service worker, niente banner d'installazione, niente link alle
  donazioni (policy Play), niente export `.ics` da file.

## Comandi
```sh
cd app
npm install
npm run apk:debug          # APK di prova: android/app/build/outputs/apk/debug/
npm run android            # apre Android Studio
```
Serve JDK 21 e l'Android SDK (platform 36). Senza Android Studio, basta
scrivere `sdk.dir=/percorso/android-sdk` in `android/local.properties`.

Dopo ogni modifica ai file web: `npm run sync`.

## Rilascio sul Play Store (prima pubblicazione)
App nuova: `applicationId` `club.notturnisti.app`. Non è mai stata pubblicata
(prima c'era solo la PWA), quindi non c'è una scheda o una chiave da
riprendere. Il package resta per sempre dopo il primo upload: non cambiarlo.

1. **Firma**: con Play App Signing Google tiene la chiave di firma dell'app;
   tu crei solo una chiave di *upload* (`keytool -genkeypair -v -keystore
   upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload`) e la
   conservi fuori dal repository, con una copia di sicurezza. Scrivi
   `android/keystore.properties` (mai nel repository):
   ```
   storeFile=/percorso/upload.jks
   storePassword=…
   keyAlias=upload
   keyPassword=…
   ```
2. **Versione**: `versionCode` parte da 1 e cresce a ogni upload:
   ```sh
   cd android && ./gradlew bundleRelease -PntVersionCode=1 -PntVersionName=1.0.0
   ```
3. Carica `app/build/outputs/bundle/release/app-release.aab` prima in un
   **test interno**, poi nel **test chiuso** (per i nuovi account personali:
   almeno 12 tester per 14 giorni). Da provare su un telefono vero: recupero
   dei dati dalla PWA, notifiche ad app chiusa e dopo un riavvio, widget,
   calendario, link condivisi.
4. **Scheda Play** → "Sicurezza dei dati": statistiche anonime solo con
   consenso, nessun dato personale raccolto. Dichiara il permesso
   `SCHEDULE_EXACT_ALARM` (solo per la sveglia del piano) e i permessi
   calendario (scrittura del calendario «Notturnisti» sul telefono).
