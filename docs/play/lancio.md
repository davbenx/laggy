# Lancio su Google Play — piano completo

Testi della scheda: `scheda.md`. Risposte ai moduli: `moduli.md`. Account sviluppatore e «Crea app»: `account.md`. Grafica: `img/`.
Principio guida: si convince mostrando con chiarezza cosa fa l'app e cosa no, senza promesse
gonfiate, recensioni finte o pressioni. È anche ciò che Google premia: le regole sui metadati
vietano superlativi non verificabili ("n. 1", "il migliore"), nomi di altre app e parole chiave
ripetute, pena il rifiuto della scheda.

---

## 1. Ordine delle operazioni

**Prima della validazione dell'account (puoi farlo già ora)**
1. Genera la chiave di caricamento sul tuo computer e metti i 4 secret su GitHub (vedi `app/README.md`).
2. Lancia il workflow **android-release** con versione `1.0.0` e scarica l'AAB.
3. Prepara la lista dei tester (§2).

**In Play Console, ad account validato**
1. Crea app → nome `Notturnisti: turni e sonno`, lingua italiano, App, Gratuita.
2. Contenuti dell'app (menu "Norme e programmi"), tutti da `moduli.md`: privacy policy,
   accesso all'app (tutto senza login), annunci (no), classificazione IARC, pubblico di
   destinazione (18+), sicurezza dei dati, app per la salute, app governative/finanziarie/notizie (no).
3. Scheda dello Store (`scheda.md` + `img/`). Paesi: Italia, San Marino, Svizzera, Vaticano.
4. Panoramica della pubblicazione → **Pubblicazione gestita: attiva**. Così nulla esce (né una
   versione né una modifica alla scheda) finché non premi tu "Pubblica" dopo l'approvazione.
5. Test → Test interno → carica l'AAB, aggiungi solo te stesso, installa da Play e prova le cose
   che l'APK di prova non copre: firma di Play, aggiornamento sopra la versione precedente.
6. Test → Test chiuso → crea un canale, carica l'AAB, aggiungi i tester (Gruppo Google, §2),
   note di versione, invia per la revisione.
7. Dopo **14 giorni consecutivi con almeno 12 tester iscritti**: Panoramica della pubblicazione →
   Richiedi l'accesso alla produzione (domande in §2.4).
8. Produzione: stesso AAB (o uno nuovo con le correzioni dei test), lancio graduale al 20%, poi
   50%, poi 100% in una settimana se crash e ANR restano bassi (§5).

**API Play Integrity: non serve (per ora).** Google la consiglia a tutti, ma protegge un server
da app modificate o dispositivi falsi: acquisti, account, premi, classifiche. Notturnisti non ha
login né acquisti e calcola tutto sul telefono, quindi non c'è nulla da proteggere così. Aggiungerla
porterebbe una dipendenza da Google Play Services e un progetto Google Cloud, senza beneficio.
Da rivalutare solo se un giorno il server del calendario automatico ricevesse abusi.

**Il giorno dopo la pubblicazione**
- Nel codice: in `index.html`, `window.NT_APP.play = "https://play.google.com/store/apps/details?id=club.notturnisti.app"`.
  Da quel momento chi usa la versione web su Android vede, una volta, l'invito a passare all'app
  (con le differenze spiegate e come portare i turni). Su iPhone non cambia nulla. Basta dirmelo.
- Su notturnisti.club: badge ufficiale "Disponibile su Google Play" (si genera su
  play.google.com/intl/it/badges) nella pagina /planner e in fondo agli articoli.
- Newsletter del Club: un'email sola, onesta (§6).

---

## 2. Test chiuso: 12 tester per 14 giorni

### 2.1 Chi
In ordine di valore: turnisti veri che non conosci bene (danno i riscontri più sinceri) →
colleghi → amici e famiglia che fanno turni → chiunque abbia Android, solo per arrivare a 12.
Fonti: iscritti alla newsletter di notturnisti.club, colleghi, gruppi di turnisti dove sei già
attivo (scrivi lì solo se le regole del gruppo lo permettono). Recluta **15–20**: qualcuno si perde.

### 2.2 Come
- Crea un Gruppo Google (es. `tester-notturnisti@googlegroups.com`) e aggiungilo come elenco tester.
- Manda il link di iscrizione al test (lo dà Play Console) e il link per scaricarla.
- Contano i giorni in cui i tester **restano iscritti**: chiedi di non disiscriversi per 14 giorni.

