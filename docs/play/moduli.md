# Moduli della Play Console — risposte

Verificate sul codice (16/10/2026, aggiornate il 03/11/2026 per la 1.4.0 con Health Connect; package club.notturnisti.app). Se l'app
cambia cosa invia in rete, vanno aggiornate.

## Sicurezza dei dati (Data safety)
**L'app raccoglie o condivide dati utente dei tipi richiesti?** Sì (solo le
statistiche facoltative).

| Tipo di dato (categorie di Google) | Raccolto | Condiviso | Facoltativo | Scopo |
|---|---|---|---|---|
| Attività nell'app → Interazioni con l'app | Sì | No | Sì, l'utente sceglie | Analisi |
| Informazioni e prestazioni dell'app → Diagnostica | Sì | No | Sì, l'utente sceglie | Analisi |

- **Crittografati in transito:** Sì (HTTPS).
- **Possibilità di chiedere l'eliminazione:** No: i contatori sono totali per
  giorno senza identificativi, non riconducibili a una persona; chi li
  accende può spegnerli in qualsiasi momento.
- **Non raccolti** (restano sul telefono, non lasciano il dispositivo): turni,
  orari, diario del sonno (informazioni sulla salute), sonno e passi letti da
  Health Connect (salute e attività fisica), eventi del calendario,
  posizione, contatti, identificativi del dispositivo, indirizzo IP.
- **Cloudflare** è un fornitore di servizi che tratta i dati per conto nostro:
  per Google non è "condivisione".
- Link e messaggi che l'utente invia (WhatsApp, email) partono per sua azione
  verso app scelte da lui: non sono raccolta.

- **Lettura dei turni da foto (facoltativa).** È attiva solo se sul server c'è
  `ANTHROPIC_API_KEY`; senza, la voce non compare. Se la accendi, aggiungi:
  *Foto e video → Foto* (e *File e documenti*, per i PDF), **raccolti**,
  **non condivisi**, **elaborati temporaneamente** (il file non si salva),
  **facoltativi**, scopo **Funzionalità dell'app**. Il foglio può contenere
  nomi di colleghi: va detto anche nell'informativa privacy, che lo prevede già.

## Accesso all'app (App access)
- Risposta: **No**, nessuna parte è soggetta a limitazioni. Nell'app Android
  non ci sono account, login, acquisti o codici: tutto è disponibile subito.
  Il codice QR serve solo a condividere il proprio ciclo, non dà accesso a niente.

## Dichiarazione per le app di salute (Health apps)
- L'app ha funzionalità relative alla salute: **Sì**.
- Da spuntare: **Salute e attività fisica → Gestione del sonno**. Nient'altro:
  niente Medicina (non diagnostica né cura), niente dispositivo medico, niente
  ricerca su soggetti umani. Stanchezza e sonnolenza al lavoro sono una
  conseguenza del piano di sonno, non una funzione a sé.
- Dispositivo medico / funzioni cliniche: **No**. Nell'app e nella scheda:
  «non è un dispositivo medico».
- Health Connect: **usato, solo in lettura** (dalla 1.4.0): `READ_SLEEP` e `READ_STEPS`. Ogni tipo si accende da
  un interruttore in Impostazioni › Promemoria e collegamenti › Health Connect (spento di default), legge gli ultimi 21 giorni solo ad app aperta, i dati
  restano sul telefono e si cancellano spegnendo. Nessuna scrittura, nessuna lettura in background, nessuno storico
  oltre i 30 giorni (`READ_HEALTH_DATA_HISTORY` non è chiesto). Testi da incollare in «Dichiarazione per le
  autorizzazioni di Health Connect»:

  **READ_SLEEP**
  > Notturnisti è un'app di pianificazione del sonno per chi lavora su turni e di notte. Legge le sessioni di sonno solo se l'utente accende l'interruttore «Sonno» in Impostazioni › Promemoria e collegamenti › Health Connect (spento di default) e concede il permesso. Legge inizio e fine delle sessioni degli ultimi 21 giorni, solo quando l'app è aperta (mai in background). Le usa per: calcolare la stima dell'orologio biologico e quindi il piano del sonno, il momento di maggiore sonnolenza e i consigli su luce, pisolini e caffè; e proporre gli orari reali nel diario del sonno («Come hai dormito?»), che l'utente conferma o corregge. I dati restano sul telefono: non vengono inviati a server, non sono condivisi con terzi, non servono per pubblicità né profilazione. Spegnendo l'interruttore vengono cancellati dall'app; il permesso si può togliere in ogni momento da Health Connect.

  **READ_STEPS**
  > Notturnisti è un'app di pianificazione del sonno per chi lavora su turni e di notte. Legge i passi solo se l'utente accende l'interruttore «Passi» in Impostazioni › Promemoria e collegamenti › Health Connect (spento di default) e concede il permesso. Legge i passi degli ultimi 21 giorni, sommati a blocchi di 10 minuti, solo quando l'app è aperta (mai in background). Li usa per un solo scopo: capire quando la persona era sveglia durante un periodo di sonno (almeno 50 passi in 10 minuti interrompono il sonno). Così la stima dell'orologio biologico, l'orario del momento di maggiore sonnolenza e i consigli su luce, pisolini e caffè si basano su dati reali. I dati restano sul telefono: non vengono inviati a server, non sono condivisi con terzi, non servono per pubblicità né profilazione. Spegnendo l'interruttore vengono cancellati dall'app; il permesso si può togliere in ogni momento da Health Connect.
