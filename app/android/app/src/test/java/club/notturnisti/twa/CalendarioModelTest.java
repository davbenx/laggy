package club.notturnisti.twa;

import static org.junit.Assert.*;

import org.json.JSONObject;
import org.junit.Test;

public class CalendarioModelTest {
    private static String lista(int n, String s) {
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < n; i++) b.append(i > 0 ? "," : "").append("\"").append(s).append("\"");
        return b.toString();
    }
    private static CalendarioModel prova(String da, int persone, int sel) throws Exception {
        StringBuilder p = new StringBuilder();
        for (int k = 0; k < persone; k++) p.append(k > 0 ? "," : "").append("{\"n\":\"P").append(k).append("\",\"g\":[").append(lista(42, "M:l")).append("]}");
        return CalendarioModel.leggi(new JSONObject("{\"da\":\"" + da + "\",\"io\":[" + lista(42, "R:r") + "],\"p\":[" + p + "],\"sel\":" + sel + ",\"star\":\"s" + sel + "\"}"));
    }

    @Test public void leggeLeFasceDelTurno() throws Exception {
        CalendarioModel m = CalendarioModel.leggi(new JSONObject("{\"da\":\"2026-10-19\",\"io\":[\"M:m\",\"P:p\",\"S:s\",\"N:n\",\"R:r\",\"X:z\"],\"p\":[]}"));
        assertEquals('m', m.mio(0).tipo); assertEquals('p', m.mio(1).tipo); assertEquals('s', m.mio(2).tipo);
        assertEquals('n', m.mio(3).tipo); assertEquals('r', m.mio(4).tipo); assertEquals("fascia sconosciuta", '?', m.mio(5).tipo);
    }

    @Test public void leggeSigleETipi() throws Exception {
        CalendarioModel m = CalendarioModel.leggi(new JSONObject("{\"da\":\"2026-10-19\",\"io\":[\"N:n\",\"Fe:r\",\"M•:l\",\"x\"],\"p\":[{\"n\":\"Anna\",\"g\":[\"M:l\",\"R:r\"]}]}"));
        assertEquals("N", m.mio(0).sigla); assertEquals('n', m.mio(0).tipo);
        assertEquals("Fe", m.mio(1).sigla); assertEquals('r', m.mio(1).tipo);
        assertEquals("M•", m.mio(2).sigla); assertEquals('l', m.mio(2).tipo);
        assertEquals("senza tipo", '?', m.mio(3).tipo);
        assertEquals("Anna", m.persone.get(0).nome); assertEquals("M", m.di(0, 0).sigla);
        assertNull("oltre i dati", m.di(0, 5)); assertNull(m.mio(-1)); assertNull("persona che non c'è", m.di(3, 0));
    }

    @Test public void leggeSigleConIcone() throws Exception {
        CalendarioModel m = CalendarioModel.leggi(new JSONObject("{\"da\":\"2026-10-19\",\"io\":[\"☀️ M:m\",\"🌙 N:n:f\",\"✨ R:r\"],\"p\":[{\"n\":\"Anna\",\"g\":[\"🌅 P:p\"]}]}"));
        assertEquals("☀️ M", m.mio(0).sigla); assertEquals('m', m.mio(0).tipo);
        assertEquals("🌙 N", m.mio(1).sigla); assertEquals('n', m.mio(1).tipo); assertTrue(m.mio(1).festivo);
        assertEquals("✨ R", m.mio(2).sigla); assertEquals('r', m.mio(2).tipo);
        assertEquals("🌅 P", m.di(0, 0).sigla); assertEquals('p', m.di(0, 0).tipo);
    }

    @Test public void leggeFestiviEGiorniModificati() throws Exception {
        CalendarioModel m = CalendarioModel.leggi(new JSONObject("{\"da\":\"2026-10-19\",\"io\":[\"R:r:f\",\"M:m:x\",\"N:n:fx\",\"P:p\",\"A:b:c:l:x\",\"Q:z:f\"],\"p\":[]}"));
        assertTrue(m.mio(0).festivo); assertFalse(m.mio(0).modificato); assertEquals("R", m.mio(0).sigla); assertEquals('r', m.mio(0).tipo);
        assertTrue(m.mio(1).modificato); assertFalse(m.mio(1).festivo); assertEquals('m', m.mio(1).tipo);
        assertTrue(m.mio(2).festivo && m.mio(2).modificato); assertEquals('n', m.mio(2).tipo);
        assertFalse("senza segni, come le app più vecchie", m.mio(3).festivo || m.mio(3).modificato); assertEquals('p', m.mio(3).tipo);
        assertEquals("sigla con i due punti", "A:b:c", m.mio(4).sigla); assertEquals('l', m.mio(4).tipo); assertTrue(m.mio(4).modificato);
        assertEquals("tipo sconosciuto resta sconosciuto", '?', m.mio(5).tipo); assertTrue(m.mio(5).festivo);
    }

    @Test public void datiRotti() throws Exception {
        assertNull(CalendarioModel.leggi(null));
        assertNull(CalendarioModel.leggi(new JSONObject("{}")));
        assertNull(CalendarioModel.leggi(new JSONObject("{\"da\":\"x\",\"io\":[\"N:n\"]}")));
        assertNull(CalendarioModel.leggi(new JSONObject("{\"da\":\"2026-10-19\",\"io\":[]}")));
        assertEquals("persona senza giorni: come se non ci fosse", 0,
            CalendarioModel.leggi(new JSONObject("{\"da\":\"2026-10-19\",\"io\":[\"N:n\"],\"p\":[{\"n\":\"A\",\"g\":[]}]}")).persone.size());
        assertEquals("stellina fuori elenco: la prima", 0, prova("2026-10-19", 2, 9).sel);
    }

    @Test public void dateEMesi() throws Exception {
        CalendarioModel m = prova("2026-10-19", 0, 0);       // lunedì 19 ottobre
        assertEquals(6, m.settimane());   // la prova usa 42 giorni: le settimane sono quelle dei dati
        assertArrayEquals(new int[]{ 2026, 10, 19 }, m.data(0));
        assertArrayEquals("dopo il cambio d'ora del 25", new int[]{ 2026, 10, 26 }, m.data(7));
        assertArrayEquals("cambio di mese", new int[]{ 2026, 11, 1 }, m.data(13));
        assertEquals(5, m.indice(2026, 10, 24)); assertEquals(6, m.indice(2026, 10, 25)); assertEquals(-1, m.indice(2026, 10, 18)); assertEquals(-1, m.indice(2027, 1, 1));
        assertArrayEquals("cambio d'anno", new int[]{ 2027, 1, 1 }, prova("2026-12-28", 0, 0).data(4));
    }

    // Come la pagina: 20 settimane da lunedì 21 settembre 2026. Righe: 0 = 21 set, 1 = 28 set (1ª di ottobre: il giovedì è l'1),
    // 4 = 19 ott (oggi), 6 = 2 nov (1ª di novembre), 10 = 30 nov (1ª di dicembre), 15 = 4 gen, 19 = 1 feb.
    private static CalendarioModel venti() throws Exception {
        return CalendarioModel.leggi(new JSONObject("{\"da\":\"2026-09-21\",\"io\":[" + lista(140, "R:r") + "]}"));
    }

    @Test public void mesiInteri() throws Exception {
        CalendarioModel m = venti();
        assertArrayEquals(new int[]{ 2027, 1 }, CalendarioModel.meseSpostato(2026, 11, 2));
        assertArrayEquals(new int[]{ 2025, 12 }, CalendarioModel.meseSpostato(2026, 1, -1));
        assertArrayEquals("novembre 2026: dalla settimana del 26 ottobre a quella del 30 novembre", new int[]{ 5, 10 }, m.righeMese(2026, 11));
        assertArrayEquals("settembre comincia prima dei dati", new int[]{ 0, 1 }, m.righeMese(2026, 9));
        assertNull("fuori dai dati", m.righeMese(2027, 6));
        // ‹ › solo sui mesi interi (come calendario.js): 140 giorni dal 21/9/2026 finiscono il 7/2/2027
        assertTrue("ottobre è tutto dentro", m.meseIntero(2026, 10));
        assertFalse("settembre comincia prima dei dati", m.meseIntero(2026, 9));
        assertFalse("febbraio 2027 è a metà", m.meseIntero(2027, 2));
        int[] nov = m.righeMese(2026, 11);
        assertEquals("6 righe: novembre intero", 5, CalendarioModel.primaRigaMese(nov, 7, true, 6, 20));
        assertEquals("3 righe, mese di oggi: dalla settimana di oggi", 7, CalendarioModel.primaRigaMese(nov, 7, true, 3, 20));
        assertEquals("a fine mese: le ultime settimane, non oltre", 8, CalendarioModel.primaRigaMese(nov, 10, true, 3, 20));
        assertEquals("un altro mese: dal giorno 1", 5, CalendarioModel.primaRigaMese(nov, 7, false, 3, 20));
        assertEquals("in fondo ai dati non si esce", 14, CalendarioModel.primaRigaMese(new int[]{ 18, 19 }, -1, false, 6, 20));
        assertEquals("Novembre", CalendarioModel.titoloMese(2026, 11, 2026));
        assertEquals("Gennaio 2027", CalendarioModel.titoloMese(2027, 1, 2026));
    }

    @Test public void spostamentoVaSoloPerIlGiornoInCuiSiFa() {
        long t0 = 1_000_000_000L, ora = t0 + 10 * 60_000L;
        assertEquals("stesso giorno, stesse righe, da 10 minuti", 4, CalendarioModel.spostamentoValido(4, "2026-10-25", "2026-10-25", 5, 5, t0, ora));
        assertEquals("il giorno dopo si riparte da oggi", 0, CalendarioModel.spostamentoValido(4, "2026-10-25", "2026-10-26", 5, 5, t0, ora));
        assertEquals("mai salvato", 0, CalendarioModel.spostamentoValido(4, "", "2026-10-25", 5, 5, t0, ora));
        assertEquals("le righe sono cambiate (widget ridimensionato): un passo per un'altra altezza non vale", 0, CalendarioModel.spostamentoValido(-1, "2026-10-25", "2026-10-25", 1, 5, t0, ora));
        assertEquals("quasi un'ora", 4, CalendarioModel.spostamentoValido(4, "2026-10-25", "2026-10-25", 5, 5, t0, t0 + CalendarioModel.SCADENZA_SPOSTAMENTO - 1));
        assertEquals("un'ora dopo si torna a oggi", 0, CalendarioModel.spostamentoValido(4, "2026-10-25", "2026-10-25", 5, 5, t0, t0 + CalendarioModel.SCADENZA_SPOSTAMENTO));
        assertEquals("orologio indietro (cambio d'ora o impostazioni): non vale", 0, CalendarioModel.spostamentoValido(4, "2026-10-25", "2026-10-25", 5, 5, t0, t0 - 1));
    }

    @Test public void personaScelta() throws Exception {
        CalendarioModel m = prova("2026-10-19", 3, 1);
        assertEquals("senza persone", -1, prova("2026-10-19", 0, 0).personaAttiva(0, "s0"));
        assertEquals("nessuna scelta: la stellina", 1, m.personaAttiva(CalendarioModel.SEGUI_STELLA, "s1"));
        assertEquals("scelta del widget, stellina invariata: resta", 2, m.personaAttiva(2, "s1"));
        assertEquals("nascosta resta nascosta", -1, m.personaAttiva(CalendarioModel.NASCOSTA, "s1"));
        assertEquals("stellina cambiata nell'app: riparte da lei, anche se era nascosta", 1, m.personaAttiva(CalendarioModel.NASCOSTA, "s0"));
        assertEquals("mai vista: riparte da lei", 1, m.personaAttiva(2, ""));
        assertEquals("scelta fuori elenco (persona tolta)", 1, m.personaAttiva(7, "s1"));
    }

    @Test public void tocchiSulNome() throws Exception {
        CalendarioModel tre = prova("2026-10-19", 3, 0);
        assertEquals(1, tre.dopo(0)); assertEquals(2, tre.dopo(1));
        assertEquals("dopo l'ultima: nascosta", CalendarioModel.NASCOSTA, tre.dopo(2));
        assertEquals("da nascosta: la prima", 0, tre.dopo(CalendarioModel.NASCOSTA));
        CalendarioModel una = prova("2026-10-19", 1, 0);
        assertEquals(CalendarioModel.NASCOSTA, una.dopo(0)); assertEquals(0, una.dopo(CalendarioModel.NASCOSTA));
    }
}
