package club.notturnisti.twa;

import static org.junit.Assert.*;

import org.junit.Test;

public class WidgetPianoTest {
    @Test public void piccoloSoloAdesso() {
        WidgetPiano p = WidgetPiano.calcola(90, false, true, 2, false, 5);
        assertFalse(p.pulsante); assertEquals(0, p.voci); assertFalse(p.calendario);
    }

    @Test public void cresceUnPezzoAllaVolta() {
        WidgetPiano p = WidgetPiano.calcola(130, false, true, 2, false, 5);
        assertTrue("col pulsante prima di tutto il resto", p.pulsante); assertEquals(0, p.voci); assertFalse(p.calendario);
        p = WidgetPiano.calcola(180, false, true, 2, false, 5);
        assertTrue(p.pulsante); assertEquals(2, p.voci); assertFalse(p.calendario);
        p = WidgetPiano.calcola(285, false, true, 2, false, 5);
        assertTrue(p.pulsante); assertTrue(p.calendario); assertEquals(1, p.righe); assertEquals(2, p.voci);
    }

    @Test public void conPersonaLeRigheSonoPiuAlte() {
        WidgetPiano p = WidgetPiano.calcola(285, false, true, 2, true, 5);
        assertTrue(p.calendario); assertEquals("con la persona una sola settimana", 1, p.righe);
        assertFalse("e il calendario non si apre su una stima ottimistica", WidgetPiano.calcola(240, false, true, 2, true, 5).calendario);
    }

    @Test public void altoRiempieConLeSettimane() {
        WidgetPiano p = WidgetPiano.calcola(385, false, false, 2, true, 5);
        assertTrue(p.calendario); assertEquals(4, p.righe);
        assertEquals(5, WidgetPiano.calcola(560, false, false, 2, true, 5).righe);
        assertEquals("mai oltre le righe che ci sono", 3, WidgetPiano.calcola(900, false, false, 2, true, 3).righe);
    }

    @Test public void ilMeseInteroAncheConLaPersona() {
        WidgetPiano p = WidgetPiano.calcola(485, false, true, 2, true, 5);
        assertTrue(p.calendario); assertEquals("cinque settimane, con due sigle per giorno", 5, p.righe);
    }

    @Test public void unLauncherCheDiceMenoDelVeroNonLasciaIlBuco() {
        // 140 dp dichiarati (ne ha ~185): dopo il pulsante c'è posto per la prima voce
        assertEquals(1, WidgetPiano.calcola(140, false, true, 2, false, 5).voci);
        // il calendario invece non si apre su una stima ottimistica
        assertFalse(WidgetPiano.calcola(220, false, true, 2, false, 5).calendario);
    }

    @Test public void alMassimoDueVoci() {
        assertEquals("l'evento attuale e uno o due successivi, mai di più", 2, WidgetPiano.calcola(190, false, true, 4, false, 5).voci);
        assertEquals(2, WidgetPiano.calcola(225, false, true, 4, true, 5).voci);
    }

    @Test public void ilMeseInteroSeiSettimaneAncheConLaPersona() {
        WidgetPiano p = WidgetPiano.calcola(555, false, true, 2, true, 6);
        assertTrue(p.calendario); assertEquals("sei settimane con due sigle per giorno", 6, p.righe);
        // se per il mese intero bisogna togliere le voci, si tolgono
        WidgetPiano q = WidgetPiano.calcola(520, false, true, 2, true, 6);
        assertEquals(6, q.righe); assertEquals(0, q.voci);
    }

    @Test public void laBarraSoloSeInCorso() {
        assertTrue(WidgetPiano.calcola(130, true, false, 2, false, 5).barra);
        assertFalse(WidgetPiano.calcola(130, false, false, 2, false, 5).barra);
    }

    @Test public void senzaDatiDelCalendarioNiente() {
        assertFalse(WidgetPiano.calcola(900, false, false, 2, false, 0).calendario);
    }
}
