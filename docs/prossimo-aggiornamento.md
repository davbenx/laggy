# Da fare

Fatto nella 1.1.1 (non serve più): tolto il vecchio wizard nascosto; suggerimenti d'uso solo app
(sveglia, voto dal widget); il giorno di Oggi segue il tempo; cambio d'ora.

## Subito, sul telefono vero (nessun codice)
- Sveglia nell'Orologio dal piano («Metti la sveglia» sotto Dormi) e voto del sonno dal widget: mai provati su un dispositivo.
- Ritorno in primo piano dopo ore: data, «Adesso» e striscia si aggiornano da soli.
- Schermata dopo uno smonto (es. 06:30): «Ancora giovedì…», «Poi · a letto alle…», «Dovresti dormire…».
- Domenica 25/10: la riga «Cambio d'ora» nel giorno di sabato e «Mancano» in ore vere.
- Statistiche: guardare `sveglia_messa`, `diario_widget`, `voce_*`, `orologio_tuo`, `festivi_*`, `ferie_con`.

## Dopo l'approvazione della produzione: sonno da Health Connect (solo Android)
Perché: il sonno vero (da quando a quando) compila il diario, e il giorno dell'app passa al nuovo
**al risveglio vero**, non a quello previsto (la soluzione di fondo ai confini del giorno). «Il tuo orologio»
e il debito di sonno si calcolano su dati reali.

Scelte da tenere ferme:
- **Facoltativo e in locale**: si legge e si calcola sul telefono, niente esce. Interruttore in Impostazioni › «Sonno da Health Connect», spento di default.
- **Solo lettura** del sonno: `android.permission.health.READ_SLEEP` (SleepSessionRecord). Nessuna scrittura.
- Niente Fitbit Web API, niente account, niente server (cozzano con «senza account»).
- iPhone: HealthKit sarebbe un lavoro a parte (oggi non c'è un'app iOS).

Lavoro:
1. **Plugin Android** `NTHealth` (come NTAlarm/NTWidget): `disponibile()`, `chiediPermesso()`, `sessioniSonno(da, a)` → `[{inizio, fine, fonte, fasi?}]` in millisecondi. Se Health Connect non c'è (Android < 14 senza app) → «non disponibile» con il link per installarla. Schermata del perché del permesso (intent `ACTION_SHOW_PERMISSIONS_RATIONALE`) che rimanda alla privacy.
2. **Pagina**: `platform.salute` (come `platform.alarm`); sul sito resta assente. Leggere le ultime 48 ore al ritorno in primo piano e all'apertura.
3. **Dal dato al diario**: la sessione più lunga che finisce in un giorno diventa il sonno di quel giorno (`beds`/`wakes`) *solo se* la persona non l'ha già annotato (mai sovrascrivere). Sessioni brevi (< 90 min) = pisolini, uniti a quelli annotati senza doppioni. Il tocco «Sì, così» resta: si può correggere.
4. **Giorno di Oggi**: se c'è una sessione di sonno finita per oggi, `giornoVero()` passa al giorno nuovo subito (il risveglio è un fatto, non una previsione); se il sonno è in corso (sessione aperta) resta il giorno del turno.
5. **Statistiche**: `setup_item` con `salute_attiva` (una volta), nessun dato di sonno.
6. **Test**: plugin finto in `_nativo.mjs` (come per NTAlarm), casi: nessun dato, sessione che sovrappone un pisolino, sessione già annotata, permesso negato/revocato, fuso orario e cambio d'ora. Prova finale su telefono con orologio e su emulatore con Health Connect (API 34).
7. **Play Console** (prima di inviare la release): dichiarare i tipi di dato di Health Connect (solo sonno), compilare la «dichiarazione app di salute» se richiesta, aggiornare «Sicurezza dei dati» (dati trattati sul dispositivo, non raccolti), aggiornare privacy e termini sul sito e nell'app. Tempo di revisione di Google: ignoto, da mettere in conto.

