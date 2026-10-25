package club.notturnisti.twa;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.GregorianCalendar;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Il calendario del widget, già calcolato dalla pagina: da un lunedì per 20 settimane (quattro prima di quella di oggi,
 * il resto dopo: il widget si sfoglia a pagine), la tua sigla e il tipo
 * («n» notte, «l» lavoro, «r» riposo, «?» da impostare) e quelli delle persone che segui (al massimo quattro, con
 * la stellina dell'app sempre dentro). Qui nessun calcolo di turni, solo lettura, date e scelta della persona.
 * Senza Android: si prova con test sulla JVM.
 *
 * Forma pubblicata (index.html, meseWidget):
 *   { da: "2026-10-19" (un lunedì), io: ["N:n", …], p: [ { n: "Anna", g: ["M:l", …] }, … ], sel: 0, star: "0|Anna" }
 */
final class CalendarioModel {
    static final class Cella {
        final String sigla; final char tipo;
        Cella(String sigla, char tipo) { this.sigla = sigla; this.tipo = tipo; }
    }
    static final class Persona {
        final String nome; final List<Cella> giorni;
        Persona(String nome, List<Cella> giorni) { this.nome = nome; this.giorni = giorni; }
    }

    /** Scelta della persona fatta dal widget: -2 = nessuna (segue la stellina), -1 = nascosta, 0… = quella. */
    static final int SEGUI_STELLA = -2, NASCOSTA = -1;

    private static final String[] MESI = { "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre" };

    final String da;
    final List<Cella> io;
    final List<Persona> persone;
    final int sel;            // la persona con la stellina nell'app
    final String stella;      // chi è, per accorgersi che nell'app è cambiata

    private CalendarioModel(String da, List<Cella> io, List<Persona> persone, int sel, String stella) {
        this.da = da; this.io = io; this.persone = persone; this.sel = sel; this.stella = stella;
    }

    static CalendarioModel leggi(JSONObject m) {
        if (m == null) return null;
        String da = m.optString("da", "");
        List<Cella> io = celle(m.optJSONArray("io"));
        if (da.length() != 10 || io.isEmpty()) return null;
        List<Persona> ps = new ArrayList<>();
        JSONArray pa = m.optJSONArray("p");
        if (pa != null) for (int i = 0; i < pa.length(); i++) {
            JSONObject p = pa.optJSONObject(i); if (p == null) continue;
            List<Cella> g = celle(p.optJSONArray("g"));
            if (!g.isEmpty()) ps.add(new Persona(p.optString("n", "Persona " + (i + 1)), g));
        }
        int sel = m.optInt("sel", 0);
        if (sel < 0 || sel >= ps.size()) sel = 0;
        return new CalendarioModel(da, io, ps, sel, m.optString("star", ""));
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
    int settimane() { return giorni() / 7; }
    Cella mio(int i) { return i >= 0 && i < io.size() ? io.get(i) : null; }
    Cella di(int persona, int i) {
        if (persona < 0 || persona >= persone.size()) return null;
        List<Cella> g = persone.get(persona).giorni;
        return i >= 0 && i < g.size() ? g.get(i) : null;
    }

    private static Calendar a(int y, int m, int d) { return new GregorianCalendar(y, m - 1, d, 12, 0); }
    private Calendar inizio() { return a(Integer.parseInt(da.substring(0, 4)), Integer.parseInt(da.substring(5, 7)), Integer.parseInt(da.substring(8, 10))); }

    /** Data {anno, mese 1-12, giorno} del giorno i-esimo (a mezzogiorno: il cambio d'ora non sposta il giorno). */
    int[] data(int i) {
        Calendar c = inizio(); c.add(Calendar.DAY_OF_MONTH, i);
        return new int[]{ c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH) };
    }

    /** Posizione nei dati di una data, o -1 se è fuori. */
    int indice(int anno, int mese, int giorno) {
        int i = (int) Math.round((a(anno, mese, giorno).getTimeInMillis() - inizio().getTimeInMillis()) / 86400000.0);
        return i >= 0 && i < giorni() ? i : -1;
    }

    /** Mese (anno, 1-12) della settimana nella riga: quello del suo giovedì, come per le settimane ISO. */
    int[] meseDellaRiga(int riga) { int[] d = data(riga * 7 + 3); return new int[]{ d[0], d[1] }; }

    /** «Ottobre», o «Gennaio 2027» se non è l'anno di oggi: il titolo sopra il calendario. */
    String titolo(int riga, int annoOggi) {
        int[] m = meseDellaRiga(riga);
        return MESI[m[1] - 1] + (m[0] != annoOggi ? " " + m[0] : "");
    }

    /**
     * Prima riga mostrata: la settimana di oggi (la prima se i dati non la contengono) spostata di `spostamento`
     * settimane, senza uscire dai dati (con `righe` righe in vista).
     */
    static int primaRiga(int rigaOggi, int spostamento, int righe, int settimane) {
        int massimo = Math.max(0, settimane - righe);
        return Math.max(0, Math.min(massimo, Math.max(rigaOggi, 0) + spostamento));
    }

    /** La riga è la prima settimana di un mese (il suo giovedì cade in un mese diverso da quello della riga prima). */
    boolean inizioMese(int riga) {
        if (riga <= 0) return false;
        int[] a = meseDellaRiga(riga - 1), b = meseDellaRiga(riga);
        return a[0] != b[0] || a[1] != b[1];
    }

    /**
     * Lo spostamento dopo un tocco su ‹ (-1) o › (+1), a partire dalla prima riga che si vede ora. Il passo è il
     * più corto fra una pagina intera (tante settimane quante se ne vedono: non se ne salta mai nessuna) e l'inizio del
     * mese vicino in quel verso: nei widget alti ‹ › sono il mese prima e dopo, in quelli bassi si procede a pagine
     * e ci si aggancia all'inizio del mese quando è a meno di una pagina. Mai oltre i dati.
     */
    int paginaDopo(int rigaOggi, int spostamento, int righe, int verso) {
        int massimo = Math.max(0, settimane() - righe);
        int attuale = primaRiga(rigaOggi, spostamento, righe, settimane());
        int passo = righe;
        if (verso > 0) {
            for (int r = attuale + 1; r < attuale + righe; r++) if (inizioMese(r)) { passo = r - attuale; break; }
        } else {
            for (int r = attuale - 1; r > attuale - righe && r > 0; r--) if (inizioMese(r)) { passo = attuale - r; break; }
        }
        int nuova = Math.max(0, Math.min(massimo, attuale + (verso > 0 ? passo : -passo)));
        return nuova - Math.max(rigaOggi, 0);
    }

    /** Lo spostamento salvato vale solo per il giorno in cui è stato fatto: il giorno dopo si riparte da oggi. */
    static int spostamentoValido(int spostamento, String giornoSalvato, String oggi) {
        return oggi != null && oggi.equals(giornoSalvato) ? spostamento : 0;
    }

    /**
     * Quale persona mostrare. La scelta del widget regge finché la stellina nell'app non cambia: se è diversa
     * da quella vista l'ultima volta si riparte da lei. -1 = nessuna (nascosta, o non ce ne sono).
     */
    int personaAttiva(int scelta, String stellaVista) {
        if (persone.isEmpty()) return -1;
        if (!stella.equals(stellaVista) || scelta == SEGUI_STELLA || scelta >= persone.size() || scelta < NASCOSTA) return sel;
        return scelta;
    }

    /** Il tocco sul nome: la persona dopo, poi «nascosta», poi di nuovo la prima. */
    int dopo(int attiva) {
        if (persone.isEmpty()) return NASCOSTA;
        if (attiva < 0) return 0;
        return attiva + 1 < persone.size() ? attiva + 1 : NASCOSTA;
    }
}
