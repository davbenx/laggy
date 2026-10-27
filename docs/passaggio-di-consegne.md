# Passaggio di consegne: Notturnisti (repo `davbenx/laggy`)

Testo da dare al nuovo agente. Data dell'ultimo stato: sabato 24 ottobre 2026, sera.

## 0. Come lavorare con l'utente (regole permanenti)
- **Lingua:** italiano. Risposte concise, basate su prove, con livello di confidenza e incognite dichiarate.
- **Principi del prodotto:** lean, pulito, accessibile, robusto, senza doppioni né disordine. UI di qualità, in stile ibrido Android/iOS e coerente con l'app.
- **Preferenze dell'utente:**
  - Ragionare dai primi principi.
  - Separare fatti e ipotesi.
  - Indicare effetti di secondo e terzo ordine.
  - Ritardare le decisioni irreversibili.
  - Dare raccomandazioni, non elenchi di opzioni.
  - Non fingere certezze.
- **Mai chiedere** token, chiavi o password in chat.
- **Mai** scrivere identificativi di modello in commit, PR o codice.
- **Chiarezza sui test:** se un test fallisce, dirlo con l'output. Se un passaggio è saltato, dirlo. Quando una cosa è fatta e verificata, dirlo senza giri di parole.

### Flusso autorizzato in modo permanente
- Si sviluppa sulla branch `claude/app-notturni-native-conversion-og0b2p` (mai su altre).
- Si fa commit e push (`git push -u origin <branch>`, con ritentativi se la rete cade).
- Si apre la PR verso `main` **solo per lavori che l'utente ha chiesto**.
- Si aspetta la CI (Workers Builds, `e2e (30)`, `e2e (35)`). Se verde, merge **squash**.
- Dopo il merge si riallinea la branch: `git fetch origin main && git checkout -B claude/app-notturni-native-conversion-og0b2p origin/main && git fetch origin claude/app-notturni-native-conversion-og0b2p && git push --force-with-lease -u origin claude/app-notturni-native-conversion-og0b2p`.
- Per Android, dopo il merge si lancia il workflow `android-release.yml` su `main` con `version_name`.

### Trailer dei commit (sempre)
```
Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01R7d13vswTViiovv4LeTsYc
```

### Corpo delle PR
Finisce con `🤖 Generated with [Claude Code](https://claude.com/claude-code)` e, su una riga a parte, il link di sessione `https://claude.ai/code/session_01R7d13vswTViiovv4LeTsYc`.

### Altre regole
- Non creare PR se non richieste.
- Non spingere commit vuoti né riscrivere la storia di altri.
- Un solo rilancio di CI, e solo per guasti di infrastruttura.
- Il hook di fine turno pretende che le modifiche non committate siano committate e pushate.

## 1. Il progetto
**Notturnisti** è un pianificatore gratuito e senza account per chi lavora a turni (soprattutto notti) in Italia: dice quando dormire, il caffè, la luce, i pisolini, il rischio di fatica.

- **PWA:** `app.notturnisti.club`. Deploy automatico da `main` con Cloudflare Workers Builds. Funzioni server in `functions/` (statistiche anonime, ecc.).
- **App Android:** guscio Capacitor 8 in `app/`, `applicationId club.notturnisti.app`. È in **test chiuso su Google Play** (12 tester).
  - L'utente carica a mano l'AAB in Play Console.
  - **Non può installare APK**, solo AAB.
  - Play rifiuta un `versionCode` già usato.
- **Sito marketing:** `notturnisti.club` (altro repository, non toccato).
- **Segreti:** esistono come secrets del repository (`ANDROID_UPLOAD_KEYSTORE_B64`, `ANDROID_UPLOAD_STORE_PASSWORD`, `ANDROID_UPLOAD_KEY_ALIAS`, `ANDROID_UPLOAD_KEY_PASSWORD`). Non servono credenziali all'agente: si usano i workflow.

