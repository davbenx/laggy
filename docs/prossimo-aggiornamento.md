# Da fare nel prossimo aggiornamento

- **Togliere il vecchio wizard nascosto** (passi 1 e 2 del vecchio procedimento guidato): `#shiftsBox`, `#avanzate`, `#oToday`, i tasti dei preset e il JS che li usa (`renderShifts` e simili). Oggi non sono raggiungibili da nessuna schermata. Prima di toccarli: elencare i riferimenti, togliere HTML, CSS e JS insieme, poi suite UI completa. Fatto quando nessuno di questi id compare più in `index.html` e i test passano.
