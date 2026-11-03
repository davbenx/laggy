# Banco di prova circadiano

Confronta il motore di Notturnisti con il modello del pacemaker circadiano di **Forger, Jewett & Kronauer (J Biol Rhythms 1999)**,
nella forma «semplice» (oscillatore di van der Pol su xc), con le stesse equazioni e gli stessi parametri della libreria
`circadian` di Arcascope (τ 24,2 h, μ 0,23, k 0,55, G 33,75, α₀ 0,05, β 0,0075, I₀ 9500, p 0,5). Non fa parte dell'app.

```
node tools/banco-circadiano/banco.mjs
```

Per quattro rotazioni e 28 giorni:
- dove il motore mette il minimo dell'orologio (`P.cbt`, metà sonno + 2 h) e dove lo mette `alertness.js` (sveglia libera − 3 h),
  rispetto al minimo calcolato dal modello;
- se seguire i consigli di luce dell'app (le stesse regole della scheda «Luce» in `index.html`) porta il minimo dentro il
  sonno principale più spesso che non seguirli.

**Limiti.** Un modello, non persone: la luce di ogni momento è una stima (casa 150–600 lux, lavoro 300, «luce forte»
1000–3000, «luce bassa» 20). La fase assoluta è calibrata sull'orario libero 23:30–07:30 (minimo corporeo 2 h prima della
sveglia, Czeisler e coll.): gli scarti contano più dei singoli orari. Il modello non dice quale delle due ancore
(sveglia − 2 h o − 3 h) sia giusta: lo decide la calibrazione.

## Nel motore (novembre 2026)

Da novembre 2026 lo stesso modello è **dentro il motore** (`engine.js`, «L'orologio»): `P.cbt` è il minimo corporeo che il
modello calcola sui tuoi ultimi 10 giorni e sui 2 prossimi (sonni del piano, o quelli del diario quando combaciano;
turni; luce stimata per stagione), calibrato sui tuoi orari liberi. Lo usano la luce nelle notti, il pisolino in turno,
la veglia lunga, il «picco di sonnolenza» e l'avviso in turno; `alertness.js` riceve lo stesso minimo (`nadir`).
La regola di prima resta in `P.cbtRegola`, per confronto.

Risultati (scarto medio dal modello senza consigli, dal 7° giorno):

| Rotazione | motore | regola di prima (metà sonno + 2 h) | alertness di prima (sveglia − 3 h) |
|---|---|---|---|
| M-P-N-S-R | ±0,1 h | ±2,0 h | ±1,1 h |
| 2M 2P 2N 4R | ±0,1 h | ±2,3 h | ±1,2 h |
| 5 notti, 2 riposi | ±0,3 h | ±1,9 h | ±6,6 h |
| Solo mattine | ±0,1 h | ±0,7 h | ±0,9 h |

Lo scarto del motore non è zero perché la simulazione del motore parte da 10–16 giorni prima (non da 28) e non conta i pisolini.

## Provato e non adottato: la luce calcolata dal modello giorno per giorno (novembre 2026)

Finestre «cerca/evita luce» messe sulla curva di risposta alla luce (Khalsa 2003) attorno al minimo del modello, verso il
minimo ideale del sonno successivo. Nel banco (scarto medio dal minimo ideale) peggiorava le rotazioni rapide rispetto alle
regole attuali: M-P-N-S-R 1,83–1,87 h contro 1,61 h; 2M 2P 2N 4R 2,05 h contro 1,95 h; meglio solo nei blocchi lunghi di
notti (1,47 contro 1,59). Inseguire ogni giorno l'obiettivo del giorno dopo sposta l'orologio verso notti brevi e rende
più lento il rientro: le regole attuali (orologio orientato sul giorno, Eastman) vincono. La strada giusta per aderire al
modello è un'ottimizzazione su più giorni (la luce migliore per tutta la settimana di turni, come in Serkh & Forger,
PLoS Comput Biol 2014), da confrontare qui con le regole attuali prima di adottarla.

## Verifica contro la libreria `circadian` e confronto fra modelli (novembre 2026)

