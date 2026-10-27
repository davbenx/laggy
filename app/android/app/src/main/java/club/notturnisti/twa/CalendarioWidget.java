package club.notturnisti.twa;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Typeface;
import android.net.Uri;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.style.StyleSpan;
import android.util.TypedValue;
import android.view.View;
import android.widget.RemoteViews;
import java.util.Calendar;
import java.util.Locale;

/**
 * Il calendario a settimane del widget: tu sopra, la persona che segui sotto (verde acqua). Parte dalla settimana
 * di oggi e aggiunge righe quanto il widget è alto. Sono viste vere (non un'immagine): seguono tema e testo, e
 * le righe si dividono lo spazio che resta. Un tocco su un giorno apre l'app su quel giorno; un tocco sul nome della
 * persona passa alla successiva, poi la nasconde (la scelta resta finché nell'app non sposti la stellina).
 * ‹ › sfogliano a pagine (tante settimane quante se ne vedono) e il titolo riporta a oggi; lo spostamento vale per il
 * giorno in cui è fatto. Il mese si legge dal titolo (quello del giovedì della prima riga) e dal colore dei numeri:
 * quelli di un altro mese sono in blu, il primo del mese è «1 NOV» in grassetto.
 */
final class CalendarioWidget {
    static final int RIGHE = 5, COLONNE = 7;
    private static final String[] MESI_BREVI = { "gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic" };
    private static final String[] GIORNI = { "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica" };

    private static final int[][][] ID = new int[RIGHE][COLONNE][4];   // cella, data, mia, sua
    private static int[] riga;

    private static void carica(Context ctx) {
        if (riga != null) return;
        String pkg = ctx.getPackageName();
        int[] r = new int[RIGHE];
        for (int i = 0; i < RIGHE; i++) {
            r[i] = ctx.getResources().getIdentifier("w_cr" + i, "id", pkg);
            for (int c = 0; c < COLONNE; c++) {
                String k = "w_c" + i + "_" + c;
                ID[i][c][0] = ctx.getResources().getIdentifier(k, "id", pkg);
                ID[i][c][1] = ctx.getResources().getIdentifier(k + "_d", "id", pkg);
                ID[i][c][2] = ctx.getResources().getIdentifier(k + "_m", "id", pkg);
                ID[i][c][3] = ctx.getResources().getIdentifier(k + "_p", "id", pkg);
            }
        }
        riga = r;
    }

    /**
     * Righe di calendario possibili con questi dati (con ‹ › si sfoglia, quindi non dipende da dove si parte). Se oggi
     * non è nei dati (l'app non è stata aperta per mesi) niente calendario: meglio nessuno che uno vecchio senza dirlo.
     */
    static int righeDisponibili(CalendarioModel m, long ora) {
        return m == null || indiceOggi(m, ora) < 0 ? 0 : Math.min(RIGHE, m.settimane());
    }

