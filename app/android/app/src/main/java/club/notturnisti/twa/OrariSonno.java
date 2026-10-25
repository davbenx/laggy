package club.notturnisti.twa;

import java.util.Locale;

/**
 * Gli orari del sonno che si correggono dal widget: solo conti sui minuti (da mezzanotte), senza Android, così
 * si provano sulla JVM. Stessa soglia dell'app per le voci implausibili (sotto 1 ora o sopra 16 ore di sonno).
 */
final class OrariSonno {
    static final int MIN = 60, MAX = 16 * 60, PASSO = 30;

    private OrariSonno() { }

    /** «23:30» → 1410; -1 se non è un orario. */
    static int minuti(String hhmm) {
        if (hhmm == null || !hhmm.matches("[0-2]\\d:[0-5]\\d")) return -1;
        int h = Integer.parseInt(hhmm.substring(0, 2)), m = Integer.parseInt(hhmm.substring(3, 5));
        return h > 23 ? -1 : h * 60 + m;
    }

    static String hhmm(int minuti) {
        int m = ((minuti % 1440) + 1440) % 1440;
        return String.format(Locale.ROOT, "%02d:%02d", m / 60, m % 60);
    }

    /** Sposta un orario di `delta` minuti, restando nella giornata (23:45 + 30 = 00:15). */
    static int sposta(int minuti, int delta) { return ((minuti + delta) % 1440 + 1440) % 1440; }

    /** Minuti dal letto alla sveglia, anche a cavallo di mezzanotte. Letto e sveglia uguali: 0 (non è un sonno). */
    static int durata(int letto, int sveglia) { return ((sveglia - letto) % 1440 + 1440) % 1440; }

    static boolean plausibile(int durata) { return durata >= MIN && durata <= MAX; }

    /** «7h40», «8h». */
    static String testo(int durata) {
        int h = durata / 60, m = durata % 60;
        return m == 0 ? h + "h" : h + "h" + String.format(Locale.ROOT, "%02d", m);
    }

    /**
     * «p» se gli orari sono quelli del piano (una conferma, non una misura), «m» se sono stati corretti. La pagina
     * non fa entrare le notti «p» nel conto della regolarità: gli orari del piano sono regolari per costruzione.
     */
    static String fonte(int letto, int sveglia, int pianoLetto, int pianoSveglia) {
        return letto == pianoLetto && sveglia == pianoSveglia ? "p" : "m";
    }
}
