# App nativa (Android → iOS): notifiche, calendario, widget

Stato: **proposta**, niente ancora implementato. Data: 2026-09-22.

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