## 2. Accessi e strumenti dell'agente
- **Directory di lavoro:** `/home/user/laggy` (cloud, effimera). Scratchpad: `/tmp/claude-0/-home-user-laggy/958c2276-f9c0-53f1-9d3f-b1fdc56fcc0b/scratchpad`.
- **GitHub:** solo tramite gli strumenti MCP `mcp__github__*`. Non c'è `gh`.
  - Per i controlli sulle PR usare `pull_request_read` con `get_check_runs`.
  - Per i workflow usare `actions_run_trigger`, `actions_list` (`list_workflow_runs`, `list_workflow_jobs`, `list_workflow_run_artifacts`), `actions_get` e `get_job_logs` (con `return_content: true`).
  - Le immagini o i file di un artifact si scaricano con `actions_get` + `download_workflow_run_artifact` (restituisce un URL temporaneo, un minuto o poco più), poi `curl -L` verso quell'URL e `python3 -m zipfile -e`.
- **Invio file all'utente:** `SendUserFile`.
- **Proxy:**
  - Ogni accesso HTTPS passa dal proxy locale.
  - **Maven Central limita le richieste (429)**; Gradle lo mostra come «Could not find…».
  - Il comando `curl -sI` stampa il CONNECT del proxy (200), non lo stato vero: usare `-w '%{http_code}'` con GET.
- **Playwright/Chromium** sono già installati (`PLAYWRIGHT_BROWSERS_PATH`). I test UI usano `tests/ui/_pw.mjs`.
- **Sandbox bash:**
  - `pkill -f` con pattern che compaiono nella propria riga di comando uccide la shell (exit 144).
  - Un `rm -rf` con glob dopo un `cd` viene bloccato dal controllo di sicurezza.
  - Il comando `sleep` lungo in primo piano è bloccato (usare `timeout 280 bash -c 'for i in $(seq ...); do sleep 10; done'`).

### ATTENZIONE: la cache Gradle locale è danneggiata
Ho usato `--refresh-dependencies` contro Maven Central rate-limitato. Dopo aver fatto così, `./gradlew` locale **non risolve più** alcune dipendenze (kotlin-stdlib, commons-io…). **Non rifarlo.** Compilare e provare Android **solo in CI**. Si può provare a ripristinare dopo 24 ore o con un `GRADLE_USER_HOME` nuovo, ma non è necessario.

## 3. Struttura dei file (cosa fa ciascuno)

### Web (radice del repo)
- `index.html` (~10.5k righe): tutta l'interfaccia, in un modulo inline.
- `engine.js`: motore del piano (giorno, sonno, turni, eventi; `buildEvents`, `codeAt`, `block`, `plan`). **Legge `state.ecc` (scambi) e `state.giorni` (ferie, malattia, orari di un giorno).**
- `alertness.js`: modello circadiano/omeostatico (`alertness`, `finestreAttivita`, `finestreDelPiano`, `window.NTAlert`).
- `notifications.js`: `buildSchedule` (tipi di notifica, id: rischio 980000+, momenti 970000+).
- `platform.js`: ponte con Capacitor (`platform.widget`, `calendar`, `alarm`, `notify`, `dispositivo`…).
- `importa.js`, `analytics.js`, `sw.js`.
- `functions/_analytics.js` e `functions/stats.js`: statistiche anonime e pannello (etichette `SAP` per i suggerimenti).
- `privacy/`, `termini/`, `licenze/`.
- `docs/prossimo-aggiornamento.md` (to-do e piani), `docs/play/scheda.md` (scheda Play e note di versione), `docs/play/lancio.md`, `docs/stile.md`.

### Android (`app/`)
- `app/www`: costruita da `npm run build:web` (copia dei file web).
- `app/android/app/src/main/java/club/notturnisti/twa/`:
  - plugin: `MainActivity`, `WidgetPlugin` (PREFS `nt_widget`, KEY `timeline`, `risposte`, `count`, `pin`), `AlarmPlugin` (NTAlarm), `PrintPlugin`, `ReviewPlugin`, `DevicePlugin` (impronta del telefono per il backup);
  - widget: `NotturnistiWidget`, `WidgetStato`, `WidgetPiano`, `CalendarioModel`, `CalendarioWidget` (vedi sezione 5).
