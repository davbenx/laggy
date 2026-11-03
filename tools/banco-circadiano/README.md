# Banco di prova circadiano

Confronta il motore di Notturnisti con il modello del pacemaker circadiano di **Forger, Jewett & Kronauer (J Biol Rhythms 1999)**,
scritto in `banco.mjs` dalle equazioni pubblicate (gli stessi parametri della libreria `circadian` di Arcascope: τ 24,2 h,
μ 0,23, q 1/3, k 0,55, G 33,75, α₀ 0,05, β 0,0075, I₀ 9500, p 0,5). Non fa parte dell'app.

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
