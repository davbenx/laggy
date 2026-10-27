package club.notturnisti.twa;

import static org.junit.Assert.*;

import java.util.Calendar;
import java.util.TimeZone;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Before;
import org.junit.Test;

public class WidgetStatoTest {
    @Before public void fuso() { TimeZone.setDefault(TimeZone.getTimeZone("Europe/Rome")); }

    /** Sabato 24 ottobre 2026 all'ora e minuti dati (giorno + offset in giorni). */
    private static long t(int giorni, int h, int m) {
        Calendar c = Calendar.getInstance(); c.clear(); c.set(2026, Calendar.OCTOBER, 24 + giorni, h, m, 0);
        return c.getTimeInMillis();
    }
    private static JSONObject voce(long s, long e, String t, String k) throws Exception { return new JSONObject().put("s", s).put("e", e).put("t", t).put("k", k); }
    private static JSONObject piano(JSONObject diario, JSONObject... v) throws Exception {
        JSONArray a = new JSONArray(); for (JSONObject x : v) a.put(x);
        JSONObject r = new JSONObject().put("voci", a);
        for (JSONObject x : v) if (x.getString("k").startsWith("turno")) { r.put("turno", new JSONObject().put("s", x.getLong("s")).put("e", x.getLong("e")).put("t", x.getString("t"))); break; }
        if (diario != null) r.put("diario", diario);
        return r;
    }
    private static final JSONObject VUOTO = new JSONObject();

    // la sera prima della notte: sonno di domani, luce, turno
    private JSONObject sera() throws Exception {
        return piano(null, voce(t(0, 22, 0), t(1, 6, 15), "Turno Notte", "turno"), voce(t(1, 3, 10), t(1, 9, 55), "Sonno", "sonno"), voce(t(1, 9, 55), t(1, 10, 15), "Luce", "luce"));
    }

    @Test public void primaDellaNotteIlTurnoELOrarioDelSonno() throws Exception {
        WidgetStato s = WidgetStato.calcola(sera(), VUOTO, t(0, 20, 43));
        assertEquals("Prossimo", s.etichetta); assertEquals("Turno Notte", s.titolo);
        assertEquals("alle 22:00 · tra 1 h 17 min", s.sotto); assertEquals(-1, s.progresso);
        assertEquals(WidgetStato.Azione.SONNO, s.azione);   // 7 h 27 vere: ancora troppo presto per la sveglia
        assertEquals("A letto 03:10 → 09:55", s.testoAzione);
        assertEquals("il sonno è già nel pulsante: non si ripete fra le voci", 1, s.eventi.size());
        assertEquals("Luce", s.eventi.get(0).titolo);
        assertEquals("dom 09:55", s.eventi.get(0).ora);
        assertEquals("a letto alle 03:10: per l'app è ancora la notte di sabato", "2026-10-24", s.giornoAzione);
    }

    @Test public void daQuattroOrePrimaDelSonnoLaSveglia() throws Exception {
        // (la notte del 25 ottobre dura 25 ore: dalle 00:30 al sonno delle 03:10 passano 3 h 40 vere)
        WidgetStato s = WidgetStato.calcola(sera(), VUOTO, t(1, 0, 30));
        assertEquals(WidgetStato.Azione.SVEGLIA, s.azione);
        assertEquals("Metti la sveglia · 09:55", s.testoAzione); assertEquals(9, s.oraSveglia); assertEquals(55, s.minSveglia);
        assertEquals("in turno: «Adesso»", "Adesso", s.etichetta);
        assertTrue("il turno in corso ha la barra", s.progresso > 0 && s.progresso < 1000);
    }

    @Test public void ilPisolinoPrimaInformaPoiSveglia() throws Exception {
        JSONObject p = piano(null, voce(t(0, 19, 5), t(0, 19, 50), "Pisolino", "pisolino-recupero"), voce(t(0, 22, 0), t(1, 6, 15), "Turno Notte", "turno"));
        WidgetStato s = WidgetStato.calcola(p, VUOTO, t(0, 17, 30));
        assertEquals(WidgetStato.Azione.PISOLINO, s.azione); assertEquals("Pisolino 19:05 → 19:50", s.testoAzione);
        s = WidgetStato.calcola(p, VUOTO, t(0, 18, 50));
        assertEquals(WidgetStato.Azione.SVEGLIA, s.azione); assertEquals("Metti la sveglia · 19:50", s.testoAzione);
        s = WidgetStato.calcola(p, VUOTO, t(0, 19, 20));
        assertEquals("pisolino in corso", "Adesso", s.etichetta); assertTrue(s.progresso > 0);
        assertEquals("e la sveglia c'è ancora", WidgetStato.Azione.SVEGLIA, s.azione);
    }

    @Test public void votoDiDomaniSenzaAprireLApp() throws Exception {
        JSONObject oggi = new JSONObject().put("d", "2026-10-24").put("bed", "23:30").put("wake", "07:10").put("da", t(0, 7, 10)).put("a", t(0, 21, 10));
        JSONObject domani = new JSONObject().put("d", "2026-10-25").put("bed", "23:30").put("wake", "07:30").put("da", t(1, 7, 30)).put("a", t(1, 21, 30));
        JSONObject p = piano(oggi, voce(t(1, 22, 0), t(2, 6, 15), "Turno Notte", "turno")).put("diari", new JSONArray().put(oggi).put(domani));
        assertEquals("oggi", "2026-10-24", WidgetStato.calcola(p, VUOTO, t(0, 9, 0)).diario.getString("d"));
        WidgetStato s = WidgetStato.calcola(p, VUOTO, t(1, 8, 0));
        assertEquals("il giorno dopo la domanda arriva da sola", WidgetStato.Azione.VOTO_SONNO, s.azione); assertEquals("2026-10-25", s.diario.getString("d")); assertEquals("23:30 → 07:30", s.titolo);
        assertNotEquals("prima della sveglia di domani niente", WidgetStato.Azione.VOTO_SONNO, WidgetStato.calcola(p, VUOTO, t(1, 7, 0)).azione);
    }