- Risorse widget in `res/layout/widget_piano.xml`, `res/drawable/widget_*`, `res/values{,-night}/widget_colori.xml`, `res/xml/widget_piano_info.xml`, `res/values/strings.xml`.
- Backup Android: `res/xml/backup_rules.xml` e `data_extraction_rules.xml`.
- `app/capacitor.config.json` deve mantenere `"webContentsDebuggingEnabled": false`.
- Test JVM in `app/android/app/src/test/java/club/notturnisti/twa/`: `WidgetStatoTest`, `WidgetPianoTest`, `CalendarioModelTest`. In `build.gradle` c'è la dipendenza di test `org.json:json:20231013`.

### Test
- **Unitari JS:** `node --test tests/*.test.js` (91 test, tutti verdi). Esempio: `tests/giorni.test.js`, `tests/notifiche.test.js`, `tests/attivita.test.js`.
- **UI:** `tests/ui/run.sh` (circa 65 suite Playwright).
  - Senza argomenti lancia tutto (circa 30 minuti).
  - Con nomi lancia solo quelle: `tests/ui/run.sh widget novita coppia`.
  - Avvia due server (porte 8765 per il sito, 8766 per `app/www`) e imposta il fuso in modo che adesso sia circa mezzogiorno.
  - Se un server avviato a mano occupa le porte, i test usano quello (ricordarsene dopo `run.sh`: i server si spengono).
  - Un test che si interrompe viene segnalato.
  - Il popup «Novità» non appare nei test automatici (`navigator.webdriver`), salvo con `localStorage nt:novitaProva`.
