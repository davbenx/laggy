# App nativa (Android → iOS): notifiche, calendario, widget

Stato (2026-10-15): fasi 1–4 fatte nel codice per Android (notifiche native, calendario nativo, widget, trasloco dati). Manca la prova su un telefono vero e il rilascio sullo store (`app/README.md`). Fase 5 (iOS) da fare.

## 1. Problema

Le tre cose più utili (notifiche puntuali, calendario sempre allineato, widget)
sono proprio quelle che una PWA o una TWA non riesce a fare bene. Il limite
viene dalla piattaforma: non si risolve rifinendo il codice attuale.

| Funzione | Oggi in produzione | Perché è fragile |
|---|---|---|
| Notifiche | `sw.js`: `setTimeout` dentro il service worker, più `periodicsync` | Chrome chiude un SW inattivo dopo circa 30 s (5 min al massimo), e i timer muoiono con lui. In pratica le notifiche arrivano solo se l'app è stata aperta da poco. `periodicsync` riarma lo stesso piano, ma i tempi li decide il browser (≥12 h, basati sull'engagement) e non esiste su iOS né su Firefox. |
| Calendario | `/account` salva la config in chiaro nel KV, poi `/feed/<id>` genera un ICS di 42 giorni e il calendario lo ripolla | Google Calendar ripolla ogni 8–24 h e più: una modifica ai turni arriva in ritardo. Inoltre un server tiene i turni in chiaro, in contraddizione con il README ("never your shift times in the clear"). Servono KV, rate limit e CORS solo per questo. |
| Widget | Nessuno | Né la PWA né la TWA li supportano. |

## 2. Principio guida

**La config cambia solo dentro l'app.** Quindi il modello giusto è *push-on-change*
in locale, non *poll* da un server. Ogni volta che la config cambia (e a ogni
avvio), l'app ricalcola con lo stesso `engine.js` e scrive nelle tre API native
del telefono:

```
config cambiata / app aperta / riavvio
        │
        ▼
engine.js (invariato) ──► buildEvents(giorni)   ← estratto da buildIcs
        │
        ├─► LocalNotifications.schedule()   (sistema operativo: AlarmManager / UNUserNotificationCenter)
        ├─► Calendar: sostituisce gli eventi nel calendario "Notturnisti"  (CalendarContract / EventKit)
        └─► Widget: snapshot JSON con timeline precalcolata           (SharedPreferences / App Group)
```

Nessun server, nessun account, zero dati fuori dal dispositivo. I dati
restano sul telefono, esattamente come promette il README.

## 3. Scelta dello stack: Capacitor (bundle locale)

| Opzione | Riuso del codice | Notifiche/cal/widget | Costo | Verdetto |
|---|---|---|---|---|
| **Capacitor 8**, web bundlato nell'APK/IPA | ~100% (`index.html` e `engine.js` così come sono, nessun build step) | Plugin maturi per notifiche e calendario. Widget: poco codice nativo | Basso | ✅ **scelta** |
| TWA attuale + codice nativo aggiunto | 100% | La TWA gira in Chrome: niente bridge JS→nativo, niente widget con dati | Medio, fragile | ❌ |
| React Native / Flutter / KMP | ~0% UI, engine da portare o da incapsulare | Pieno | Riscrittura di una UI di circa 480 KB | ❌ |

Due dettagli di Capacitor che contano:
- **Bundlare il web nell'app** e non caricarlo da `app.notturnisti.club`.
  Così l'app funziona offline dal primo avvio, non dipende dalla rete e
  riduce il rischio di rifiuto sull'App Store: un wrapper di un sito remoto
  rischia la guideline 4.2 ("minimum functionality"). Il costo è che gli
  aggiornamenti passano dagli store. Non introdurre "live update" OTA:
  sarebbe superficie in più senza un bisogno reale.
- `sw.js` e il `periodicsync` non servono nel build nativo. Restano solo per la
  versione web.

## 4. Design delle tre funzioni

### 4.1 Notifiche: `@capacitor/local-notifications`

- `notifications.js#buildSchedule` è già scritto per questo: in fondo al file c'è
  già il ponte Capacitor commentato. Va riusato quasi com'è.
