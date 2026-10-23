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

## Widget con il mese, anche con la compagna/il compagno (fatto nella 1.2.0, da provare sul telefono)
Un solo widget: piccolo = «adesso», medio = la settimana, **alto almeno ~280 dp (5 righe) = il mese**.
- La pagina pubblica `mese` (`meseWidget()` in `ntWidget()`): dal lunedì della settimana del primo del mese a fine del terzo mese dopo, `sigla:tipo` mio e di al massimo 4 persone (la stellina sempre dentro), giorni «liberi insieme» (≥ 3 ore) per persona. Si ricalcola solo se cambia la configurazione o il giorno (con 4 persone sono ~0,5 s).
- `MeseModel` (dati, mesi, scelta persona; test JVM in `MeseModelTest`), `MeseWidget` (disegno Canvas → bitmap, ‹ ›, tocco sul titolo = prossima persona, tocco su un giorno = app su quel giorno, descrizioni per TalkBack).
- La persona scelta dal widget resta finché non la cambi; se nell'app sposti la stellina, il widget riparte da lei.
- **Da guardare sul telefono** (l'aspetto non si vede da qui): colori chiaro/scuro, leggibilità delle sigle a 4 e a 6 righe, soglia dei 280 dp su launcher diversi (Pixel, Samsung), tocchi ‹ › titolo giorno, font ingranditi (la griglia è un'immagine: non segue la dimensione del testo).
- Idee rimaste: passaggio a mano «Adesso/Mese» se qualche launcher non riporta bene l'altezza; legenda del puntino «liberi insieme» nel widget; più di una persona sovrapposta.

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
