# Moduli della Play Console — risposte

Verificate sul codice (16/10/2026, package club.notturnisti.app). Se l'app
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
  orari, diario del sonno (informazioni sulla salute), eventi del calendario,
  posizione, contatti, identificativi del dispositivo, indirizzo IP.
- **Cloudflare** è un fornitore di servizi che tratta i dati per conto nostro:
  per Google non è "condivisione".
- Link e messaggi che l'utente invia (WhatsApp, email) partono per sua azione
  verso app scelte da lui: non sono raccolta.

## Dichiarazione per le app di salute (Health apps)
- L'app ha funzionalità relative alla salute: **Sì**.
- Funzionalità: gestione del sonno; benessere sul lavoro (lavoro a turni,
  stanchezza al rientro).
- Dispositivo medico / funzioni cliniche: **No**. Nell'app e nella scheda:
  «non è un dispositivo medico».
- Health Connect: **non usato**.

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

## Rilascio
1. Test interno (solo tu) con l'.aab dal workflow «Android release».
2. Test chiuso: almeno 12 tester, 14 giorni di fila (obbligatorio per i nuovi
   account personali), lista gestita con un gruppo Google.
3. Produzione con rilascio graduale: 10% → 50% → 100%.
