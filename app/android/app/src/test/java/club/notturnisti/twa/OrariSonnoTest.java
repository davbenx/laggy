package club.notturnisti.twa;

import static org.junit.Assert.*;

import org.junit.Test;

public class OrariSonnoTest {
    @Test public void leggeEScriveGliOrari() {
        assertEquals(1410, OrariSonno.minuti("23:30")); assertEquals(0, OrariSonno.minuti("00:00")); assertEquals(1439, OrariSonno.minuti("23:59"));
        assertEquals("non un orario", -1, OrariSonno.minuti("24:00")); assertEquals(-1, OrariSonno.minuti("7:10")); assertEquals(-1, OrariSonno.minuti("")); assertEquals(-1, OrariSonno.minuti(null)); assertEquals(-1, OrariSonno.minuti("12:60"));
        assertEquals("23:30", OrariSonno.hhmm(1410)); assertEquals("00:05", OrariSonno.hhmm(5)); assertEquals("fuori dalla giornata", "00:15", OrariSonno.hhmm(1455)); assertEquals("23:45", OrariSonno.hhmm(-15));
    }

    @Test public void spostaRestandoNellaGiornata() {
        assertEquals("23:45 + 30 passa la mezzanotte", OrariSonno.minuti("00:15"), OrariSonno.sposta(OrariSonno.minuti("23:45"), 30));
        assertEquals("00:10 - 30 torna a ieri sera", OrariSonno.minuti("23:40"), OrariSonno.sposta(OrariSonno.minuti("00:10"), -30));
        assertEquals(OrariSonno.minuti("07:40"), OrariSonno.sposta(OrariSonno.minuti("07:10"), OrariSonno.PASSO));
    }

    @Test public void durataAnCheAvallo() {
        assertEquals("23:30 → 07:10", 460, OrariSonno.durata(OrariSonno.minuti("23:30"), OrariSonno.minuti("07:10")));
        assertEquals("03:10 → 09:55, tutto dopo mezzanotte", 405, OrariSonno.durata(OrariSonno.minuti("03:10"), OrariSonno.minuti("09:55")));
        assertEquals("stesso orario: non è un sonno", 0, OrariSonno.durata(480, 480));
        assertEquals("09:00 → 08:00 sono 23 ore (e non è plausibile)", 23 * 60, OrariSonno.durata(OrariSonno.minuti("09:00"), OrariSonno.minuti("08:00")));
    }

    @Test public void plausibileFraUnaESediciOre() {
        assertFalse(OrariSonno.plausibile(0)); assertFalse(OrariSonno.plausibile(59)); assertTrue(OrariSonno.plausibile(60));
        assertTrue(OrariSonno.plausibile(16 * 60)); assertFalse(OrariSonno.plausibile(16 * 60 + 1)); assertFalse(OrariSonno.plausibile(23 * 60));
    }

    @Test public void testoDellaDurata() {
        assertEquals("7h40", OrariSonno.testo(460)); assertEquals("8h", OrariSonno.testo(480)); assertEquals("6h05", OrariSonno.testo(365)); assertEquals("1h", OrariSonno.testo(60));
    }

    @Test public void laFonteDistingueConfermaECorrezione() {
        int l = OrariSonno.minuti("23:30"), s = OrariSonno.minuti("07:10");
        assertEquals("come da piano", "p", OrariSonno.fonte(l, s, l, s));
        assertEquals("letto corretto", "m", OrariSonno.fonte(OrariSonno.sposta(l, 30), s, l, s));
        assertEquals("sveglia corretta", "m", OrariSonno.fonte(l, OrariSonno.sposta(s, -30), l, s));
        assertEquals("corretto e poi riportato al piano: è di nuovo una conferma", "p", OrariSonno.fonte(OrariSonno.sposta(OrariSonno.sposta(l, 30), -30), s, l, s));
    }
}
