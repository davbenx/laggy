package club.notturnisti.twa;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Cosa dice il widget adesso, calcolato dalla timeline che la pagina ha già pubblicato (voci {s, e, t, k},
 * il prossimo turno, il diario) e dall'ora. Nessuna vista qui: solo testi, numeri e la scelta del pulsante del
 * momento. Classe senza Android: si prova con test sulla JVM.
 *
 * Il pulsante (uno alla volta, nell'ordine di cosa serve a quell'ora):
 *   VOTO_SONNO / VOTO_ENERGIA  dalla sveglia, finché non rispondi (nell'app o qui)
 *   SVEGLIA                    da 4 ore prima del sonno (o da mezz'ora prima di un pisolino): mette la sveglia
 *   SONNO / PISOLINO           più in anticipo: a che ora si va a letto / si fa il pisolino (apre il giorno nell'app)
 */
final class WidgetStato {
    enum Azione { NESSUNA, VOTO_SONNO, VOTO_ENERGIA, SVEGLIA, SONNO, PISOLINO }

    static final class Evento {
        final String ora, titolo, chip, icona; final long s;
        Evento(String ora, String titolo, String chip, String icona, long s) { this.ora = ora; this.titolo = titolo; this.chip = chip; this.icona = icona; this.s = s; }
    }

    static final long ORA = 3600_000L, MIN = 60_000L;

    String etichetta = "Notturnisti", titolo = "Apri Notturnisti", sotto = "per vedere qui il tuo piano", icona = "libero";
    int progresso = -1;                                  // 0..1000, -1 = nessuna barra
    static final int MAX_VOCI = 2;
    final List<Evento> eventi = new ArrayList<>();       // già in ordine di ora, al più MAX_VOCI
    Azione azione = Azione.NESSUNA;
    String testoAzione = "";
    int oraSveglia = -1, minSveglia = -1;                // per SVEGLIA
    String giornoAzione = "";                            // AAAA-MM-GG da aprire nell'app (SONNO, PISOLINO)
    JSONObject diario;                                   // per i voti: {d, bed, wake}
    long prossimoCambio = Long.MAX_VALUE;                // quando conviene ridisegnare
    long rinfresco = Long.MAX_VALUE;                     // conto alla rovescia in corso

    static WidgetStato calcola(JSONObject radice, JSONObject risposte, long ora) {
        WidgetStato st = new WidgetStato();
        if (radice == null) return st;
        try { st.riempi(radice, risposte == null ? new JSONObject() : risposte, ora); } catch (Exception ignored) { }
        return st;
    }

    // ───────── formati ─────────
    static String hhmm(long t) {
        Calendar c = Calendar.getInstance(); c.setTimeInMillis(t);
        return String.format(Locale.ITALY, "%02d:%02d", c.get(Calendar.HOUR_OF_DAY), c.get(Calendar.MINUTE));
    }
    private static boolean stessoGiorno(long a, long b) {
        Calendar x = Calendar.getInstance(), y = Calendar.getInstance(); x.setTimeInMillis(a); y.setTimeInMillis(b);
        return x.get(Calendar.YEAR) == y.get(Calendar.YEAR) && x.get(Calendar.DAY_OF_YEAR) == y.get(Calendar.DAY_OF_YEAR);
    }
    /** «21:00» oggi, altrimenti «dom 21:00». */
    static String quando(long t, long ora) {
        if (stessoGiorno(t, ora)) return hhmm(t);
        String[] gg = { "dom", "lun", "mar", "mer", "gio", "ven", "sab" };
        Calendar c = Calendar.getInstance(); c.setTimeInMillis(t);
        return gg[c.get(Calendar.DAY_OF_WEEK) - 1] + " " + hhmm(t);
    }
    /** «2 h 10 min», «45 min», «1 h». */
    static String durata(long ms) {
        long m = Math.max(1, Math.round(ms / 60000.0));
        if (m < 60) return m + " min";
        long h = m / 60, r = m % 60;
        return r == 0 ? h + " h" : h + " h " + r + " min";
    }
    static String iso(long t) { return String.format(Locale.ROOT, "%1$tY-%1$tm-%1$td", t); }

    private static boolean importante(String k) {
        return k != null && (k.startsWith("turno") || k.startsWith("sonno") || k.startsWith("pisolino") || k.startsWith("rientro"));
    }
    private static boolean e(JSONObject x, String prefisso) { return x.optString("k", "").startsWith(prefisso); }

    private void cambio(long t, long ora) { if (t > ora && t < prossimoCambio) prossimoCambio = t; }

    private static String tipoIcona(String k) {
        if (k == null) return "libero";
        for (String p : new String[]{ "sonno", "pisolino", "turno", "caffe", "luce", "rientro" }) if (k.startsWith(p)) return p;
        return "libero";
    }

    // ───────── calcolo ─────────
    private void riempi(JSONObject radice, JSONObject risposte, long ora) throws Exception {
        JSONArray v = radice.getJSONArray("voci");
        JSONObject turno = radice.optJSONObject("turno");
        if (turno != null && turno.optLong("e") <= ora) turno = null;

        // la voce in corso (la più importante) e la prossima importante
        JSONObject corrente = null, primo = null;
        for (int i = 0; i < v.length(); i++) {
            JSONObject x = v.getJSONObject(i);
            long s = x.getLong("s"), f = x.getLong("e");
            cambio(s, ora); cambio(f, ora);
            String k = x.optString("k", null);
            if (s <= ora && f > ora && (corrente == null || (!importante(corrente.optString("k", null)) && importante(k)))) corrente = x;
            if (s > ora && primo == null && importante(k)) primo = x;
        }
        if (corrente == null && primo == null) for (int i = 0; i < v.length(); i++) { JSONObject x = v.getJSONObject(i); if (x.getLong("s") > ora) { primo = x; break; } }
        JSONObject eroe = corrente != null ? corrente : primo;

        if (corrente != null) {
            long s = corrente.getLong("s"), f = corrente.getLong("e");
            etichetta = "Adesso"; titolo = corrente.getString("t");
            sotto = "fino alle " + hhmm(f) + " · ancora " + durata(f - ora);
            // in turno: quando smettere con il caffè, se cade prima della fine
            if (e(corrente, "turno")) for (int i = 0; i < v.length(); i++) {
                JSONObject x = v.getJSONObject(i);
                if (e(x, "caffe") && x.getLong("s") > ora && x.getLong("s") < f) { sotto = "fino alle " + hhmm(f) + " · caffè entro le " + hhmm(x.getLong("s")); break; }
            }
            icona = tipoIcona(corrente.optString("k", null));
            progresso = (int) Math.max(0, Math.min(1000, (ora - s) * 1000 / Math.max(1, f - s)));
            rinfresco = ora + 5 * MIN;
        } else if (primo != null) {
            long s = primo.getLong("s");
            etichetta = "Prossimo"; titolo = primo.getString("t");
            sotto = "alle " + quando(s, ora) + " · tra " + durata(s - ora);
            if (e(primo, "sonno")) sotto = "alle " + quando(s, ora) + " · sveglia " + quando(primo.getLong("e"), s);
            icona = tipoIcona(primo.optString("k", null));
            rinfresco = ora + (s - ora < ORA ? MIN : 5 * MIN);
        } else {
            titolo = "Piano da aggiornare"; sotto = "apri l'app per i prossimi giorni";
        }

        // ───── il pulsante del momento ─────
        JSONObject usata = null;                                   // la voce che il pulsante già racconta
        JSONObject d = radice.optJSONObject("diario");
        JSONArray diari = radice.optJSONArray("diari");   // oggi e domani: la prima finestra in corso, o la più vicina
        if (diari != null) for (int i = 0; i < diari.length(); i++) {
            JSONObject x = diari.optJSONObject(i);
            if (x == null) continue;
            if (ora < x.optLong("a") && (d == null || ora >= x.optLong("da") || ora >= d.optLong("a"))) { d = x; if (ora >= x.optLong("da")) break; }
        }
        if (d != null) {
            cambio(d.optLong("da"), ora);
            if (ora >= d.optLong("da") && ora < d.optLong("a")) {
                JSONObject r = risposte.optJSONObject(d.optString("d"));
                boolean sonno = d.optBoolean("sonno") || (r != null && r.optBoolean("sonno"));
                boolean voto = d.optBoolean("voto") || (r != null && r.has("voto"));
                if (!sonno) azione = Azione.VOTO_SONNO; else if (!voto) azione = Azione.VOTO_ENERGIA;
                if (azione != Azione.NESSUNA) { diario = d; cambio(d.optLong("a"), ora); }
            }
        }
        if (azione == Azione.VOTO_SONNO) {
            etichetta = "Come hai dormito?"; titolo = d.optString("bed") + " → " + d.optString("wake"); sotto = "è andata così?"; icona = "sonno"; progresso = -1;
        } else if (azione == Azione.VOTO_ENERGIA) {
            etichetta = "Come ti senti?"; titolo = "La tua energia oggi"; sotto = "un tocco, resta nel diario"; icona = "sonno"; progresso = -1;
        } else {
            JSONObject sonnoVicino = null, pisolinoVicino = null, sonnoInfo = null, pisolinoInfo = null;
            for (int i = 0; i < v.length(); i++) {
                JSONObject x = v.getJSONObject(i);
                long s = x.getLong("s"), f = x.getLong("e");
                if (f <= ora) continue;
                if (e(x, "sonno")) {
                    if (s - ora < 4 * ORA && ora - s < 30 * MIN) { if (sonnoVicino == null) sonnoVicino = x; }
                    else if (s > ora && s - ora < 12 * ORA && sonnoInfo == null) sonnoInfo = x;
                } else if (e(x, "pisolino")) {
                    if (s - ora < 30 * MIN) { if (pisolinoVicino == null) pisolinoVicino = x; }
                    else if (s - ora < 3 * ORA && pisolinoInfo == null) pisolinoInfo = x;
                }
            }
            if (sonnoVicino != null || pisolinoVicino != null) {
                usata = sonnoVicino != null ? sonnoVicino : pisolinoVicino;
                Calendar fine = Calendar.getInstance(); fine.setTimeInMillis(usata.getLong("e"));
                azione = Azione.SVEGLIA; oraSveglia = fine.get(Calendar.HOUR_OF_DAY); minSveglia = fine.get(Calendar.MINUTE);
                testoAzione = "Metti la sveglia · " + hhmm(usata.getLong("e"));
                cambio(usata.getLong("s") + 30 * MIN, ora);
            } else {
                // il primo che comincia fra sonno e pisolino
                if (sonnoInfo != null && (pisolinoInfo == null || sonnoInfo.getLong("s") <= pisolinoInfo.getLong("s"))) { usata = sonnoInfo; azione = Azione.SONNO; testoAzione = "A letto " + hhmm(usata.getLong("s")) + " → " + hhmm(usata.getLong("e")); }
                else if (pisolinoInfo != null) { usata = pisolinoInfo; azione = Azione.PISOLINO; testoAzione = "Pisolino " + hhmm(usata.getLong("s")) + " → " + hhmm(usata.getLong("e")); }
                // il giorno dell'app: un sonno che comincia dopo la mezzanotte (fino alle 04:30) è ancora la notte del giorno prima
                if (usata != null) giornoAzione = iso(usata.getLong("s") - 270 * MIN);
            }
            // quando cambia il pulsante: 4 ore prima del sonno (o mezz'ora prima del pisolino) e quando comincia
            for (int i = 0; i < v.length(); i++) {
                JSONObject x = v.getJSONObject(i); long s = x.getLong("s");
                if (e(x, "sonno")) { cambio(s - 12 * ORA, ora); cambio(s - 4 * ORA, ora); cambio(s + 30 * MIN, ora); }
                else if (e(x, "pisolino")) { cambio(s - 3 * ORA, ora); cambio(s - 30 * MIN, ora); }
            }
        }

        // ───── le prossime voci: il prossimo turno (sempre, anche fra giorni) e le altre in arrivo, in ordine di ora ─────
        List<JSONObject> altre = new ArrayList<>();
        for (int i = 0; i < v.length() && altre.size() < MAX_VOCI; i++) {
            JSONObject x = v.getJSONObject(i);
            long s = x.getLong("s");
            if (s <= ora || x == eroe || x == usata || e(x, "turno")) continue;
            if (corrente != null && e(corrente, "turno") && e(x, "caffe") && s < corrente.getLong("e")) continue;
            altre.add(x);
        }
        boolean turnoInAlto = eroe != null && turno != null && e(eroe, "turno") && eroe.getLong("s") == turno.getLong("s");
        List<Evento> tutti = new ArrayList<>();
        if (turno != null && !turnoInAlto) tutti.add(new Evento(quando(turno.getLong("s"), ora), turno.optString("t", "Turno"), "", "turno", turno.getLong("s")));
        for (int i = 0; i < altre.size() && tutti.size() < MAX_VOCI; i++) {
            JSONObject x = altre.get(i); long s = x.getLong("s");
            boolean letto = e(x, "sonno");
            tutti.add(new Evento(quando(s, ora), x.getString("t"), letto ? "→ " + hhmm(x.getLong("e")) : "", tipoIcona(x.optString("k", null)), s));
        }
        java.util.Collections.sort(tutti, (a, b) -> Long.compare(a.s, b.s));
        eventi.addAll(tutti);
    }
}
