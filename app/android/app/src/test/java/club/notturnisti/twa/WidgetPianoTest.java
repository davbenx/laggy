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
        p = WidgetPiano.calcola(270, false, true, 2, false, 5);
        assertTrue(p.pulsante); assertTrue(p.calendario); assertEquals(1, p.righe); assertEquals(2, p.voci);
    }

    @Test public void conPersonaLeRigheSonoPiuAlte() {
        WidgetPiano p = WidgetPiano.calcola(270, false, true, 2, true, 5);
        assertTrue(p.calendario); assertEquals(1, p.righe); assertEquals("la seconda voce cede il posto", 1, p.voci);
    }

    @Test public void altoRiempieConLeSettimane() {
        WidgetPiano p = WidgetPiano.calcola(460, false, false, 2, true, 5);
        assertTrue(p.calendario); assertEquals(4, p.righe); assertEquals(2, p.voci);
        assertEquals(5, WidgetPiano.calcola(560, false, false, 2, true, 5).righe);
        assertEquals("mai oltre le righe che ci sono", 3, WidgetPiano.calcola(900, false, false, 2, true, 3).righe);
    }

    @Test public void laBarraSoloSeInCorso() {
        assertTrue(WidgetPiano.calcola(130, true, false, 2, false, 5).barra);
        assertFalse(WidgetPiano.calcola(130, false, false, 2, false, 5).barra);
    }

    @Test public void senzaDatiDelCalendarioNiente() {
        assertFalse(WidgetPiano.calcola(900, false, false, 2, false, 0).calendario);
    }
}