### 2.3 Messaggio di invito (da adattare)
> Ciao! Sto per pubblicare Notturnisti, un'app gratuita per chi lavora a turni: dal tuo ciclo ti
> dice quando dormire, quando smettere con il caffè e quando prendere la luce, e ti manda i
> promemoria. Google chiede che 12 persone la provino per due settimane prima di pubblicarla.
> Ti va di essere una di queste? Serve un telefono Android: ti iscrivi da questo link [link], la
> scarichi e la usi come vuoi per 14 giorni (basta restare iscritti). Se qualcosa non torna,
> dall'app: Impostazioni → Segnala cosa non torna. Nessun dato tuo arriva a me. Grazie!

Niente regali o premi in cambio di recensioni: le regole di Play lo vietano.

### 2.3b Tre domande ai tester (dopo una settimana)
Brevi, in un messaggio o in un modulo; le risposte decidono cosa fare dopo il lancio.
1. Cosa ti ha confuso o ti è sembrato sbagliato? (anche una cosa sola)
2. Quali di queste useresti? Giorni speciali (ferie, malattia, reperibilità,
   formazione) · sonno letto in automatico dall'orologio o dal telefono ·
   stima della paga con notti e festivi · altro: ____
3. Cosa ti manca per usarla ogni giorno?

### 2.4 Domande per l'accesso alla produzione (risposte da adattare con i dati veri)
- *Come hai reclutato i tester?* Iscritti alla newsletter di notturnisti.club e lavoratori a turni
  della mia rete (sanità, industria), più alcuni conoscenti con Android.
- *Com'è andato il test?* Numeri veri: quanti hanno usato promemoria, calendario, widget, quanti
  riscontri. Le statistiche anonime (se accese) e le email di riscontro bastano.
- *Cosa hai cambiato in base ai riscontri?* Elenca le correzioni (anche piccole): Google vuole
  vedere che il test è servito.
- *Chi è il pubblico e perché è pronta?* Lavoratori a turni in Italia; app già usata come web app,
  ora con promemoria, calendario e widget nativi; nessun crash o problema aperto noto.

---

## 3. Ricerca su Play (ASO)

**Dove contano le parole.** Peso decrescente: nome dell'app → descrizione breve → descrizione
completa. Google legge il testo come lo legge una persona: le parole chiave vanno usate in frasi
vere, ognuna poche volte. Ripeterle è inutile e porta al rifiuto.

**Ricerche da coprire** (tutte già presenti in modo naturale nei testi):
- di categoria: *turni*, *calendario turni*, *turni di lavoro*, *lavoro a turni*, *turnista*
- di problema: *turno di notte*, *notte*, *smonto*, *sonno*, *dormire*, *pisolino*, *caffè*, *stanchezza*
- di funzione: *promemoria*, *widget*, *cambio turno*, *scambio turno*, *calendario*, *PDF*, *WhatsApp*
- di professione: *infermieri*, *OSS*, *operai*, *forze dell'ordine*, *vigili del fuoco*

**Nome.** `Notturnisti: turni e sonno` mette nel punto più forte la parola più cercata (*turni*) e
la differenza dagli altri (*sonno*). Dopo un mese guarda Play Console → Statistiche → Acquisizione
→ "Termini di ricerca": se *calendario turni* porta molte visite che non convertono, valuta il nome
alternativo in `scheda.md`.

**Esperimenti** (Play Console → Esperimenti sulla scheda dello Store). Una variabile alla volta, a
partire da qualche centinaio di visite a settimana, altrimenti il risultato non è affidabile:
1. ordine degli screenshot (oggi: piano del giorno per primo);
2. descrizione breve (varianti B e C in `scheda.md`);
3. immagine in evidenza.

---

## 4. Conversione: da visita a installazione

Quello che è dimostrato funzionare, applicato in modo onesto:
- **I primi tre screenshot decidono.** Si vedono senza scorrere: piano di oggi, settimana, un tocco
  per iniziare. Didascalie da beneficio ("Il tuo piano di oggi"), non da funzione.
- **Ridurre il rischio percepito**: "Gratis. Senza account. Senza pubblicità. Dati sul telefono"
  subito nella descrizione, e la sezione Sicurezza dei dati quasi vuota: per un'app sul sonno è un
  argomento forte, ed è vero.
- **Differenza chiara dagli altri**: "Perché non un semplice calendario turni" risponde alla prima
  obiezione di chi già usa un calendario turni.
- **Trasparenza come fiducia**: "Ogni consiglio ha il suo perché" e "Cosa non è". Niente stelle,
  numeri di utenti o premi finché non ci sono davvero.
- **Primo avvio immediato**: un tocco e c'è il piano, nessuna registrazione. Chi apre e capisce
  subito resta (la permanenza conta anche per Google, §5).

---

## 5. Cosa guarda l'algoritmo di Play (e cosa possiamo fare)