    @Test public void sonnoDopoMezzanotteApreIlGiornoGiusto() throws Exception {
        // a letto alle 00:30 di domenica 25: per l'app è la notte di sabato 24
        JSONObject p = piano(null, voce(t(1, 0, 30), t(1, 9, 0), "Sonno", "sonno"));
        WidgetStato s = WidgetStato.calcola(p, VUOTO, t(0, 20, 0));
        assertEquals(WidgetStato.Azione.SONNO, s.azione); assertEquals("2026-10-24", s.giornoAzione);
        // a letto alle 09:00 dopo una notte: è il giorno stesso
        p = piano(null, voce(t(1, 9, 0), t(1, 16, 0), "Sonno", "sonno"));
        assertEquals("2026-10-25", WidgetStato.calcola(p, VUOTO, t(1, 1, 30)).giornoAzione);
    }

    @Test public void voto() throws Exception {
        JSONObject dia = new JSONObject().put("d", "2026-10-24").put("bed", "23:30").put("wake", "07:10").put("da", t(0, 7, 10)).put("a", t(0, 21, 10)).put("sonno", false).put("voto", false);
        JSONObject p = piano(dia, voce(t(0, 22, 0), t(1, 6, 15), "Turno Notte", "turno"));
        WidgetStato s = WidgetStato.calcola(p, VUOTO, t(0, 9, 0));
        assertEquals(WidgetStato.Azione.VOTO_SONNO, s.azione); assertEquals("Come hai dormito?", s.etichetta); assertEquals("23:30 → 07:10", s.titolo);
        s = WidgetStato.calcola(p, new JSONObject().put("2026-10-24", new JSONObject().put("sonno", true)), t(0, 9, 0));
        assertEquals("risposto dal widget: ora l'energia", WidgetStato.Azione.VOTO_ENERGIA, s.azione); assertEquals("Come ti senti?", s.etichetta);
        s = WidgetStato.calcola(p, new JSONObject().put("2026-10-24", new JSONObject().put("sonno", true).put("voto", 4)), t(0, 9, 0));
        assertEquals("tutto risposto", WidgetStato.Azione.NESSUNA, s.azione); assertEquals("Prossimo", s.etichetta);
        s = WidgetStato.calcola(p, VUOTO, t(0, 22, 30));
        assertNotEquals("dopo le 14 ore la domanda sparisce", WidgetStato.Azione.VOTO_SONNO, s.azione);
        s = WidgetStato.calcola(p, VUOTO, t(0, 6, 0));
        assertNotEquals("prima della sveglia non c'è", WidgetStato.Azione.VOTO_SONNO, s.azione);
    }

    @Test public void ilVotoHaLaPrecedenzaSullaSveglia() throws Exception {
        JSONObject dia = new JSONObject().put("d", "2026-10-24").put("bed", "23:30").put("wake", "07:10").put("da", t(0, 7, 10)).put("a", t(0, 21, 10));
        JSONObject p = piano(dia, voce(t(0, 8, 0), t(0, 9, 0), "Sonno", "sonno"));
        assertEquals(WidgetStato.Azione.VOTO_SONNO, WidgetStato.calcola(p, VUOTO, t(0, 7, 30)).azione);
    }

    @Test public void leVociSonoInOrdineDiOra() throws Exception {
        JSONObject p = piano(null, voce(t(0, 19, 10), t(0, 19, 25), "Ultimo caffè", "caffe"), voce(t(0, 19, 5), t(0, 19, 50), "Pisolino", "pisolino-recupero"), voce(t(0, 22, 0), t(1, 6, 15), "Turno Notte", "turno"), voce(t(0, 23, 10), t(0, 23, 25), "Caffè", "caffe"));
        WidgetStato s = WidgetStato.calcola(p, VUOTO, t(0, 18, 0));
        assertEquals("Pisolino", s.titolo);
        assertEquals(3, s.eventi.size());   // fino a quattro, per riempire i widget alti
        assertEquals("19:10", s.eventi.get(0).ora); assertEquals("22:00", s.eventi.get(1).ora); assertEquals("23:10", s.eventi.get(2).ora);   // il turno c'è sempre, in ordine di ora
    }

    @Test public void senzaDatiOConDatiSbagliatiNonSiRompe() throws Exception {
        assertEquals("Apri Notturnisti", WidgetStato.calcola(null, VUOTO, 0).titolo);
        assertEquals("Apri Notturnisti", WidgetStato.calcola(new JSONObject("{}"), VUOTO, 0).titolo);
        assertEquals("timeline esaurita", "Piano da aggiornare", WidgetStato.calcola(piano(null), VUOTO, t(0, 12, 0)).titolo);
    }

    @Test public void ilProssimoRidisegno() throws Exception {
        WidgetStato s = WidgetStato.calcola(sera(), VUOTO, t(0, 20, 43));
        assertTrue("prima del cambio di pulsante o dell'inizio del turno", s.prossimoCambio <= t(0, 22, 0));
        assertTrue(s.rinfresco > t(0, 20, 43));
    }
}
