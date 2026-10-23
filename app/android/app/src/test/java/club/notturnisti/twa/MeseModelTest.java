package club.notturnisti.twa;

import static org.junit.Assert.*;

import org.json.JSONObject;
import org.junit.Test;

public class MeseModelTest {
    private static MeseModel prova(int giorni, int persone, int sel) throws Exception {
        StringBuilder io = new StringBuilder(), p = new StringBuilder();
        for (int i = 0; i < giorni; i++) io.append(i > 0 ? "," : "").append("\"").append(i % 3 == 0 ? "N:n" : i % 3 == 1 ? "R:r" : "M:l").append("\"");
        for (int k = 0; k < persone; k++) {
            StringBuilder g = new StringBuilder();
            StringBuilder ins = new StringBuilder();
            for (int i = 0; i < giorni; i++) { g.append(i > 0 ? "," : "").append("\"").append("P" + k).append(":l\""); ins.append(i % 5 == 0 ? '1' : '0'); }
            p.append(k > 0 ? "," : "").append("{\"n\":\"Persona").append(k).append("\",\"g\":[").append(g).append("],\"i\":\"").append(ins).append("\"}");
        }
        return MeseModel.leggi(new JSONObject("{\"da\":\"2026-10-19\",\"io\":[" + io + "],\"p\":[" + p + "],\"sel\":" + sel + ",\"star\":\"s" + sel + "\"}"));
    }

    @Test public void leggeSigleETipi() throws Exception {
        MeseModel m = prova(14, 1, 0);
        assertEquals("N", m.mio(0).sigla); assertEquals('n', m.mio(0).tipo);
        assertEquals('r', m.mio(1).tipo); assertEquals('l', m.mio(2).tipo);
        assertEquals("P0", m.di(0, 3).sigla);
        assertNull(m.mio(99)); assertNull(m.di(5, 0));
    }

    @Test public void datiRotti() throws Exception {
        assertNull(MeseModel.leggi(null));
        assertNull(MeseModel.leggi(new JSONObject("{}")));
        assertNull(MeseModel.leggi(new JSONObject("{\"da\":\"x\",\"io\":[\"N:n\"]}")));
        MeseModel m = MeseModel.leggi(new JSONObject("{\"da\":\"2026-10-19\",\"io\":[\"N\",\"X:q\",\"M:\"]}"));
        assertEquals('?', m.mio(0).tipo); assertEquals("X", m.mio(1).sigla); assertEquals('?', m.mio(1).tipo); assertEquals('?', m.mio(2).tipo);
    }

    // ottobre 2026: il 1° è giovedì; i dati partono da lunedì 28 settembre e coprono fino a fine gennaio
    private static MeseModel ottobre() throws Exception {
        StringBuilder io = new StringBuilder();
        for (int i = 0; i < 126; i++) io.append(i > 0 ? "," : "").append("\"R:r\"");
        return MeseModel.leggi(new JSONObject("{\"da\":\"2026-09-28\",\"io\":[" + io + "],\"p\":[]}"));
    }

    @Test public void mesiEGriglia() throws Exception {
        MeseModel m = ottobre();
        assertArrayEquals(new int[]{ 2026, 10 }, m.meseCorrente());
        MeseModel.Griglia g = m.griglia(0);
        assertEquals("ottobre 2026 inizia giovedì: 3 vuoti, 31 giorni → 5 settimane", 5, g.settimane);
        assertEquals(3, g.vuoti); assertEquals(0, g.primo); assertEquals(31, g.nGiorni);
        assertFalse(g.inMese(2)); assertTrue(g.inMese(3)); assertTrue(g.inMese(33)); assertFalse(g.inMese(34));
        assertEquals("1° di ottobre", 1, g.numero(m, 3)); assertEquals("fine settembre", 30, g.numero(m, 2));
        MeseModel.Griglia nov = m.griglia(1);
        assertEquals("novembre 2026 inizia domenica: 6 vuoti, 30 giorni → 6 settimane", 6, nov.settimane);
        assertEquals(28, nov.primo);   // lunedì 26 ottobre
        assertEquals(2026, nov.anno); assertEquals(11, nov.mese);
        assertArrayEquals(new int[]{ 2026, 10, 26 }, m.data(nov.primo));
    }

    @Test public void indiceDiUnaData() throws Exception {
        MeseModel m = ottobre();
        assertEquals(0, m.indice(2026, 9, 28)); assertEquals(3, m.indice(2026, 10, 1));
        assertEquals("giorno del cambio d'ora", 27, m.indice(2026, 10, 25));
        assertEquals(-1, m.indice(2026, 9, 27)); assertEquals(-1, m.indice(2027, 2, 1));
    }

    @Test public void finoDoveCopronoIDati() throws Exception {
        MeseModel m = ottobre();                       // 126 giorni → fino a domenica 31 gennaio
        assertEquals(3, m.ultimoMese());
        assertNull(m.griglia(4)); assertNull(m.griglia(-1));
        assertNotNull(m.griglia(3));
    }

    @Test public void cambioOraENonBisestile() throws Exception {
        // il 25 ottobre 2026 si torna all'ora solare: i giorni restano 24 «di calendario»
        MeseModel m = ottobre();
        assertArrayEquals(new int[]{ 2026, 10, 25 }, m.data(27));
        assertArrayEquals(new int[]{ 2026, 10, 26 }, m.data(28));
        // febbraio 2027 (28 giorni, inizia lunedì → 4 settimane) con dati che partono a gennaio
        StringBuilder io = new StringBuilder();
        for (int i = 0; i < 140; i++) io.append(i > 0 ? "," : "").append("\"R:r\"");
        MeseModel f = MeseModel.leggi(new JSONObject("{\"da\":\"2027-01-25\",\"io\":[" + io + "],\"p\":[]}"));
        assertArrayEquals(new int[]{ 2027, 1 }, f.meseCorrente());
        MeseModel.Griglia feb = f.griglia(1);
        assertEquals(4, feb.settimane); assertEquals(0, feb.vuoti); assertEquals(28, feb.nGiorni);
    }

    @Test public void insieme() throws Exception {
        MeseModel m = prova(14, 1, 0);
        assertTrue(m.insieme(0, 0)); assertFalse(m.insieme(0, 1)); assertTrue(m.insieme(0, 5)); assertFalse(m.insieme(0, 100));
        assertFalse("persona inesistente", m.insieme(3, 0)); assertFalse(prova(14, 0, 0).insieme(0, 0));
    }

    @Test public void personaAttivaRestaFinoAllaStellinaNuova() throws Exception {
        MeseModel m = prova(14, 3, 1);
        assertEquals("senza persone", -1, prova(14, 0, 0).personaAttiva(0, "s0"));
        assertEquals("nessuna scelta dal widget: la stellina", 1, m.personaAttiva(-1, "s1"));
        assertEquals("scelta dal widget, stellina invariata: resta", 2, m.personaAttiva(2, "s1"));
        assertEquals("stellina cambiata nell'app: riparte da lei", 1, m.personaAttiva(2, "s0"));
        assertEquals("mai vista: riparte da lei", 1, m.personaAttiva(2, ""));
        assertEquals("scelta fuori elenco (persona tolta): la stellina", 1, m.personaAttiva(7, "s1"));
        assertEquals("giro", 0, m.prossimaPersona(2)); assertEquals(2, m.prossimaPersona(1));
        assertEquals(-1, prova(14, 0, 0).prossimaPersona(0));
    }

    @Test public void stellinaFuoriElencoTornaAZero() throws Exception {
        assertEquals(0, prova(14, 2, 9).sel);
    }
}
