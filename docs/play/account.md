# Play Console: account sviluppatore e creazione dell'app

Risposte campo per campo. Grafica in `img/`. Testi della scheda in `scheda.md`,
moduli in `moduli.md`, ordine dei passi in `lancio.md`.

## Pagina sviluppatore (Dettagli account → Pagina sviluppatore)

| Campo | Valore |
|---|---|
| Icona sviluppatore (512×512, JPEG/PNG 24 bit, senza trasparenza, ≤1 MB) | `img/sviluppatore-icona-512.png` (178 KB) |
| Immagine intestazione (4096×2304, JPEG/PNG 24 bit, ≤1 MB) | `img/sviluppatore-intestazione-4096x2304.jpg` (209 KB). Il contenuto sta al centro, così regge i ritagli sui telefoni. Sorgente: `img/sviluppatore-intestazione.html` |
| App in primo piano | Notturnisti (si può scegliere solo dopo averla creata) |
| Sito web sviluppatore | `https://notturnisti.club` |

**Testo promozionale** (max 140). La lingua predefinita della pagina è en-US, quindi va
prima in inglese; poi «Aggiungi traduzioni» → Italiano.

- en-US (138): `Notturnisti helps shift workers sleep better: when to sleep, nap, drink coffee and get light, built around your real shifts. Free, no ads.`
- it-IT (137): `Notturnisti aiuta chi lavora a turni a dormire meglio: quando dormire, il caffè e la luce, sul tuo turno vero. Gratis e senza pubblicità.`

L'indirizzo della sede diventa pubblico solo se si sceglie di guadagnare su Play
(acquisti o abbonamenti): con un'app gratuita e senza acquisti in-app non serve.

## Crea app

| Campo | Valore |
|---|---|
| Nome app (max 30) | `Notturnisti: turni e sonno` (26) |
| Nome pacchetto | `club.notturnisti.app`. È definitivo: deve coincidere con l'`applicationId` dell'AAB |
| Lingua predefinita | Italiano – it-IT |
| App o gioco | App |
| Gratis o a pagamento | Senza costi. Dopo la pubblicazione non si può più rendere a pagamento; il Club e i contributi restano fuori da Play |
| Protezione automatica | Lasciala attiva: chi installa l'APK da altre fonti viene mandato su Play. Non cambia niente per i dati |

**Dichiarazioni** (tutte e tre da spuntare):
- Norme del programma per gli sviluppatori: sì. La descrizione in `scheda.md` evita superlativi, nomi di altre app e parole chiave ripetute, e dice chiaramente che non è un dispositivo medico.
- Firma dell'app di Play: accetta. Google tiene la chiave di firma, tu solo quella di upload (`app/README.md`).
- Leggi sull'esportazione USA: accetta. L'app usa solo la crittografia standard del sistema (HTTPS), che è esente.

## Scheda dello Store (Crescita → Presenza nello Store → Scheda principale)

| Campo | File o testo |
|---|---|
| Icona dell'app (512×512, PNG 32 bit, ≤1 MB) | `img/icona-app-512.png`: a tutto quadrato, fondo crema `#F7F3EA` come l'icona sul telefono. Play arrotonda gli angoli da solo |
| Immagine in evidenza (1024×500) | `img/feature-1024x500.png` |
| Screenshot del telefono (2–8, 1080×1920) | `img/01-oggi.png` … `img/08-impostazioni.png`, in quest'ordine |
| Nome, descrizione breve, descrizione completa | `scheda.md` |
| Categoria, tag, contatti, privacy | `scheda.md` → «Categoria, tag e contatti» |

Tutti i file sono RGB senza trasparenza e rientrano nei limiti di peso.
