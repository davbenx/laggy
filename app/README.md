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
- Niente service worker, niente banner d'installazione, niente link alle
  donazioni (policy Play), niente export `.ics` da file (arriva il
  calendario nativo, fase 3).

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

## Rilascio sul Play Store (sostituisce la TWA)
Stesso `applicationId` della TWA (`club.notturnisti.twa`), quindi è un
**aggiornamento** della stessa scheda, non un'app nuova.

1. **Firma**: serve la chiave di upload della TWA. Con Play App Signing
   (quasi certo, se la TWA è stata pubblicata con Bubblewrap o PWABuilder)
   è la chiave di *upload*, non quella di firma dell'app. Scrivi
   `android/keystore.properties` (mai nel repository):
   ```
   storeFile=/percorso/upload.jks
   storePassword=…
   keyAlias=…
   keyPassword=…
   ```
2. **Versione**: il `versionCode` deve superare quello dell'ultima TWA
   pubblicata (Play Console → Release → App bundle explorer):
   ```sh
   cd android && ./gradlew bundleRelease -PntVersionCode=NN -PntVersionName=2.0.0
   ```
3. Carica `app/build/outputs/bundle/release/app-release.aab` prima in un
   **test interno**. Da provare su un telefono vero: trasloco dati dalla
   vecchia app, notifiche ad app chiusa e dopo un riavvio, link condivisi.
4. **Scheda Play**: aggiorna la sezione "Sicurezza dei dati": statistiche
   anonime solo con consenso, nessun dato personale raccolto. Dichiara anche
   il permesso `SCHEDULE_EXACT_ALARM` (sveglia del piano sonno).
5. `/.well-known/assetlinks.json` serviva solo alla TWA. Toglilo **dopo**
   che l'aggiornamento è arrivato alla maggior parte degli utenti.