| Segnale | Cosa fare |
|---|---|
| Qualità tecnica (Android vitals): Google riduce la visibilità sopra il **1,09%** di utenti con crash e lo **0,47%** con ANR | Lancio graduale, controllare Android vitals a ogni rilascio |
| Disinstallazioni e permanenza | Promemoria utili e pochi (già così), widget, calendario |
| Voti e recensioni | Richiesta nel momento giusto (già nell'app), risposte a tutte le recensioni negative entro 48 ore |
| Aggiornamenti | Un rilascio ogni 2–6 settimane con note di versione chiare, non aggiornamenti vuoti |
| Pertinenza del testo | Scheda già scritta così (§3) |

---

## 6. Farla conoscere senza essere invadenti

In ordine di rapporto risultato/fatica:
1. **Passaparola già dentro l'app**: messaggio dei turni, tempo libero da condividere, PDF con il QR,
   "Chiedi il suo link". Ogni condivisione mostra l'app a chi lavora con te: è il canale più
   credibile.
2. **Chi usa già la versione web** (dopo la pubblicazione): l'invito a passare all'app (§1).
3. **notturnisti.club**: badge di Play, articoli utili (sonno dopo la notte, smonto, caffè sui
   turni) con l'app citata dove serve, non in ogni frase. È il contenuto che le persone cercano su Google.
4. **Newsletter**: un'email al lancio. Cosa fa, perché è gratis, cosa ti serve dagli iscritti
   (provarla e dire cosa non torna). Nessuna sequenza di solleciti.
5. **Comunità di turnisti** (gruppi di infermieri/OSS, forum di settore): rispondere alle domande
   sul sonno nei turni e citare l'app solo quando risponde davvero alla domanda, dichiarando di
   esserne l'autore.
6. **Pubblicità a pagamento**: non prima di avere voto ≥ 4,3 e permanenza a 7 giorni ≥ 25%. Altrimenti
   si pagano installazioni che si perdono.

---

## 7. Concorrenti (per te, non per la scheda: lì non si nominano altre app)

| | Cosa fa | Punti forti | Dove Notturnisti è diverso |
|---|---|---|---|
| Calendari turni (Supershift, Shifter Calendar, My Shift Planner…) | Mostrano i turni, a volte ore e guadagni; versioni Pro da pochi euro | Diffusi, semplici, conteggio ore/straordinari | Dicono *quando lavori*, non *come dormire e arrivare in forma*. Notturnisti fa entrambe le cose |
| Timeshifter Shift Work | Piani di sonno, luce e caffè per turnisti | Scientifico, noto, premiato | A pagamento, in inglese. Notturnisti è gratis, in italiano, con calendario e condivisione |
| App per il sonno (tracker, suoni) | Misurano o accompagnano il sonno | Dati dai sensori | Non conoscono i turni: non pianificano prima di un cambio |

Punti deboli onesti di Notturnisti, da conoscere (e da non nascondere se chiedono): niente conteggio
di ore e guadagni, niente gestione dei turni di un reparto o team, niente app iPhone nativa, nessuna
validazione clinica.

---

## 8. Numeri da guardare

- **Play Console**: conversione della scheda (visite → installazioni), installazioni per
  provenienza, termini di ricerca, voto medio, crash/ANR.
- **Statistiche dell'app** (`/stats`, solo da chi le accende): ritorni a 1, 7, 30 giorni; funzioni
  accese (promemoria, calendario, widget); notifiche aperte per tipo; recensioni richieste.
- Prima soglia per dire che funziona: permanenza a 7 giorni ≥ 25%, voto ≥ 4,3 con almeno 30 recensioni.

---

## 9. iPhone: subito o dopo?

**Consiglio: dopo**, quando Android ha dimostrato di funzionare (soglie del §8, di solito 2–3 mesi).

- Costi: 99 $/anno per l'account Apple, un Mac o una build su macOS nel cloud (GitHub Actions lo
  permette), un Apple ID a tuo nome o a nome di un'impresa.
- Lavoro: Capacitor e il plugin del calendario funzionano anche su iOS; promemoria e condivisione
  pure. Il **widget va riscritto da zero** in Swift (WidgetKit) e ci sono limiti diversi sulle
  notifiche (massimo 64 in coda: già gestito nel codice).
- Intanto chi ha iPhone usa la versione web, che si aggiunge alla schermata Home. Il limite reale:
  sul web i promemoria non sono affidabili ad app chiusa.
- Rischio di andare subito su due store: raddoppi la manutenzione e le recensioni da gestire prima
  di sapere cosa va corretto. Aspettare costa poco, perché gli iPhone continuano ad avere la web app.
- Segnale per anticipare: molte richieste esplicite da utenti iPhone (email, riscontri) o molto
  traffico da Safari su iPhone nelle statistiche di Cloudflare.
