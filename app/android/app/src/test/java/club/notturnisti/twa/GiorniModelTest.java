package club.notturnisti.twa;

import static org.junit.Assert.*;

import org.json.JSONObject;
import org.junit.Test;

public class GiorniModelTest {
    private static String lista(int n, String s) {
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < n; i++) b.append(i > 0 ? "," : "").append("\"").append(s).append("\"");
        return b.toString();
    }

    @Test public void leggeSigleETipi() throws Exception {
        GiorniModel m = GiorniModel.leggi(new JSONObject("{\"da\":\"2026-10-23\",\"io\":[\"N:n\",\"Fe:r\",\"M•:l\",\"x\"],\"p\":{\"n\":\"Anna\",\"g\":[\"M:l\",\"R:r\"]}}"));
        assertEquals("N", m.mio(0).sigla); assertEquals('n', m.mio(0).tipo);
        assertEquals("Fe", m.mio(1).sigla); assertEquals('r', m.mio(1).tipo);
        assertEquals("M•", m.mio(2).sigla); assertEquals('l', m.mio(2).tipo);
        assertEquals("senza tipo", '?', m.mio(3).tipo);
        assertEquals("Anna", m.persona); assertEquals("M", m.sua(0).sigla);
        assertNull("oltre i dati", m.sua(5)); assertNull(m.mio(-1));
    }

    @Test public void senzaPersona() throws Exception {
        GiorniModel m = GiorniModel.leggi(new JSONObject("{\"da\":\"2026-10-23\",\"io\":[\"N:n\"]}"));
        assertNull(m.persona); assertNull(m.sua(0));
        GiorniModel v = GiorniModel.leggi(new JSONObject("{\"da\":\"2026-10-23\",\"io\":[\"N:n\"],\"p\":{\"n\":\"Anna\",\"g\":[]}}"));
        assertNull("persona senza giorni: come se non ci fosse", v.persona);
    }

    @Test public void datiRotti() throws Exception {
        assertNull(GiorniModel.leggi(null));
        assertNull(GiorniModel.leggi(new JSONObject("{}")));
        assertNull(GiorniModel.leggi(new JSONObject("{\"da\":\"x\",\"io\":[\"N:n\"]}")));
        assertNull(GiorniModel.leggi(new JSONObject("{\"da\":\"2026-10-23\",\"io\":[]}")));
    }

    @Test public void date() throws Exception {
        GiorniModel m = GiorniModel.leggi(new JSONObject("{\"da\":\"2026-10-23\",\"io\":[" + lista(42, "R:r") + "]}"));
        assertArrayEquals(new int[]{ 2026, 10, 23 }, m.data(0));
        assertArrayEquals("dopo il cambio d'ora del 25", new int[]{ 2026, 10, 26 }, m.data(3));
        assertArrayEquals("cambio di mese", new int[]{ 2026, 11, 1 }, m.data(9));
        GiorniModel a = GiorniModel.leggi(new JSONObject("{\"da\":\"2026-12-30\",\"io\":[\"R:r\"]}"));
        assertArrayEquals("cambio d'anno", new int[]{ 2027, 1, 1 }, a.data(2));
    }

    @Test public void righeInBaseAllAltezza() {
        assertEquals("tre righe del launcher: solo la settimana", 0, GiorniModel.righeExtra(240, false, 5));
        assertEquals(1, GiorniModel.righeExtra(270, false, 5));
        assertEquals(2, GiorniModel.righeExtra(310, false, 5));
        assertEquals("con la persona le righe sono più alte", 0, GiorniModel.righeExtra(300, true, 5));
        assertEquals(1, GiorniModel.righeExtra(330, true, 5));
        assertEquals(2, GiorniModel.righeExtra(400, true, 5));
        assertEquals("mai oltre il massimo", 5, GiorniModel.righeExtra(900, false, 5));
        assertEquals("mai negative", 0, GiorniModel.righeExtra(100, true, 5));
    }
}