- **Android**
  - Canali: `sveglie` (importanza alta, suono) e `promemoria` (normale). L'utente
    li regola dalle impostazioni di sistema, senza UI da mantenere.
  - Finestra di **21–28 giorni** (Android 12+ ha un tetto di circa 500 allarmi
    per app; ~6 al giorno × 28 ≈ 170). Le notifiche le arma il sistema
    operativo, quindi sopravvivono all'app chiusa e al riavvio (il plugin ha
    un receiver di boot che le ripristina).
  - **Allarmi esatti**: dichiarare `SCHEDULE_EXACT_ALARM` (su Android 14+ è
    negato di default e va concesso dall'utente) e controllarlo con
    `checkExactNotificationSetting()`. Chiederlo solo a chi attiva la "Sveglia".
    Per bedtime, caffè e pisolino gli allarmi inesatti bastano (qualche minuto
    di scarto). **Non** usare `USE_EXACT_ALARM`: Play lo riserva alle app
    sveglia/calendario come funzione principale, e c'è rischio di rifiuto in
    review.
  - Doze: con `allowWhileIdle` il limite è circa 1 notifica ogni 9 min per app.
    Non è un problema con ~6 eventi al giorno, ma bisogna evitare eventi a
    distanza di meno di 10 min.
- **iOS**: tetto rigido di **64** notifiche in coda, quindi finestra di circa 8–10
  giorni. Come *ultima* notifica della finestra, se l'utente non ha aperto l'app,
  va messa "Apri Notturnisti per continuare i promemoria". È un fallback
  deterministico, a differenza di `BGAppRefreshTask`, i cui tempi li decide iOS.
- **Posizionamento della sveglia**: resta un *promemoria*, non sostituisce la
  sveglia di sistema. Farla diventare una sveglia vera (che suona in silenzioso
  o in DND) su iOS richiede entitlement/AlarmKit e su Android una full-screen
  intent con policy dedicate: complessità e rischio di review sproporzionati
  per la v1. Il testo in-app lo deve dire in modo onesto.

### 4.2 Calendario: `@ebarooni/capacitor-calendar` (Android + iOS, Capacitor 8)

- Crea **un calendario dedicato "Notturnisti"** (`createCalendar`) e lo
  aggiorna in modo idempotente: `listEventsInRange` → `deleteEventsById` →
  `createEvent` per ogni evento. Gli id restano salvati in locale, così la
  sincronizzazione non tocca mai gli eventi dell'utente.
- Il calendario *di coppia* si calcola già in locale: `buildCoupleFeed` usa
  `cfg.pPattern` e `cfg.pAnchor`, che stanno nella stessa config. Diventa un
  secondo calendario locale "Notturnisti · insieme", senza nessun server.
- **Default: calendario locale sul dispositivo**. Su Android serve un account
  `LOCAL`, che non viene sincronizzato con Google, ed è la scelta più rispettosa
  della privacy. Come opzione si può scegliere un calendario esistente (per
  esempio Google): gli eventi arrivano anche sul PC tramite il sync del sistema,
  per scelta esplicita dell'utente.
- Permesso `WRITE_CALENDAR` (Android) / accesso completo agli eventi (iOS 17+).
  Va chiesto solo quando l'utente tocca "Sincronizza col calendario".
- Modifica necessaria in `engine.js`: estrarre da `buildIcs` una
  `buildEvents(days)` che restituisca `[{uid, start, end, title, desc, alarms}]`.
  `buildIcs`/`buildFeed` diventano un semplice serializzatore di quella lista.
  Una sola fonte di verità per ICS, calendario nativo e test.

### 4.3 Widget: poco codice nativo, nessuna logica duplicata

- Il JS calcola una **timeline** (per esempio le prossime 48 h: `[{at, titolo,
  sottotitolo, prossimo}]`) e la salva come JSON:
  - Android: `@capacitor/preferences`, che scrive le `SharedPreferences`
    (`CapacitorStorage`) leggibili dal widget, più un plugin di ~20 righe per
    `AppWidgetManager.updateAppWidget`.
  - iOS: App Group `UserDefaults` e `WidgetCenter.reloadAllTimelines()`.
    Serve un plugin minimo, o `capacitor-widgetsbridge-plugin`.
- Il widget **non calcola nulla**: sceglie la voce corrente in base all'ora.
  iOS WidgetKit usa `TimelineProvider` con le entry già pronte, che è
  esattamente questo modello. Su Android: Glance (Kotlin), con
  `updatePeriodMillis` ≥ 30 min più un aggiornamento puntuale su ogni cambio
  di config.
- Stima: circa 150 righe di Kotlin più circa 150 di Swift. È l'unico pezzo con
  codice nativo vero.

## 5. Cosa sostituire e cosa spegnere

| Componente | Nel build nativo | Nel web (PWA) |
|---|---|---|
| `sw.js`: timer, periodicsync, IndexedDB `nt-sw` | non usato | rimuovere i timer. Le notifiche web non sono affidabili: meglio non prometterle, mostrare "Installa l'app per i promemoria" (su Android) e lasciare il SW solo per l'offline |
| `/account`, `/config`, `/feed`, `/couple`, KV `SUBS` | non usati | **congelare** (niente nuovi account) finché non esiste l'app iOS: gli utenti iPhone oggi dipendono dal feed. Poi fare il sunset e cancellare il KV (GDPR: i dati vengono davvero eliminati) |
| `paid.js`: flusso feed/account | nascosto | invariato fino al sunset |
| Link "offrimi un caffè" | **nascosto** | invariato |

Motivo per nascondere il link donazioni nel nativo: Apple (3.1.1) e, in parte,
Google Play limitano i pagamenti o le mance fuori dai loro sistemi per il
contenuto digitale. Nasconderlo è l'opzione più lean e a rischio zero.
*Da verificare* se in futuro si vuole monetizzare nell'app.

## 6. Rischi e mitigazioni

1. **Perdita dei dati alla migrazione da TWA a Capacitor (il rischio più
   grave).** La TWA salva `localStorage` nel profilo di Chrome, mentre Capacitor
   usa il proprio WebView: sono storage separati anche con lo stesso hostname.
   Aggiornare il package `club.notturnisti.twa` in place farebbe ripartire gli
   utenti a vuoto (turni e diario).
   Mitigazione: al primo avvio con storage vuoto, un pulsante apre
   `https://app.notturnisti.club/?export=app` in Chrome. La pagina serializza e
   comprime lo stato e fa un redirect a `notturnisti://import#<payload>`. Il
   payload sta nel fragment e non tocca mai un server. È locale e usa lo stesso
   principio dei link di ripristino che esistono già. Va testato prima del
   rilascio su utenti reali.
2. **Package e firma**: mantenere `club.notturnisti.twa` e la stessa chiave
   (Play App Signing) in modo da fare un aggiornamento e non una nuova app.
   Si perde recensioni/installazioni solo cambiando package. Il suffisso "twa"
   è cosmetico.
3. **Frammentazione OEM sulle notifiche** (Xiaomi, Huawei, Samsung "sleeping
   apps"): gli allarmi possono venire uccisi. Mitigazione: una schermata
   "Notifiche non arrivano?" con il link alle impostazioni batteria, più
   una notifica di test.
4. **Due versioni (web e nativa) da mantenere**: `index.html` deve restare unico.
   Si introduce un solo modulo `platform.js` con
   `notify.schedule / calendar.sync / widget.publish` e due implementazioni
   (web e Capacitor), scelte con `Capacitor.isNativePlatform()`. Il resto del
   codice non sa su quale piattaforma gira.

## 7. Piano incrementale (ogni passo si rilascia da solo)

1. **Refactor senza rischio sul web**: `buildEvents()` in `engine.js` con i test in
   `tests/`, più `platform.js` con l'implementazione web uguale al
   comportamento attuale.
2. **Shell Capacitor Android** (bundle locale), migrazione dati (§6.1), notifiche
   native. Rilascio sul Play Store come aggiornamento della TWA, prima in un
   test track interno.
3. **Calendario nativo** e congelamento di `/account` (niente nuovi feed).
4. **Widget Android**.
5. **iOS**: stesso codice e plugin, più widget Swift. Poi sunset di
   `/feed`/`/couple`/`/config` e cancellazione del KV.

## 8. Confidenza e incognite

- Alta: diagnosi del SW, fattibilità di Capacitor con plugin per notifiche e
  calendario, tetto di 64 su iOS, allarmi esatti su Android 14.
- Media: comportamento reale dei widget con aggiornamento a ≥30 min (da
  verificare su dispositivo), policy Play sulle donazioni.
- Da decidere: default calendario locale oppure Google; se e quando spegnere
  il feed ICS per gli utenti solo web (desktop, iPhone senza app).

## 9. Statistiche d'uso (fatto)

Servono a decidere con i dati: per esempio quando spegnere il feed ICS (§2 della
raccomandazione) e dove si perdono le persone nell'onboarding.

- **Raccolta**: `analytics.js` → `POST /collect` (`functions/collect.js`). Il
  server salva solo **contatori per giorno** in D1 (`counts(day, event, prop, n)`).
  Non salva IP, user-agent, id, cookie né orari. L'elenco degli eventi ammessi
  è identico su client e server, e un test lo verifica. I valori liberi vengono
  scartati.
- **Feed ICS**: `/feed` e `/couple` contano letture e feed *distinti* per
  giorno. Per i distinti si usa un hash troncato dell'id, cancellato dopo 90
  giorni.
- **Opt-in** (dal 2026-09-23): spente finché la persona non dice sì. La card
  "Ci aiuti a capire cosa migliorare?" compare una volta sola, dalla seconda
  sessione, con due bottoni dello stesso peso; la scelta si cambia in
  Opzioni. Senza consenso `analytics.js` non manda e non scrive niente, e
  cancella le chiavi scritte dal vecchio modello opt-out. DNT e GPC valgono
  come un no.
- **Visualizzazione**: `https://app.notturnisti.club/stats#t=<STATS_TOKEN>`.
  La pagina mostra gli indicatori principali, i dispositivi attivi al giorno,
  il percorso principale, gli abbandoni nell'onboarding, le piattaforme, i
  ritorni e i calendari vivi, più la tabella completa.
- **Attivazione** (fatta il 2026-10-15): il database D1 `notturnisti-stats`
  lo crea Wrangler al deploy (provisioning automatico, nessun ID nel repo).
  La pagina è protetta da un codice di cui il repo conosce solo l'impronta
  SHA-256 (`STATS_TOKEN_SHA256` in `wrangler.jsonc`). Per cambiarlo: nuova
  stringa casuale, `sha256sum`, sostituire l'impronta.
- Le anteprime dei branch usano lo stesso database: i loro eventi (pochi,
  solo di chi le prova) finiscono nei totali.
- **Limiti**: sono conteggi di eventi, non di persone (non ci sono id per
  deduplicare). "Dispositivi attivi" è l'unico numero che approssima le
  persone: un dispositivo conta al massimo una volta al giorno. `/collect` è
  pubblico, quindi qualcuno potrebbe gonfiare i numeri: va bene per decidere
  una direzione, non per fatturare.

## 10. Analisi dell'app esistente: cosa è stato tolto o cambiato

| Dove | Problema | Intervento |
|---|---|---|
| Link condivisi, ripristino, feed (`index.html`, `paid.js`) | Nell'app nativa `location.origin` è `https://localhost`: i link mandati ai colleghi non si aprirebbero | Base assoluta `window.NT_APP.base` / `NT_CAL.origin` |
| API `/account`, `/config` | Il CORS accettava solo il sito, e `x-write-key` non era negli header ammessi (nessun problema sul web, perché la richiesta è same-origin) | Ammesse anche le origini Capacitor, più l'header `x-write-key` |
| Banner "Installa l'app" | Nell'app nativa non ha senso | `giaInstallata()` vale true nel nativo |
| Donazioni (nudge, link, `paid.js`) | Policy degli store sui pagamenti esterni | `NT_DONATE` non viene definito nel nativo, e tutto si nasconde da solo |
| Service worker | Nel nativo duplicherebbe le notifiche; l'offline è già garantito dal bundle | Non registrato nel nativo |
| "Esporta nel calendario" (file .ics da blob) e i relativi nudge | Nel WebView il download di un blob non funziona | Nascosti nel nativo. Il calendario nativo arriva con la fase 3 |
| Salvataggio credenziali in `.txt` (`paid.js`) | Stesso problema del blob | Nel nativo: copia negli appunti |
| Android web: "Importa in Google Calendar (.ics)" con lo stato "Sincronizzazione attiva" | Importa una **copia** di 42 giorni che non si aggiorna, mentre l'interfaccia dice che la sincronizzazione è attiva | Testo onesto: "Importa una copia…", con la spiegazione di cosa si aggiorna davvero |
| Nudge di scadenza ICS: "si aggiorna da solo, per sempre" | Promessa su un feed che prevediamo di spegnere | Tolto "per sempre" |
| Wizard: "sincronizzati in automatico ogni giorno" | Non è vero su Android con Google Calendar | Testo ridimensionato |
| Testo sotto "Promemoria" | Nel nativo le notifiche le programma il sistema, quindi il vecchio avviso non vale | Testo dedicato nel nativo |
| Backup: "in questo browser" | Non vale nell'app | Testo condizionale |
| `pattern_type` = sequenza reale dei turni, evento `pwa_prompt_shown` non ammesso | Dato ad alta cardinalità / evento perso | Categoria `ciclo` / `install_prompt_shown` |

Resta com'è: nudge di backup, condivisione, Club, primo piano, diario.
Da decidere quando l'app sarà sullo store: su Android web il banner
"Installa" dovrebbe portare al Play Store invece di installare la PWA.

## 11. Integrazione Android (2026-10-15)

| Cosa | Come |
|---|---|
| Barre di sistema | Con Android 15 l'app è a tutto schermo: il CSS usa il valore più grande tra `env(safe-area-inset-*)` e le `--safe-area-inset-*` iniettate da Capacitor (variabili `--sat`/`--sab`) |
| Colore delle icone di sistema | `SystemBars.setStyle` segue il tema effettivo (forzato chiaro, oppure quello del telefono) |
| Tasto indietro | Chiude dialoghi e pannelli, torna dal wizard e dalle schede a Oggi; da Oggi l'app va in secondo piano (`App.minimizeApp`) invece di chiudersi |
| Condivisione | `@capacitor/share`: pannello di sistema (WhatsApp ecc.). Sul web resta `navigator.share` o la copia negli appunti |
| Font | Inter e Noto Serif serviti dal sito e inclusi nell'app (woff2 latini, licenza OFL in `fonts/`). Niente più richieste a Google Fonts, anche sul web |
| Calendario nativo | `@ebarooni/capacitor-calendar`: calendario locale "Notturnisti" (account LOCAL, non va su Google), più "Notturnisti · insieme" per la coppia. Viene riscritto a ogni cambio, a ogni apertura e a ogni ritorno nell'app (la finestra di 42 giorni avanza), solo se gli eventi sono cambiati. Nessun promemoria sugli eventi: le notifiche dell'app bastano. Spegnendolo, i calendari vengono cancellati |
| Widget | `NotturnistiWidget.java` (RemoteViews, 4×2 ridimensionabile): mostra cosa vale adesso e le prossime due cose. La timeline delle 48 ore arriva già calcolata dalla pagina (`WidgetPlugin`, `platform.widget.publish`); il widget si ridisegna da solo al prossimo cambio con un allarme inesatto, senza permessi speciali |

## Test su Android (emulatore)

`app/scripts/test-android.sh` prepara un emulatore Android 11 (la prima volta
scarica emulatore e immagine), compila un APK di test con il debug del WebView
acceso e lancia `app/scripts/test-android.mjs`, che usa l'app come un utente e
legge i risultati da Android stesso:

- calendario «Notturnisti» nel database Calendario (account locale, visibile)
  e numero di eventi;
- allarmi programmati per le notifiche del piano (`dumpsys alarm`);
- la notifica di prova davvero mostrata (`dumpsys notification`);
- quello che l'app dice in Turni ("Nel telefono: N eventi…").

Senza KVM l'emulatore gira senza accelerazione: avvio 7–20 minuti e WebView
lento, ma è un Android vero. Android 14 su queste macchine è risultato
instabile (crash del WebView, riavvii del sistema); Android 11 regge.
L'APK di test non va distribuito.

Prima prova (16/10/2026, Android 11): calendario creato e visibile con 168
eventi (42 giorni), 210 allarmi delle notifiche programmati, notifica di prova
mostrata sul canale "Promemoria del piano". Trovato e corretto: se il motore
del WebView si chiude, l'app ora si ricarica invece di chiudersi
(`onRenderProcessGone` in MainActivity).

## Nota (16/10/2026): niente TWA sul Play Store

La TWA non è mai stata pubblicata: c'era solo la PWA. L'app nativa esce come
app nuova, `club.notturnisti.app`, senza scheda o chiave da riprendere. Le
parti di questo documento sull'"aggiornamento in place" della TWA non valgono
più; il recupero dati resta, ma dalla PWA (dati nel browser) all'app.
`/.well-known/assetlinks.json`, che serviva solo alla TWA, è stato tolto.
