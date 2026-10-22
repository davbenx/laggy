# Da fare nel prossimo aggiornamento

- **Togliere il vecchio wizard nascosto** (passi 1 e 2 del vecchio procedimento guidato): `#shiftsBox`, `#avanzate`, `#oToday`, i tasti dei preset e il JS che li usa (`renderShifts` e simili). Oggi non sono raggiungibili da nessuna schermata. Prima di toccarli: elencare i riferimenti, togliere HTML, CSS e JS insieme, poi suite UI completa. Fatto quando nessuno di questi id compare più in `index.html` e i test passano.

- **Titolo delle pagine interne troppo in alto (Impostazioni e simili): da verificare su un telefono vero.**
  - Nel browser, simulando una barra di stato da 32 px (`--safe-area-inset-top`), il titolo di Impostazioni, Ferie e le altre pagine parte sotto la barra (42 px dall'alto): il codice di `.pag-testa` è corretto.
  - Se sul telefono si sovrappone ancora, il valore `--sat` arriva a 0 in quelle pagine. Cosa fare: (1) stampare `--sat` a schermo in una build di prova per vedere cosa riceve la pagina; (2) se è 0, un ripiego nell'app nativa (`max(--sat, 28px)` quando `NT_APP.nativo`), da provare con un APK di debug prima di rilasciare.
  - Da chiarire: quale versione era installata (la 1.0.2 su Play non ha la correzione) e se anche Oggi e Turni hanno il titolo troppo in alto.