**Correzione.** La prima versione (del motore e di questo banco) mescolava la dinamica di ordine superiore di
Kronauer/Jewett 1999 (termini in x⁷, q, 0,99729) con i parametri di Forger 1999: un modello non pubblicato. Sostituita con
le equazioni di Forger 1999 come nella libreria. Verifica: stessa luce per 44 giorni (30 regolari + 14 di M-P-N-S-R), stesso
stato iniziale: con passo di 1 minuto i minimi del motore e di `circadian.models.Forger99` coincidono entro 0,9 min in media
(1,4 al massimo); con il passo del motore (10 min) entro 10 min, per la sola discretizzazione.

**Confronto fra modelli** (stessa luce, libreria `circadian` 1.0.3, scarto medio dei minimi da Forger 1999):

| Rotazione | Hannay 2019 | Hannay 2019 (due popolazioni) | Jewett 1999 |
|---|---|---|---|
| M-P-N-S-R | 0,9 h | 0,7 h | 0,4 h |
| 5 notti + S + R | 0,8 h | 0,3 h | 0,7 h |

Le differenze sono soprattutto di fase assoluta (che il motore calibra sui tuoi orari liberi); la dinamica è la stessa:
nella rotazione rapida l'orologio resta dov'è, nel blocco di notti si sposta di 3-4 ore e torna. In letteratura i modelli
guidati dalla luce hanno errori simili (~1 h nella vita reale; Huang e coll., Sleep 2021) e nei turnisti fa la differenza il
dato in ingresso (attività/luce misurate da un dispositivo), non il modello. Per riprodurre: `~/.venvs/notturnisti`
(`pip install circadian`).

## Ottimizzatore su più giorni (`ottimizza.mjs`, novembre 2026)

Orizzonte mobile di 4 giorni: ogni giorno una finestra «cerca luce» (1-4 h) e una «evita luce» (1-3 h), scelte a discesa
per coordinate partendo dalle regole attuali, minimizzando il disallineamento del minimo corporeo dai sonni principali
(schemi «bang-bang» di Serkh & Forger 2014). Vincoli: mai «evita» al lavoro; 3000 lux solo con il sole e fuori dal lavoro,
1000 altrimenti; buio 20 lux. Versione robusta (`ROBUSTO=1`): ottimizza insieme tre orologi plausibili (τ 24,0 / 24,2 /
24,4), come gli schemi per «più individui» (IFAC 2020).

```
ROBUSTO=1 node tools/banco-circadiano/ottimizza.mjs [τ vero] [adesione 0-1] [cartella per esportare la luce]
```

**Robustezza** (l'ottimizzatore non conosce la persona vera): migliore delle regole attuali in 19 casi su 24 (4 rotazioni ×
τ 24,0 / 24,2 / 24,4 × adesione 100% / 50%). Perde con le sole mattine quando l'orologio è lento o l'adesione è a metà, e
nella rotazione rapida con τ 24,4.

**Con altri modelli** (luce scelta con Forger 1999, valutata con la libreria `circadian`; scarto medio dal minimo ideale):

| | Hannay 2019 | Hannay 2019 (due popolazioni) | Jewett 1999 |
|---|---|---|---|
| M-P-N-S-R: regole → ottimizzatore | 1,76 → 1,38 h | 1,77 → 1,36 h | 2,01 → 1,52 h |
| 2M 2P 2N 4R | 1,74 → 1,34 h | 1,68 → 1,28 h | 2,02 → 1,82 h |
| 5 notti, 2 riposi | 2,88 → 2,89 h | 2,60 → 2,37 h | 1,54 → 1,30 h |
| Solo mattine | 0,97 → 1,36 h | 0,66 → 1,06 h | 0,93 → 0,62 h |

Nelle rotazioni con notti l'ottimizzatore vince con tutti i modelli; con le sole mattine le regole (3 h di luce al mattino)
reggono meglio nei modelli di Hannay. Nota: nella rotazione rapida le regole attuali (luce forte per tutta la notte)
fanno peggio di nessun consiglio con quasi tutti i modelli.
