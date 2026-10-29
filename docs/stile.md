# Stile dell'interfaccia: superfici, colori, raggi

Sei tipi di superficie. Una cosa nuova usa uno di questi, non ne inventa un settimo.

| # | Tipo | Aspetto | Quando | Classi oggi |
|---|---|---|---|---|
| 1 | **Pagina** | sfondo `--bg` | sempre | `body` |
| 2 | **Gruppo** | `--s1`, bordo `--line`, raggio `--r` | elenchi di righe, calcoli, editor, risultati | `.opz-gruppo`, `.ecc`, `.andamento-sezione`, `.tool`, `.cyc`, `.qh-card`, `.lucidita-card`, `.status` |
| 3 | **Eroe** | `--blue-soft`, bordo `--blue-lt`, raggio 20 | solo «Adesso» e «prossima finestra libera»; uno per schermata | `.ora-card`, `.whero` |
| 4 | **Invito** | gruppo con barra blu a sinistra e × | una proposta da accettare o chiudere | `.card.invito` |
| 5 | **Avviso** | `--risk-soft`, bordo `--risk-line` | solo rischio per la sicurezza | `.status.warn`, `.essrischio`, `.ora-card.risk` |
| 6 | **Nota** | testo `--dim`, nessun riquadro | spiegazioni, «Il piano, in breve» | `.hint`, `.essperche` |

## Colore = significato
- Blu: sonno, selezione, azione principale.
- Arancio: turno.
- Rosso: rischio.
- Viola (`--picco`): picco di sonnolenza nei grafici.
- Grigio: tutto il resto. Mai un colore solo per decorare.

## Misure e componenti (novembre 2026)
- Spazi: `--sp-1…5` (4, 8, 12, 16, 24 px), `--gap-sezione` tra sezioni. Raggi: `--r` (16) per schede e riquadri, `--r-campo` (12) per campi, chip e segmenti, pillole 999 solo per i chip tondi. Bersagli: `--tap` (44 px) come minimo.
- Un solo modo per ogni cosa: **chip** (`.sg-pen`, uno attivo = `--blue` con testo `--su-blu`, mai `--blue-fill` con testo scuro), **segmenti** (`.pv-quando`, `.swap-modo`: griglia di pulsanti in un bordo unico), **righe con freccia** (`.opz-hub-r` dentro `.opz-gruppo`: Impostazioni e «Sonno e carico» le condividono), **pulsante principale** `.btn.pri` (pieno).
- Le pagine con più voci non si aprono a fisarmonica: elenco di righe (titolo + valore + ›) e una pagina per voce, come le Impostazioni. La freccia in alto torna all'elenco; da lì chiude la pagina.
- Il mese dei numeri sta nella scheda «Il tuo ciclo» e segue la vista (ore o calendario); una sola navigazione (le frecce di Turni).

## Il piano di Oggi
Una timeline: ora a sinistra, nodo sulla linea, titolo e dettaglio. Niente schede per voce.

## Pagine interne
Intestazione `.pag-testa` (rispetta la barra di stato `--sat`). Una sola regola per tutte.

## Condivisione
- Un'icona sola per «manda con qualsiasi app»; mai il logo di un'app di terzi.
- Messaggi in testo semplice: niente emoji, niente markdown, punto elenco «•».
- Ogni messaggio finisce con `firmaMessaggio(tipo)`: nome dell'app e, da solo in fondo, `https://app.notturnisti.club/?s=<tipo>`.
