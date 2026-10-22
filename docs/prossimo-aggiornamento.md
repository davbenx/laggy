# Da fare nel prossimo aggiornamento

- **Togliere il vecchio wizard nascosto** (passi 1 e 2 del vecchio procedimento guidato): `#shiftsBox`, `#avanzate`, `#oToday`, i tasti dei preset e il JS che li usa (`renderShifts` e simili). Oggi non sono raggiungibili da nessuna schermata. Prima di toccarli: elencare i riferimenti, togliere HTML, CSS e JS insieme, poi suite UI completa. Fatto quando nessuno di questi id compare più in `index.html` e i test passano.

- **Suggerimenti d'uso solo per l'app Android** (aggiungere insieme alla prossima release): la sveglia nell'Orologio dal piano («Metti la sveglia» sotto Dormi) e il voto del sonno dal widget. Vanno mostrati solo nell'app (`platform.alarm.available`, widget presenti) e fuori dall'elenco del sito. Verificare prima sul telefono vero che sveglia e voto funzionino.
- **Statistiche solo app**: `sveglia_messa` e `diario_widget` esistono già; guardarle nelle statistiche dopo la release.
