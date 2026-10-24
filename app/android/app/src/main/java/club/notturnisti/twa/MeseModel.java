package club.notturnisti.twa;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.GregorianCalendar;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Il mese del widget, già calcolato dalla pagina: per ogni giorno la sigla e il tipo («n» notte, «l»
 * lavoro, «r» riposo, «?» da impostare) mio e delle persone che segui, più i giorni liberi per tutti.
 * Qui nessun calcolo di turni: solo leggere i dati e fare i conti della griglia (settimane, pagina,
 * quale persona mostrare). Classe senza Android, così si prova con un test sulla JVM.
 *
 * I dati partono dal lunedì della settimana che contiene il primo del mese corrente e arrivano a fine
 * del terzo mese dopo: ‹ › scorrono i mesi dentro questo intervallo.
 *
 * Forma pubblicata (platform.js › widget.publish, extra.mese):
 *   { da: "2026-10-19" (un lunedì), io: ["N:n", "R:r", …],
 *     p: [ { n: "Anna", g: ["M:l", …], i: "0010…" }, … ], sel: 0, star: "0|Anna" }
 * «i»: '1' nei giorni in cui io e lei/lui abbiamo almeno tre ore libere insieme.
 */
final class MeseModel {
    static final class Cella {
        final String sigla; final char tipo;
        Cella(String sigla, char tipo) { this.sigla = sigla; this.tipo = tipo; }
    }
    static final class Persona {
        final String nome; final List<Cella> giorni; final String ins;
        Persona(String nome, List<Cella> giorni, String ins) { this.nome = nome; this.giorni = giorni; this.ins = ins; }
    }

    final String da;          // primo giorno (un lunedì), AAAA-MM-GG
    final List<Cella> io;
    final List<Persona> persone;
    final int sel;            // la persona con la stellina nell'app
    final String stella;      // chi è la stellina, per accorgersi che nell'app è cambiata

    private MeseModel(String da, List<Cella> io, List<Persona> persone, int sel, String stella) {
        this.da = da; this.io = io; this.persone = persone; this.sel = sel; this.stella = stella;
    }

    static MeseModel leggi(JSONObject m) {
        if (m == null) return null;
        String da = m.optString("da", "");
        List<Cella> io = celle(m.optJSONArray("io"));
        if (da.length() != 10 || io.isEmpty()) return null;
        List<Persona> ps = new ArrayList<>();
        JSONArray pa = m.optJSONArray("p");
        if (pa != null) for (int i = 0; i < pa.length(); i++) {
            JSONObject p = pa.optJSONObject(i); if (p == null) continue;
            ps.add(new Persona(p.optString("n", "Persona " + (i + 1)), celle(p.optJSONArray("g")), p.optString("i", "")));
        }
        int sel = m.optInt("sel", 0);
        if (sel < 0 || sel >= ps.size()) sel = 0;
        return new MeseModel(da, io, ps, sel, m.optString("star", ""));
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

    /** Un mese da disegnare: dove comincia nei dati (un lunedì), quante settimane, di quale mese. */
    static final class Griglia {
        final int primo, settimane, anno, mese, nGiorni, vuoti;
        Griglia(int primo, int settimane, int anno, int mese, int nGiorni, int vuoti) {
            this.primo = primo; this.settimane = settimane; this.anno = anno; this.mese = mese; this.nGiorni = nGiorni; this.vuoti = vuoti;
        }
        boolean inMese(int i) { int k = i - primo - vuoti; return k >= 0 && k < nGiorni; }
        /** Il numero del giorno della cella i-esima del mese (anche fuori dal mese). */
        int numero(MeseModel m, int i) { return m.data(i)[2]; }
    }

    private int[] inizio() { return new int[]{ Integer.parseInt(da.substring(0, 4)), Integer.parseInt(da.substring(5, 7)), Integer.parseInt(da.substring(8, 10)) }; }
    private static Calendar a(int y, int m, int d) { return new GregorianCalendar(y, m - 1, d, 12, 0); }

    /** Data {anno, mese 1-12, giorno} del giorno i-esimo dei dati. */
    int[] data(int i) {
        int[] s = inizio(); Calendar c = a(s[0], s[1], s[2]); c.add(Calendar.DAY_OF_MONTH, i);
        return new int[]{ c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH) };
    }

    /** Posizione nei dati di una data, o -1 se è fuori. */
    int indice(int anno, int mese, int giorno) {
        int[] s = inizio();
        int i = (int) Math.round((a(anno, mese, giorno).getTimeInMillis() - a(s[0], s[1], s[2]).getTimeInMillis()) / 86400000.0);
        return i >= 0 && i < giorni() ? i : -1;
    }

    /** Il mese corrente è quello di «da + 6»: il lunedì della settimana del primo cade al più il 6. */
    int[] meseCorrente() { int[] d = data(6); return new int[]{ d[0], d[1] }; }

    /** La griglia del mese `k` dopo quello corrente, o null se i dati non lo coprono. */
    Griglia griglia(int k) {
        if (k < 0) return null;
        int[] cur = meseCorrente();
        Calendar primo = a(cur[0], cur[1], 1); primo.add(Calendar.MONTH, k);
        int vuoti = (primo.get(Calendar.DAY_OF_WEEK) + 5) % 7;           // lunedì = 0
        int nGiorni = primo.getActualMaximum(Calendar.DAY_OF_MONTH);
        int[] s = inizio(); Calendar c0 = a(s[0], s[1], s[2]);
        int giorniDa = (int) Math.round((primo.getTimeInMillis() - c0.getTimeInMillis()) / 86400000.0) - vuoti;
        int settimane = (vuoti + nGiorni + 6) / 7;
        if (giorniDa < 0 || giorniDa + settimane * 7 > giorni()) return null;
        return new Griglia(giorniDa, settimane, primo.get(Calendar.YEAR), primo.get(Calendar.MONTH) + 1, nGiorni, vuoti);
    }

    /** Il mese più lontano che si può mostrare. */
    int ultimoMese() { int k = 0; while (griglia(k + 1) != null) k++; return k; }

    int giorni() { return io.size(); }
    Cella mio(int i) { return i >= 0 && i < io.size() ? io.get(i) : null; }

    Cella di(int persona, int i) {
        if (persona < 0 || persona >= persone.size()) return null;
        List<Cella> g = persone.get(persona).giorni;
        return i >= 0 && i < g.size() ? g.get(i) : null;
    }

    boolean insieme(int persona, int i) {
        if (persona < 0 || persona >= persone.size()) return false;
        String s = persone.get(persona).ins;
        return i >= 0 && i < s.length() && s.charAt(i) == '1';
    }

    /**
     * Quale persona mostrare. La scelta fatta dal widget (override, -1 = nessuna) resta finché la
     * stellina nell'app non cambia: se la stellina è diversa da quella vista l'ultima volta, si
     * riparte da lei. Restituisce -1 se non ci sono persone.
     */
    int personaAttiva(int override, String stellaVista) {
        if (persone.isEmpty()) return -1;
        if (!stella.equals(stellaVista) || override < 0 || override >= persone.size()) return sel;
        return override;
    }

    /** La persona dopo quella attiva, in giro. */
    int prossimaPersona(int attiva) { return persone.isEmpty() ? -1 : (attiva + 1) % persone.size(); }
}
