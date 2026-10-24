package club.notturnisti.twa;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.GregorianCalendar;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * I giorni dopo la settimana del widget, già calcolati dalla pagina: da oggi per 42 giorni, la mia
 * sigla e il tipo («n» notte, «l» lavoro, «r» riposo, «?» da impostare) e quelli della persona con la
 * stellina. Qui nessun calcolo di turni, solo lettura e date. Senza Android: si prova sulla JVM.
 *
 * Forma pubblicata (index.html, meseWidget):
 *   { da: "2026-10-23", io: ["N:n", "R:r", …], p: { n: "Anna", g: ["M:l", …] } }   (p assente senza persone)
 */
final class GiorniModel {
    static final class Cella {
        final String sigla; final char tipo;
        Cella(String sigla, char tipo) { this.sigla = sigla; this.tipo = tipo; }
    }

    final String da;
    final List<Cella> io;
    final String persona;           // null senza persone
    private final List<Cella> sue;

    private GiorniModel(String da, List<Cella> io, String persona, List<Cella> sue) {
        this.da = da; this.io = io; this.persona = persona; this.sue = sue;
    }

    static GiorniModel leggi(JSONObject m) {
        if (m == null) return null;
        String da = m.optString("da", "");
        List<Cella> io = celle(m.optJSONArray("io"));
        if (da.length() != 10 || io.isEmpty()) return null;
        JSONObject p = m.optJSONObject("p");
        List<Cella> sue = p == null ? new ArrayList<Cella>() : celle(p.optJSONArray("g"));
        return new GiorniModel(da, io, p == null || sue.isEmpty() ? null : p.optString("n", "Persona"), sue);
    }

    private static List<Cella> celle(JSONArray a) {
        List<Cella> out = new ArrayList<>();
        if (a == null) return out;
        for (int i = 0; i < a.length(); i++) {
            String s = a.optString(i, "?:?"); int k = s.lastIndexOf(':');
            String sigla = k > 0 ? s.substring(0, k) : s;
            char tipo = k >= 0 && k + 1 < s.length() ? s.charAt(k + 1) : '?';
            if (tipo != 'n' && tipo != 'l' && tipo != 'r') tipo = '?';
            out.add(new Cella(sigla, tipo));
        }
        return out;
    }

    int giorni() { return io.size(); }
    Cella mio(int i) { return i >= 0 && i < io.size() ? io.get(i) : null; }
    Cella sua(int i) { return persona != null && i >= 0 && i < sue.size() ? sue.get(i) : null; }

    /** Data {anno, mese 1-12, giorno} del giorno i-esimo (a mezzogiorno: il cambio d'ora non sposta il giorno). */
    int[] data(int i) {
        Calendar c = new GregorianCalendar(Integer.parseInt(da.substring(0, 4)), Integer.parseInt(da.substring(5, 7)) - 1, Integer.parseInt(da.substring(8, 10)), 12, 0);
        c.add(Calendar.DAY_OF_MONTH, i);
        return new int[]{ c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH) };
    }

    /**
     * Quante righe di sette giorni si possono mostrare dopo la prima settimana, dato lo spazio in dp.
     * Misure dal telefono: «adesso» + due voci + settimana ≈ 220 dp con il padding (+20 se sotto ogni sigla c'è quella
     * della persona), ogni riga in più ≈ 43 dp (59 con la persona), la legenda ≈ 18 dp.
     */
    static int righeExtra(int altezzaDp, boolean conPersona, int max) {
        int base = conPersona ? 258 : 220, riga = conPersona ? 59 : 43;
        return Math.max(0, Math.min(max, (altezzaDp - base) / riga));
    }
}