- Sicurezza dei dati: sonno e passi **non raccolti** (non lasciano il telefono), quindi le risposte sopra non cambiano.
- Schermata del perché dei permessi: `PerchePermessiActivity` risponde a `ACTION_SHOW_PERMISSIONS_RATIONALE` e
  `VIEW_PERMISSION_USAGE` (richiesto da Health Connect) e apre l'informativa privacy.

## Classificazione dei contenuti (IARC)
- Categoria: «Utilità, produttività, comunicazione o altro».
- Violenza, sessualità, linguaggio, sostanze, gioco d'azzardo: **No** a tutto.
- Interazione tra utenti / contenuti generati: **No**. Condivisione della
  posizione: **No**. Acquisti digitali: **No**.
- Atteso: PEGI 3 / Everyone.

## Pubblico di destinazione e contenuti
- Fascia d'età: **18 anni e oltre** (lavoratori a turni).
- Attrae i bambini: **No**.
- Pubblicità: **No**.
- Accesso all'app: tutte le funzioni sono disponibili senza account né codici.
- App governativa / finanziaria / di notizie: **No**.

## Permessi che il revisore vede (aapt2)
| Permesso | Perché |
|---|---|
| POST_NOTIFICATIONS | Promemoria del piano (chiesto solo al tocco) |
| SCHEDULE_EXACT_ALARM | Solo per «Ora di alzarti», se l'utente lo accende; tutto il resto usa allarmi inesatti. Nessuna dichiarazione richiesta (la richiede USE_EXACT_ALARM, che non usiamo). |
| RECEIVE_BOOT_COMPLETED, WAKE_LOCK | Ripristino dei promemoria dopo il riavvio (plugin notifiche locali) |
| READ_CALENDAR, WRITE_CALENDAR | Calendario «Notturnisti» sul telefono (solo se l'utente lo accende) |
| INTERNET | Statistiche facoltative, link al sito |
| health.READ_SLEEP, health.READ_STEPS | Sonno e passi da Health Connect, solo se l'utente accende il loro interruttore (dalla 1.4.0) |

## Rilascio
Avvisi attesi alla 1.4.0 (si può procedere):
- **«Questa release non supporta più circa 1.342 dispositivi»**: è il minSdk passato da 24 a 26 (Android 8.0), richiesto
  da Health Connect. Restano fuori i telefoni con Android 7.x (circa l'1% del mercato). Chi li ha tiene la versione già
  installata, non riceve più aggiornamenti; la web app (app.notturnisti.club) resta disponibile anche per loro.
- **«Nessun file di deoffuscamento»**: R8/ProGuard è spento (`minifyEnabled false`), il codice non è offuscato, quindi
  non c'è un file da caricare. Accenderlo ridurrebbe le dimensioni, ma richiede regole per i plugin Capacitor e prove
  sul telefono: da valutare a parte.

1. Test interno (solo tu) con l'.aab dal workflow «Android release».
2. Test chiuso: almeno 12 tester, 14 giorni di fila (obbligatorio per i nuovi
   account personali), lista gestita con un gruppo Google.
3. Produzione con rilascio graduale: 10% → 50% → 100%.
