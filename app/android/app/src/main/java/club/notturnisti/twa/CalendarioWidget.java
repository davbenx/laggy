package club.notturnisti.twa;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;
import java.util.Calendar;
import java.util.Locale;

/**
 * Il calendario a settimane del widget: tu sopra, la persona che segui sotto (verde acqua). Parte dalla settimana
 * di oggi e aggiunge righe quanto il widget è alto. Sono viste vere (non un'immagine): seguono tema e testo, e
 * le righe si dividono lo spazio che resta. Un tocco su un giorno apre l'app su quel giorno; un tocco sul nome della
 * persona passa alla successiva, poi la nasconde (la scelta resta finché nell'app non sposti la stellina).
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

    /** Righe di calendario possibili con questi dati, a partire dalla settimana di oggi. */
    static int righeDisponibili(CalendarioModel m, long ora) {
        if (m == null) return 0;
        int oggi = indiceOggi(m, ora), r0 = oggi < 0 ? 0 : oggi / COLONNE;
        return Math.max(0, Math.min(RIGHE, m.settimane() - r0));
    }

    static int indiceOggi(CalendarioModel m, long ora) {
        Calendar c = Calendar.getInstance(); c.setTimeInMillis(ora);
        return m.indice(c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH));
    }

    static PendingIntent cambiaPersona(Context ctx, int id) {
        Intent i = new Intent(ctx, NotturnistiWidget.class).setAction(NotturnistiWidget.AZIONE_PERSONA).putExtra("id", id);
        return NotturnistiWidget.trasmetti(ctx, 6000 + id, i);
    }

    /** Riempie le righe. `righe` = quante mostrare (0: il calendario sparisce). */
    static void riempi(Context ctx, RemoteViews rv, CalendarioModel m, int righe, int persona, long ora, int idWidget) {
        carica(ctx);
        int disp = righeDisponibili(m, ora);
        righe = Math.min(righe, disp);
        rv.setViewVisibility(R.id.w_cal, righe > 0 ? View.VISIBLE : View.GONE);
        if (righe <= 0) return;
        int oggi = indiceOggi(m, ora), r0 = oggi < 0 ? 0 : oggi / COLONNE;

        rv.setTextViewText(R.id.w_cal_mese, m.etichettaMese(r0, righe));
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
                // numero del giorno: «1 nov» al cambio di mese, oggi su un tondo
                rv.setTextViewText(id[1], dt[2] == 1 ? "1 " + MESI_BREVI[dt[1] - 1] : String.valueOf(dt[2]));
                rv.setInt(id[1], "setBackgroundResource", eOggi ? R.drawable.widget_oggi_tondo : 0);
                rv.setTextColor(id[1], ctx.getColor(eOggi ? R.color.w_su_accento : R.color.w_dim));
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

    /** Sigla in una pillola: tinta e testo per tipo (notte, lavoro, riposo); la persona in verde acqua. */
    private static void pillola(Context ctx, RemoteViews rv, int id, CalendarioModel.Cella c, boolean persona) {
        boolean ignoto = c == null || c.tipo == '?';
        rv.setTextViewText(id, ignoto ? "·" : c.sigla);
        int sfondo = R.drawable.widget_cella_riposo, testo = R.color.w_dim;
        if (!ignoto) switch (c.tipo) {
            case 'n': sfondo = persona ? R.drawable.widget_cella_p_notte : R.drawable.widget_cella_notte; testo = persona ? R.color.w_pl_notte_t : R.color.w_t_sonno; break;
            case 'l': sfondo = persona ? R.drawable.widget_cella_p_lavoro : R.drawable.widget_cella_lavoro; testo = persona ? R.color.w_pl_lavoro_t : R.color.w_t_turno; break;
            default: sfondo = persona ? R.drawable.widget_cella_p_riposo : R.drawable.widget_cella_riposo;
        }
        rv.setInt(id, "setBackgroundResource", sfondo);
        rv.setTextColor(id, ctx.getColor(testo));
    }

    private static String etichetta(CalendarioModel.Cella c) {
        if (c == null || c.tipo == '?') return "da impostare";
        String t = c.tipo == 'n' ? "notte" : c.tipo == 'r' ? "riposo" : "lavoro";
        return c.sigla.equals("R") || c.sigla.equals("N") || c.sigla.equals(t) ? t : c.sigla + ", " + t;
    }
}
