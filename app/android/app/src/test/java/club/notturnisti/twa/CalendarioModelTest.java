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

    @Test public void leggeSigleETipi() throws Exception {
        CalendarioModel m = CalendarioModel.leggi(new JSONObject("{\"da\":\"2026-10-19\",\"io\":[\"N:n\",\"Fe:r\",\"M•:l\",\"x\"],\"p\":[{\"n\":\"Anna\",\"g\":[\"M:l\",\"R:r\"]}]}"));
        assertEquals("N", m.mio(0).sigla); assertEquals('n', m.mio(0).tipo);
        assertEquals("Fe", m.mio(1).sigla); assertEquals('r', m.mio(1).tipo);
        assertEquals("M•", m.mio(2).sigla); assertEquals('l', m.mio(2).tipo);
        assertEquals("senza tipo", '?', m.mio(3).tipo);
        assertEquals("Anna", m.persone.get(0).nome); assertEquals("M", m.di(0, 0).sigla);
        assertNull("oltre i dati", m.di(0, 5)); assertNull(m.mio(-1)); assertNull("persona che non c'è", m.di(3, 0));
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
        assertEquals("Ottobre", m.titolo(0, 2026));
        assertEquals("settimana 26 ott – 1 nov: il giovedì 29 è di ottobre", "Ottobre", m.titolo(1, 2026));
        assertEquals("settimana 2–8 nov", "Novembre", m.titolo(2, 2026));
        assertEquals("un altro anno lo dice", "Novembre 2026", m.titolo(2, 2027));
        assertArrayEquals("cambio d'anno", new int[]{ 2027, 1, 1 }, prova("2026-12-28", 0, 0).data(4));
        assertEquals("settimana 28 dic – 3 gen: il giovedì 31 è di dicembre", "Dicembre", prova("2026-12-28", 0, 0).titolo(0, 2026));
        assertEquals("settimana 4–10 gen", "Gennaio 2027", prova("2026-12-28", 0, 0).titolo(1, 2026));
        assertArrayEquals(new int[]{ 2026, 10 }, m.meseDellaRiga(1));
    }

    @Test public void riposoInComune() throws Exception {
        CalendarioModel m = CalendarioModel.leggi(new JSONObject("{\"da\":\"2026-10-19\",\"io\":[\"R:r\",\"R:r\",\"M:l\",\"Fe:r\",\"?:?\"],\"p\":[{\"n\":\"Anna\",\"g\":[\"R:r\",\"M:l\",\"R:r\",\"R:r\",\"R:r\"]}]}"));
        assertTrue("tutti e due a riposo", m.riposoInComune(0, 0));
        assertFalse("lei lavora", m.riposoInComune(0, 1));
        assertFalse("io lavoro", m.riposoInComune(0, 2));
        assertTrue("le ferie sono riposo", m.riposoInComune(0, 3));
        assertFalse("giorno da impostare: non si sa", m.riposoInComune(0, 4));
        assertFalse("oltre i dati", m.riposoInComune(0, 99));
        assertFalse("persona che non c'è", m.riposoInComune(3, 0));
    }

    // 20 settimane: la quinta (indice 4) è quella di oggi, quattro prima e quindici dopo; si vedono 4 righe
    @Test public void primaRigaEPagine() {
        int oggi = 4, sett = 20, righe = 4;
        assertEquals("senza spostamento: la settimana di oggi", 4, CalendarioModel.primaRiga(oggi, 0, righe, sett));
        assertEquals(2, CalendarioModel.primaRiga(oggi, -2, righe, sett));
        assertEquals("non prima dei dati", 0, CalendarioModel.primaRiga(oggi, -9, righe, sett));
        assertEquals("non oltre i dati: l'ultima pagina piena", 16, CalendarioModel.primaRiga(oggi, 99, righe, sett));
        assertEquals("dati che non contengono oggi: dalla prima", 0, CalendarioModel.primaRiga(-1, 0, righe, sett));
        assertEquals("pochi dati: mai negativa", 0, CalendarioModel.primaRiga(0, 3, 5, 3));

        // › : una pagina avanti, cioè 4 settimane → riga 8, che è +4 da oggi
        int sp = CalendarioModel.paginaDopo(oggi, 0, righe, sett, 1);
        assertEquals(4, sp); assertEquals(8, CalendarioModel.primaRiga(oggi, sp, righe, sett));
        // ‹ da lì torna a oggi; un'altra indietro arriva in cima (riga 0) e si ferma
        sp = CalendarioModel.paginaDopo(oggi, sp, righe, sett, -1);
        assertEquals(0, sp);
        sp = CalendarioModel.paginaDopo(oggi, sp, righe, sett, -1);
        assertEquals(0, CalendarioModel.primaRiga(oggi, sp, righe, sett));
        sp = CalendarioModel.paginaDopo(oggi, sp, righe, sett, -1);
        assertEquals("in cima resta in cima", 0, CalendarioModel.primaRiga(oggi, sp, righe, sett));
        // › fino in fondo: l'ultima pagina è piena e non va oltre
        sp = 0; for (int k = 0; k < 10; k++) sp = CalendarioModel.paginaDopo(oggi, sp, righe, sett, 1);
        assertEquals(16, CalendarioModel.primaRiga(oggi, sp, righe, sett));
        assertEquals("e si torna indietro da dove si è davvero, non dal valore grezzo", 12,
            CalendarioModel.primaRiga(oggi, CalendarioModel.paginaDopo(oggi, sp, righe, sett, -1), righe, sett));
    }

    @Test public void spostamentoVaSoloPerIlGiornoInCuiSiFa() {
        assertEquals(4, CalendarioModel.spostamentoValido(4, "2026-10-25", "2026-10-25"));
        assertEquals("il giorno dopo si riparte da oggi", 0, CalendarioModel.spostamentoValido(4, "2026-10-25", "2026-10-26"));
        assertEquals("mai salvato", 0, CalendarioModel.spostamentoValido(4, "", "2026-10-25"));
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