Fatto quando: un telefono con orologio compila il diario da solo, il giorno passa al risveglio vero, e con il permesso revocato l'app si comporta come prima.

Non so ancora: quali dei tester ha un dispositivo compatibile; quanti giorni di storico si vedono dopo il permesso (una fonte terza dice 30, da verificare nella documentazione ufficiale).

## Widget: settimane in più, sveglia e voto (1.2.1, da provare sul telefono)
Un solo widget, più alto = più giorni. 3 righe: «Adesso/Prossimo», le prossime voci e la settimana di sette giorni da oggi. Da 4 righe in su si aggiungono righe di sette giorni (fino a cinque, oltre un mese), di seguito alla settimana.
- Nella zona delle prossime voci: la mattina, per 14 ore, il voto del sonno e dell'energia; prima di dormire (da 4 ore prima a mezz'ora dopo l'inizio del sonno) «Metti la sveglia alle …» (apre l'Orologio con la sveglia pronta).
- Con una persona (stellina in «Le tue persone»): sotto la tua sigla quella della persona, in verde, anche nella prima settimana (dove c'è anche l'ora a letto); legenda «Sopra tu, sotto Anna».
- Le due voci sotto «Adesso» sono in ordine di ora. I launcher riportano un'altezza più bassa del vero (15-25% misurato): `ALTEZZA_VERA` la corregge di poco; se un launcher taglia l'ultima riga, abbassarla.
- Viste vere (`GiorniWidget`, `GiorniModel` con test JVM): seguono tema e testo ingrandito. La prima versione disegnava il mese come immagine e si stirava: tolta.
- Da guardare sul telefono: righe che si aggiungono all'altezza giusta (soglie in `GiorniModel.righeExtra`), sigle e colori, tocco su un giorno, «Metti la sveglia» (l'Orologio chiede conferma: non si sa se la sveglia c'è già).
- Tolti rispetto alla bozza: ‹ › sui mesi, cambio persona dal widget, puntino «liberi insieme». Da riprendere solo se servono.

## Idee per dopo (in ordine di valore/rischio, da rivedere con i dati reali)
1. **Foto del foglio turni → importazione** (OCR sul telefono, nessun invio): per chi riceve i turni variabili su carta o PDF. È il punto più faticoso di chi non ha un ciclo.
2. **Conti per la busta paga e controlli sui riposi**: ore notturne, festive e domeniche del mese (c'è già il mese e i festivi); avviso di «meno di 11 ore tra due turni» e «24 ore di riposo settimanale» secondo la normativa italiana. Da validare con un esperto prima di scrivere cifre.
3. **Copia automatica di Android** (backup di sistema): oggi la copia è un link; verificare se i dati della pagina sono inclusi nel backup di Android e, se sì, attivarlo; altrimenti valutare un export su Drive scelto dalla persona.
4. **Inglese** (poi altre lingue): dopo i dati su dove vengono le installazioni. Prima serve rendere i testi traducibili (funzione `t()`, il motore restituisce chiavi) e un'estensione dei festivi per paese. Vedi la valutazione fatta il 23/10.
5. **App iPhone**: guscio Capacitor iOS sulla stessa pagina; serve account sviluppatore Apple e un Mac. Valutare dopo l'Android in produzione e la domanda dal sito.
6. **Riepilogo del mese / dell'anno** condivisibile («I miei 12 mesi»): notti, sonno medio, debito; si appoggia ai dati già presenti.
7. **Club in app con Play Billing** (se si vuole un ricavo): le regole di Play chiedono il suo sistema di pagamento per ciò che si vende nell'app.
8. **Wear OS**: voce di piano e sveglia al polso. Utile, ma è un'altra app da mantenere.

Cose che non farei: account, sincronizzazione su server, funzioni sociali (cozzano con «senza account»
e con la privacy che è il punto di forza).
