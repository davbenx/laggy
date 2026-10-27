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

    // Come la pagina: 20 settimane da lunedì 21 settembre 2026. Righe: 0 = 21 set, 1 = 28 set (1ª di ottobre: il giovedì è l'1),
    // 4 = 19 ott (oggi), 6 = 2 nov (1ª di novembre), 10 = 30 nov (1ª di dicembre), 15 = 4 gen, 19 = 1 feb.
    private static CalendarioModel venti() throws Exception {
        return CalendarioModel.leggi(new JSONObject("{\"da\":\"2026-09-21\",\"io\":[" + lista(140, "R:r") + "]}"));
    }

    @Test public void inizioDeiMesi() throws Exception {
        CalendarioModel m = venti();
        for (int r : new int[]{ 1, 6, 10, 15, 19 }) assertTrue("riga " + r, m.inizioMese(r));
        for (int r : new int[]{ 0, 2, 3, 4, 5, 7, 8, 9, 11, 12, 13, 14, 16, 17, 18 }) assertFalse("riga " + r, m.inizioMese(r));
        assertEquals("19 ott", "Ottobre", m.titolo(4, 2026));
        assertEquals("26 ott – 1 nov: il giovedì è il 29", "Ottobre", m.titolo(5, 2026));
        assertEquals("16 nov", "Novembre", m.titolo(8, 2026));
        assertEquals("30 nov – 6 dic: il giovedì è il 3", "Dicembre", m.titolo(10, 2026));
        assertEquals("28 dic – 3 gen: il giovedì è il 31", "Dicembre", m.titolo(14, 2026));
    }

    @Test public void primaRigaFermaAiBordi() {
        int oggi = 4, sett = 20, righe = 4;
        assertEquals("senza spostamento: la settimana di oggi", 4, CalendarioModel.primaRiga(oggi, 0, righe, sett));
        assertEquals(2, CalendarioModel.primaRiga(oggi, -2, righe, sett));
        assertEquals("non prima dei dati", 0, CalendarioModel.primaRiga(oggi, -9, righe, sett));
        assertEquals("non oltre i dati: l'ultima pagina piena", 16, CalendarioModel.primaRiga(oggi, 99, righe, sett));
        assertEquals("dati che non contengono oggi: dalla prima", 0, CalendarioModel.primaRiga(-1, 0, righe, sett));
        assertEquals("pochi dati: mai negativa", 0, CalendarioModel.primaRiga(0, 3, 5, 3));
    }

    @Test public void frecceSiAgganciaAlMeseOFannoUnaPagina() throws Exception {
        CalendarioModel m = venti();
        int oggi = 4, righe = 4, sp = 0;
        // › : da oggi (19 ott) l'inizio di novembre è a 2 righe → si aggancia; poi dicembre è a 4 → una pagina intera
        sp = m.paginaDopo(oggi, sp, righe, 1); assertEquals(6, CalendarioModel.primaRiga(oggi, sp, righe, 20));
        sp = m.paginaDopo(oggi, sp, righe, 1); assertEquals(10, CalendarioModel.primaRiga(oggi, sp, righe, 20));
        sp = m.paginaDopo(oggi, sp, righe, 1); assertEquals("gennaio è a 5 righe: pagina intera", 14, CalendarioModel.primaRiga(oggi, sp, righe, 20));
        sp = m.paginaDopo(oggi, sp, righe, 1); assertEquals("poi gennaio è a 1 riga: ci si aggancia", 15, CalendarioModel.primaRiga(oggi, sp, righe, 20));
        sp = m.paginaDopo(oggi, sp, righe, 1); assertEquals("in fondo ai dati si ferma", 16, CalendarioModel.primaRiga(oggi, sp, righe, 20));
        sp = m.paginaDopo(oggi, sp, righe, 1); assertEquals("e resta lì", 16, CalendarioModel.primaRiga(oggi, sp, righe, 20));
        // ‹ dall'ultima pagina
        sp = m.paginaDopo(oggi, sp, righe, -1); assertEquals(15, CalendarioModel.primaRiga(oggi, sp, righe, 20));
        sp = m.paginaDopo(oggi, sp, righe, -1); assertEquals("dicembre è a 5 righe: pagina intera", 11, CalendarioModel.primaRiga(oggi, sp, righe, 20));
        sp = m.paginaDopo(oggi, sp, righe, -1); assertEquals("inizio di dicembre", 10, CalendarioModel.primaRiga(oggi, sp, righe, 20));
        // da oggi indietro: l'inizio di ottobre è a 3 righe → si aggancia; poi in cima e si ferma
        sp = m.paginaDopo(oggi, 0, righe, -1); assertEquals(1, CalendarioModel.primaRiga(oggi, sp, righe, 20));
        sp = m.paginaDopo(oggi, sp, righe, -1); assertEquals(0, CalendarioModel.primaRiga(oggi, sp, righe, 20));
        sp = m.paginaDopo(oggi, sp, righe, -1); assertEquals("in cima resta in cima", 0, CalendarioModel.primaRiga(oggi, sp, righe, 20));
    }

    // qualunque sia la pagina e quante righe si vedono: un tocco non salta mai una settimana (la riga prima/dopo resta in vista)
    @Test public void nessunaSettimanaSaltata() throws Exception {
        CalendarioModel m = venti();
        for (int righe = 1; righe <= 5; righe++) for (int sp = -4; sp <= 15; sp++) for (int verso = -1; verso <= 1; verso += 2) {
            int da = CalendarioModel.primaRiga(4, sp, righe, 20);
            int a = CalendarioModel.primaRiga(4, m.paginaDopo(4, sp, righe, verso), righe, 20);
            String qui = " righe " + righe + ", da riga " + da + ", verso " + verso + " → " + a;
            if (verso > 0) assertTrue("avanti" + qui, a >= da && a <= da + righe);
            else assertTrue("indietro" + qui, a <= da && a >= da - righe);
            if (verso > 0 && da < 20 - righe) assertTrue("avanti si muove" + qui, a > da);
            if (verso < 0 && da > 0) assertTrue("indietro si muove" + qui, a < da);
        }
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