    /** «2026-10-25»: il giorno a cui si lega lo spostamento fatto con ‹ ›. */
    static String giornoIso(long ora) {
        Calendar c = Calendar.getInstance(); c.setTimeInMillis(ora);
        return String.format(Locale.ROOT, "%04d-%02d-%02d", c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH));
    }

    static int indiceOggi(CalendarioModel m, long ora) {
        Calendar c = Calendar.getInstance(); c.setTimeInMillis(ora);
        return m.indice(c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH));
    }

    static PendingIntent cambiaPersona(Context ctx, int id) {
        Intent i = new Intent(ctx, NotturnistiWidget.class).setAction(NotturnistiWidget.AZIONE_PERSONA).putExtra("id", id);
        return NotturnistiWidget.trasmetti(ctx, 6000 + id, i);
    }

    /** Un tocco su ‹ (k 0), › (k 1) o sul titolo (k 2): il widget passa a questo spostamento, in settimane da oggi. */
    static PendingIntent pagina(Context ctx, int id, int k, int spostamento, int righe) {
        Intent i = new Intent(ctx, NotturnistiWidget.class).setAction(NotturnistiWidget.AZIONE_PAGINA).putExtra("id", id).putExtra("off", spostamento).putExtra("righe", righe);
        return NotturnistiWidget.trasmetti(ctx, 10000 + id * 4 + k, i);
    }

    private static void freccia(RemoteViews rv, int vista, boolean attiva, PendingIntent pi, String descrizione) {
        rv.setFloat(vista, "setAlpha", attiva ? 1f : 0.3f);
        rv.setContentDescription(vista, descrizione);
        if (attiva) rv.setOnClickPendingIntent(vista, pi);
    }

    /** Riempie le righe. `righe` = quante mostrare (0: il calendario sparisce); `spostamento` = settimane da oggi (‹ ›). */
    static void riempi(Context ctx, RemoteViews rv, CalendarioModel m, int righe, int persona, long ora, int idWidget, int spostamento) {
        carica(ctx);
        int disp = righeDisponibili(m, ora);
        righe = Math.min(righe, disp);
        rv.setViewVisibility(R.id.w_cal, righe > 0 ? View.VISIBLE : View.GONE);
        if (righe <= 0) return;
        rv.setViewVisibility(R.id.w_cal_vuoto, righe <= 2 ? View.VISIBLE : View.GONE);   // con poche settimane il vuoto non le allarga troppo; con molte le righe riempiono fino in fondo
        int oggi = indiceOggi(m, ora), rigaOggi = oggi < 0 ? -1 : oggi / COLONNE;
        int r0 = CalendarioModel.primaRiga(rigaOggi, spostamento, righe, m.settimane());
        Calendar adesso = Calendar.getInstance(); adesso.setTimeInMillis(ora);
        String titolo = m.titolo(r0, adesso.get(Calendar.YEAR));
        int[] meseTitolo = m.meseDellaRiga(r0);

        rv.setTextViewText(R.id.w_cal_mese, titolo);
        rv.setContentDescription(R.id.w_cal_mese, titolo + ". Tocca per tornare a oggi");
        rv.setOnClickPendingIntent(R.id.w_cal_mese, pagina(ctx, idWidget, 2, 0, righe));
        freccia(rv, R.id.w_cal_prec, r0 > 0, pagina(ctx, idWidget, 0, m.paginaDopo(rigaOggi, spostamento, righe, -1), righe), "Settimane precedenti");
        freccia(rv, R.id.w_cal_succ, r0 < m.settimane() - righe, pagina(ctx, idWidget, 1, m.paginaDopo(rigaOggi, spostamento, righe, 1), righe), "Settimane successive");
        boolean conPersone = !m.persone.isEmpty();
        // il nome: persona mostrata (verde) oppure «+ Anna» se nascosta; un tocco passa alla successiva
        String nome = persona >= 0 ? m.persone.get(persona).nome : m.persone.isEmpty() ? "" : m.persone.get(m.sel).nome;
        rv.setViewVisibility(R.id.w_cal_p, conPersone ? View.VISIBLE : View.GONE);
        rv.setViewVisibility(R.id.w_cal_tu, conPersone && persona >= 0 ? View.VISIBLE : View.GONE);
        if (conPersone) {
            rv.setTextViewText(R.id.w_cal_p, persona >= 0 ? nome + (m.persone.size() > 1 ? "  ›" : "") : "+ " + nome);
            rv.setInt(R.id.w_cal_p, "setBackgroundResource", persona >= 0 ? R.drawable.widget_chip_p : R.drawable.widget_chip);
            rv.setTextColor(R.id.w_cal_p, ctx.getColor(persona >= 0 ? R.color.w_pl_lavoro_t : R.color.w_dim));
            rv.setOnClickPendingIntent(R.id.w_cal_p, cambiaPersona(ctx, idWidget));
            rv.setContentDescription(R.id.w_cal_p, persona >= 0 ? "Turni di " + nome + " sotto i tuoi. Tocca per cambiare persona" : "Mostra i turni di " + nome);
        }

        for (int r = 0; r < RIGHE; r++) {
            rv.setViewVisibility(riga[r], r < righe ? View.VISIBLE : View.GONE);
            if (r >= righe) continue;
            for (int c = 0; c < COLONNE; c++) {
                int i = (r0 + r) * COLONNE + c;
                int[] id = ID[r][c], dt = m.data(i);
                boolean passato = oggi >= 0 && i < oggi, eOggi = i == oggi;
                // numero del giorno: oggi su un tondo; quelli di un altro mese in blu; il primo del mese «1 NOV» in grassetto
                boolean altroMese = dt[0] != meseTitolo[0] || dt[1] != meseTitolo[1];
                CharSequence numero = String.valueOf(dt[2]);
                if (dt[2] == 1) {
                    SpannableString sp = new SpannableString("1 " + MESI_BREVI[dt[1] - 1].toUpperCase(Locale.ITALIAN));
                    sp.setSpan(new StyleSpan(Typeface.BOLD), 0, sp.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
                    numero = sp;
                }
                rv.setTextViewText(id[1], numero);
                rv.setInt(id[1], "setBackgroundResource", eOggi ? R.drawable.widget_oggi_tondo : 0);
                rv.setTextColor(id[1], ctx.getColor(eOggi ? R.color.w_su_accento : altroMese ? R.color.w_accento : R.color.w_ink));
                // oggi: una cornice sottile attorno a tutta la cella (data e sigle)
                rv.setInt(id[0], "setBackgroundResource", eOggi ? R.drawable.widget_oggi_cornice : 0);
                rv.setFloat(id[0], "setAlpha", passato ? 0.45f : 1f);
                pillola(ctx, rv, id[2], m.mio(i), false);
                rv.setViewVisibility(id[3], persona >= 0 ? View.VISIBLE : View.GONE);
                if (persona >= 0) pillola(ctx, rv, id[3], m.di(persona, i), true);

                String iso = String.format(Locale.ROOT, "%04d-%02d-%02d", dt[0], dt[1], dt[2]);
                Intent gi = new Intent(Intent.ACTION_VIEW, Uri.parse("notturnisti://giorno/" + iso), ctx, MainActivity.class);
                gi.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                rv.setOnClickPendingIntent(id[0], NotturnistiWidget.attivita(ctx, 400 + r * COLONNE + c, gi));
                rv.setContentDescription(id[0], GIORNI[c] + " " + dt[2] + ": " + etichetta(m.mio(i)) + (persona >= 0 ? ", " + m.persone.get(persona).nome + ": " + etichetta(m.di(persona, i)) : ""));
            }
        }
    }

    /** Sigla in una pillola: tinta e testo per fascia (mattina, pomeriggio, sera, notte, riposo); la persona in verde acqua. */
    private static void pillola(Context ctx, RemoteViews rv, int id, CalendarioModel.Cella c, boolean persona) {
        boolean ignoto = c == null || c.tipo == '?';
        rv.setTextViewText(id, ignoto ? "·" : c.sigla);
        int sfondo = R.drawable.widget_cella_riposo, testo = R.color.w_dim;
        if (!ignoto) switch (c.tipo) {
            case 'n': sfondo = persona ? R.drawable.widget_cella_p_notte : R.drawable.widget_cella_notte; testo = persona ? R.color.w_cella_p_notte_t : R.color.w_cella_notte_t; break;
            case 'm': sfondo = persona ? R.drawable.widget_cella_p_lavoro : R.drawable.widget_cella_mattina; testo = persona ? R.color.w_cella_p_lavoro_t : R.color.w_cella_mattina_t; break;
            case 's': sfondo = persona ? R.drawable.widget_cella_p_lavoro : R.drawable.widget_cella_sera; testo = persona ? R.color.w_cella_p_lavoro_t : R.color.w_cella_sera_t; break;
            case 'l': case 'p': sfondo = persona ? R.drawable.widget_cella_p_lavoro : R.drawable.widget_cella_lavoro; testo = persona ? R.color.w_cella_p_lavoro_t : R.color.w_cella_lavoro_t; break;
            default: sfondo = persona ? R.drawable.widget_cella_p_riposo : R.drawable.widget_cella_riposo;
        }
        rv.setInt(id, "setBackgroundResource", sfondo);
        rv.setTextColor(id, ctx.getColor(testo));
        // i turni si leggono prima dei riposi (che sono la maggior parte dei giorni): lettera più grande contro più piccola
        boolean lavoro = !ignoto && c.tipo != 'r';
        rv.setTextViewTextSize(id, TypedValue.COMPLEX_UNIT_SP, persona ? (lavoro ? 11f : 10f) : (lavoro ? 13f : 11f));
    }

    private static String etichetta(CalendarioModel.Cella c) {
        if (c == null || c.tipo == '?') return "da impostare";
        String t = c.tipo == 'n' ? "notte" : c.tipo == 'r' ? "riposo" : c.tipo == 'm' ? "mattina" : c.tipo == 'p' ? "pomeriggio" : c.tipo == 's' ? "sera" : "lavoro";
        return c.sigla.equals("R") || c.sigla.equals("N") || c.sigla.equals(t) ? t : c.sigla + ", " + t;
    }
}