- **Verifica:** `tests/verifica/{app,turni,giorno}.mjs` (matrice giorni, notti, cambio d'ora).
- **Preferenza di test:** orologio fisso di Playwright (`page.clock.setFixedTime`); i test che usano l'ora reale falliscono a certe ore/giorni (due casi già corretti: `giorni.test.js` il sabato, e il widget a mezzanotte).

### Strumenti e CI
- `.github/workflows/android-e2e.yml`: CI delle PR (emulatore API 30 e 35).
- `.github/workflows/android-release.yml`: AAB firmato per Play.
  - Si lancia a mano con `version_name`.
  - **`versionCode` = numero della run.**
  - Esegue anche le prove Java (`testDebugUnitTest`).
  - Artifact `notturnisti-aab`.
- `.github/workflows/android-debug.yml`: APK di prova (artifact `notturnisti-apk`). L'utente non può installarlo.
- `.github/workflows/anteprima-widget.yml` + `tools/anteprima-widget/` (Paparazzi 1.3.5, Kotlin 2.0.21, AGP 8.13.0, compileSdk 35):
  - disegna il widget vero in chiaro e scuro, a 7 altezze (80, 130, 190, 256, 330, 460, 560 dp), in 7 situazioni;
  - carica le PNG come artifact `anteprima-widget`: una tavola per situazione e tema, più le singole immagini;
  - copia a runtime le risorse e le 5 classi del widget, quindi va **rilanciato a ogni modifica del layout**;
  - si lancia con `workflow_dispatch` (anche con `ref` = la branch).

## 4. Cosa è stato fatto (in ordine logico)

### 4.1 Giorno, notti, striscia, cambio d'ora
- Modello «da risveglio a risveglio»: `giornoVero()`. Dopo un turno di notte resta «Ancora venerdì…» fino al risveglio.
- Aggiornamento ogni minuto e al ritorno in primo piano (`rinfrescaGiorno`).
- Cambio d'ora: riga «Cambio d'ora» nel giorno e «Mancano» in ore vere.
- Correzioni recenti dal telefono dell'utente (PR #149):
  - il Rientro (90 minuti dopo il turno) ora finisce all'inizio del sonno pianificato;
  - la linea «ora» della timeline sta dopo ogni voce già cominciata;
  - l'etichetta «Domani» del sonno nel giorno vissuto usa la data vera («Oggi»/«Stanotte»).

### 4.2 Funzioni dell'app
- Timeline di Oggi; voci facoltative in «Cosa vedi nel piano» (essenziali: Dormi, Turno, Pisolino, Ultimo caffè, Rientro; facoltative: Luce, Penombra, Pasti, Tempo libero default on; i 3 momenti migliori default off).
- Momenti migliori (testa, movimento, allenamento) in timeline, in «Adesso» e come notifica facoltativa.
- Sveglia nell'Orologio (`AlarmPlugin`).
- Riepilogo del mese e dei 12 mesi condivisibile.
- Backup Android con impronta del telefono (azzera calendario e widget se i dati arrivano da un altro telefono).
- Importazione (calendario/file).
- Festivi del contratto, ferie.
- Suggerimenti d'uso «Lo sapevi?»: tip `festivi`, `dormi`, `acasa`, `sveglia`, `votowidget`, `widgetmese`, `coppia`, `momenti`, `riepilogo`, con statistiche (`SAP` in `functions/stats.js`).
- Popup «Novità» (`NOVITA` in `index.html`):
  - compare una volta dopo l'aggiornamento, non al primo uso, non sopra altri fogli;
  - si riapre da Impostazioni › Novità;
  - si aggiorna a mano a ogni versione (cambiare `id`, `data`, `righe`; la riga con terzo elemento `true` è solo-app);
  - non verificare su un dispositivo automatizzato.

### 4.3 Persone
- La persona con la stellina (`state.personaGlance`) compare nella striscia di Turni:
  - sigla accanto alla tua (intestazioni «Tu» e iniziale), turno come filo verde sotto la barra;
  - la legenda la nasconde (`state.piano.persona === false`).
- «Modifica» una persona (lo stesso modulo precompilato); l'elenco mostra sonno e se segue i tuoi turni.
- «I tuoi stessi turni» ora **copia** i tuoi orari di adesso (prima li seguiva).
- **Bug corretto** (PR #152): `asPartner` ora azzera `state.ecc` e `state.giorni` durante il calcolo, perché prima i tuoi scambi, ferie e orari di un giorno cambiavano anche i turni della persona seguita (striscia, ore libere, calendario di coppia, widget).
- Calendario di coppia (app): invito «Attiva» sotto la lista delle persone, tip `coppia`, interruttore spostato sopra «Condividi».
- Testo del bottone: «Manda il tuo link e chiedi il suo».

### 4.4 Segna i giorni
Un turno con orari diversi non ha più il segno arancione della reperibilità: ha un trattino scuro e la voce «orari diversi» in legenda.

### 4.5 Eventi del calendario/widget partono da ieri
Il sonno e il rientro dopo una notte stanno nel piano del giorno prima. `eventiCalendario()` ora costruisce da ieri e scarta gli eventi già finiti prima di oggi.

## 5. Il widget (ripensato da zero, in produzione solo come AAB 1.3.1)

### Concetto
Parte minimale e aggiunge un pezzo per volta con l'altezza (`WidgetPiano.calcola`).

| Altezza crescente | Si aggiunge |
|---|---|
| sempre | «Adesso/Prossimo» |
| se in corso | barra di progresso |
| poi | **pulsante del momento** |
| poi | prima voce |
| poi | calendario, prima riga |
| poi | seconda voce |
| poi | altre settimane, fino a 5 |

### Pulsante (`WidgetStato`, uno alla volta, nell'ordine)
1. Voto del sonno e poi dell'energia, dalla sveglia per 14 ore, finché non c'è risposta.
2. «Metti la sveglia · HH:MM» da 4 ore prima del sonno (o 30 minuti prima di un pisolino); apre l'Orologio.
3. «A letto 03:10 → 09:55» fino a 12 ore prima.
4. «Pisolino 19:05 → 19:50» fino a 3 ore prima.

Le voci sotto non ripetono quella già nel pulsante e sono in ordine di ora; il prossimo turno c'è sempre.

### Calendario (`CalendarioModel`, `CalendarioWidget`)
- Settimane dal lunedì; i giorni passati più tenui; oggi su un tondo.
- Sotto la tua sigla quella della persona con la stellina, in verde acqua.
- Il nome della persona (chip) è un tasto: successiva › nascosta › prima. Preferenze `pers_<id>` e `star_<id>` in SharedPreferences `nt_widget`; se la stellina cambia nell'app, si riparte da lei.
- Tocco su un giorno: `notturnisti://giorno/AAAA-MM-GG`.

### Dati pubblicati dalla pagina (`ntWidget()` e `meseWidget()` in `index.html`)
`voci`, `turno`, `diario`, e `mese = {da: lunedì, io:[«sigla:tipo»×42], p:[{n, g:[…]}] (max 4, stellina dentro), sel, star}`. La striscia `giorni` di 7 giorni è stata eliminata.

### Misure
- Costanti in `WidgetPiano`: MARGINI 28, ADESSO 46, BARRA 10, PULSANTE 50, PRIMA_VOCE 30, VOCE 24, TESTA_CAL 50, RIGA 44, RIGA_PERSONA 62.
- `ALTEZZA_VERA` 1.05: i launcher riportano un'altezza più bassa del vero (15-25% misurato su due screenshot).

### Verificato
L'anteprima mostra layout, colori e stati come progettati. Un solo difetto trovato (riga tagliata a circa 4 righe) è stato corretto ricalibrando le misure.

### Non verificato sul telefono
- Quanto il launcher dell'utente riporta l'altezza (l'unica cosa che l'anteprima non può dire).
- Se tra 3 e 4 righe resta spazio vuoto in fondo.
- Il tocco su «Metti la sveglia» (usa `AlarmClock.ACTION_SET_ALARM` senza `EXTRA_SKIP_UI`: l'Orologio chiede conferma; il widget non sa se la sveglia c'è già).
- Le risposte del voto dal widget.

### Seam di test
`NotturnistiWidget.senzaIntent` (solo per l'anteprima): evita i `PendingIntent` sulla JVM.

## 6. Stato delle release e dei PR (al momento della consegna)
- **`main` = `a46c8d0`** (PR #155 unito). Branch di lavoro allineata a `main`.
- Tutte le PR aperte sono state unite: l'ultima è la #155. Nessuna PR aperta.
- **Release Android:**
  - Run #14 = 1.2.2 (con la correzione «dormi dopo il turno»).
  - Run #15 = 1.2.3.
  - Run #16 = 1.2.4 (widget a righe).
  - Run #17 = 1.3.0 (widget nuovo, misure vecchie).
  - **Run #18 = 1.3.1, da caricare** (misure ricalibrate), codice di versione 18: <https://github.com/davbenx/laggy/actions/runs/40130214649>.
  - L'utente ha avuto più volte l'errore «codice di versione 9 già utilizzato» perché caricava un AAB vecchio: ogni volta che si genera un AAB nuovo va ripetuto di scaricare l'artifact della run giusta e di non riusare file vecchi.
- Note di versione per Play (max 500 caratteri) in `docs/play/scheda.md` (prima riga ancora «1.3.0»: aggiornare a 1.3.1 al prossimo giro).
- Stato di caricamento su Play: non confermato. Chiedere all'utente se ha caricato la 1.3.1.
- Un avviso ricorrente da Play Console (non indagato): triangolo giallo per Telefono, Tablet, TV, Auto, Chromebook, Android XR sui dispositivi supportati (confronto con le release precedenti, probabile effetto del test chiuso con pochi utenti).

## 7. Aperto / da fare

### Richiesto dall'utente e non concluso
1. **Verifica sul telefono** del widget 1.3.1 (l'utente non ha ancora dato riscontro). Se serve una correzione: modificare, rilanciare «Anteprima widget», guardare le immagini, preparare un nuovo AAB.
2. **Icona dell'app** (richiesta in corso):
   - Gli ho dato due bozze SVG (A piatta su crema, B viso su blu; in `/tmp/claude-0/…/scratchpad/logo/`, effimere) e un prompt per un'IA di immagini.
   - L'utente ci caricherà i file generati.
   - Sostituire in: launcher Android (`res/mipmap-*`, `ic_launcher_foreground`, `drawable/ic_launcher_monochrome.xml`, `values/ic_launcher_background.xml` crema `#F7F3EA`), icone web (`icon-180/192/512/maskable`, `owl-mark.png`), `docs/play/img/icona-app-512.png`.
   - Regola Android: l'icona adattiva ha una zona sicura di circa il 66% centrale.
3. **Popup «Novità»:** implementato. A ogni versione con novità visibili aggiornare `NOVITA` (id, data, righe) in `index.html`.

### Piani documentati in `docs/prossimo-aggiornamento.md`
- **Sul telefono vero (senza codice):** sveglia nell'Orologio, voto dal widget, ritorno in primo piano dopo ore, schermata dopo lo smonto, riga «Cambio d'ora» (domenica 25/10), ripristino da backup, statistiche `sveglia_messa`, `diario_widget`, `voce_*`, `festivi_*`.
- **Health Connect per il sonno** (dopo l'approvazione in produzione): piano in 7 passi. Opzionale, locale, solo lettura (`READ_SLEEP`), plugin `NTHealth`.
- **Idee in ordine di valore:** importazione da foto/PDF del foglio turni (OCR locale), conti per la busta paga e controlli sui riposi (da validare con un esperto), inglese/i18n (testi traducibili e festivi per paese), app iPhone, riepilogo annuale, Club in app con Play Billing, Wear OS.
- Non fare: account, sincronizzazione su server, funzioni sociali.

### Note su idee discusse e scartate o rimandate
- Mostrare il sonno della persona nella striscia di Turni: rimandato (costa calcolo, rischio di affollare).
- ‹ › per i mesi nel widget: tolti (superati dalla struttura a settimane).

### Statistiche da guardare
Nel pannello analytics: `sveglia_messa`, `diario_widget`, `voce_*`, `sapevi_*` (incluso `widgetmese` e `coppia`), `festivi_*`, `ferie_con`.

## 8. Trappole note (leggere prima di toccare)
- **Android build locale rotto** (sezione 2). Fare le prove in CI.
- Il widget non si può provare sul telefono dell'utente se non tramite AAB caricato su Play (test chiuso). L'anteprima su computer è l'unico modo di vedere il layout. Se si cambia il layout o `WidgetPiano`, rilanciare «Anteprima widget» e guardare le immagini.
- **Notte del cambio d'ora (25 ottobre 2026):** le durate reali differiscono di un'ora; il test JVM `WidgetStatoTest` lo prevede. Attenzione a ogni test che confronta ore su quella data.
- I test UI che usano l'ora reale si comportano diversamente a certe ore (dopo mezzanotte UTC, o il sabato per le date relative). Preferire sempre l'orologio fisso.
- `asPartner` imposta `state.repeat=true` e ora azzera `ecc`/`giorni`: qualunque nuova funzione che calcola turni di altre persone deve passare da lì.
- `salva()` ha un elenco esplicito di chiavi: ogni nuova chiave persistente va aggiunta lì e nella firma di configurazione (`_cfgSig`) se deve riarmare notifiche, calendario o widget.
- Il progetto usa `store.get/set` (prefisso `nt:` in localStorage).
- Il piano del widget e quello dell'app derivano dallo stesso motore: non duplicare mai la logica dei turni in Java (i dati arrivano già calcolati dalla pagina).
- PR senza modifiche all'app (solo test o strumenti) non fanno partire `e2e`: basta il controllo Workers Builds.
- Un workflow nuovo si può lanciare solo se esiste su `main`; per provare una modifica a un workflow esistente si può lanciare con `ref` = la branch.

## 9. Primo passo suggerito al nuovo agente
1. Chiedere all'utente: (a) ha caricato l'AAB 1.3.1 (run #18)? (b) cosa vede sul widget? (c) ha già i file della nuova icona?
2. Leggere `docs/prossimo-aggiornamento.md` e `git log --oneline | head -20` per allinearsi.
3. Non iniziare lavori nuovi senza richiesta: la lista aperta è quella della sezione 7.
