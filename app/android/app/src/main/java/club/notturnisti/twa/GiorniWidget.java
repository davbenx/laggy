package club.notturnisti.twa;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;
import java.util.Locale;
import org.json.JSONObject;

/**
 * Le settimane dopo la prima: più il widget è alto, più righe di sette giorni si aggiungono di
 * seguito alla settimana (fino a cinque, oltre un mese). Sotto la tua sigla, quella della persona con
 * la stellina. Sono viste vere (non un'immagine): seguono il tema e la grandezza del testo.
 */
final class GiorniWidget {
    static final int RIGHE = 5, COLONNE = 7;
    private static final String[] MESI = { "gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic" };
    private static final int[][][] CELLE = new int[RIGHE][COLONNE][4];   // [riga][colonna] = {cella, data, mia, sua}
    private static final int[] RIGA = { R.id.w_xr0, R.id.w_xr1, R.id.w_xr2, R.id.w_xr3, R.id.w_xr4 };

    static {
        int[][] id = {
            { R.id.w_x0_0, R.id.w_x0_0_d, R.id.w_x0_0_c, R.id.w_x0_0_p }, { R.id.w_x0_1, R.id.w_x0_1_d, R.id.w_x0_1_c, R.id.w_x0_1_p },
            { R.id.w_x0_2, R.id.w_x0_2_d, R.id.w_x0_2_c, R.id.w_x0_2_p }, { R.id.w_x0_3, R.id.w_x0_3_d, R.id.w_x0_3_c, R.id.w_x0_3_p },
            { R.id.w_x0_4, R.id.w_x0_4_d, R.id.w_x0_4_c, R.id.w_x0_4_p }, { R.id.w_x0_5, R.id.w_x0_5_d, R.id.w_x0_5_c, R.id.w_x0_5_p },
            { R.id.w_x0_6, R.id.w_x0_6_d, R.id.w_x0_6_c, R.id.w_x0_6_p },
            { R.id.w_x1_0, R.id.w_x1_0_d, R.id.w_x1_0_c, R.id.w_x1_0_p }, { R.id.w_x1_1, R.id.w_x1_1_d, R.id.w_x1_1_c, R.id.w_x1_1_p },
            { R.id.w_x1_2, R.id.w_x1_2_d, R.id.w_x1_2_c, R.id.w_x1_2_p }, { R.id.w_x1_3, R.id.w_x1_3_d, R.id.w_x1_3_c, R.id.w_x1_3_p },
            { R.id.w_x1_4, R.id.w_x1_4_d, R.id.w_x1_4_c, R.id.w_x1_4_p }, { R.id.w_x1_5, R.id.w_x1_5_d, R.id.w_x1_5_c, R.id.w_x1_5_p },
            { R.id.w_x1_6, R.id.w_x1_6_d, R.id.w_x1_6_c, R.id.w_x1_6_p },
            { R.id.w_x2_0, R.id.w_x2_0_d, R.id.w_x2_0_c, R.id.w_x2_0_p }, { R.id.w_x2_1, R.id.w_x2_1_d, R.id.w_x2_1_c, R.id.w_x2_1_p },
            { R.id.w_x2_2, R.id.w_x2_2_d, R.id.w_x2_2_c, R.id.w_x2_2_p }, { R.id.w_x2_3, R.id.w_x2_3_d, R.id.w_x2_3_c, R.id.w_x2_3_p },
            { R.id.w_x2_4, R.id.w_x2_4_d, R.id.w_x2_4_c, R.id.w_x2_4_p }, { R.id.w_x2_5, R.id.w_x2_5_d, R.id.w_x2_5_c, R.id.w_x2_5_p },
            { R.id.w_x2_6, R.id.w_x2_6_d, R.id.w_x2_6_c, R.id.w_x2_6_p },
            { R.id.w_x3_0, R.id.w_x3_0_d, R.id.w_x3_0_c, R.id.w_x3_0_p }, { R.id.w_x3_1, R.id.w_x3_1_d, R.id.w_x3_1_c, R.id.w_x3_1_p },
            { R.id.w_x3_2, R.id.w_x3_2_d, R.id.w_x3_2_c, R.id.w_x3_2_p }, { R.id.w_x3_3, R.id.w_x3_3_d, R.id.w_x3_3_c, R.id.w_x3_3_p },
            { R.id.w_x3_4, R.id.w_x3_4_d, R.id.w_x3_4_c, R.id.w_x3_4_p }, { R.id.w_x3_5, R.id.w_x3_5_d, R.id.w_x3_5_c, R.id.w_x3_5_p },
            { R.id.w_x3_6, R.id.w_x3_6_d, R.id.w_x3_6_c, R.id.w_x3_6_p },
            { R.id.w_x4_0, R.id.w_x4_0_d, R.id.w_x4_0_c, R.id.w_x4_0_p }, { R.id.w_x4_1, R.id.w_x4_1_d, R.id.w_x4_1_c, R.id.w_x4_1_p },
            { R.id.w_x4_2, R.id.w_x4_2_d, R.id.w_x4_2_c, R.id.w_x4_2_p }, { R.id.w_x4_3, R.id.w_x4_3_d, R.id.w_x4_3_c, R.id.w_x4_3_p },
            { R.id.w_x4_4, R.id.w_x4_4_d, R.id.w_x4_4_c, R.id.w_x4_4_p }, { R.id.w_x4_5, R.id.w_x4_5_d, R.id.w_x4_5_c, R.id.w_x4_5_p },
            { R.id.w_x4_6, R.id.w_x4_6_d, R.id.w_x4_6_c, R.id.w_x4_6_p } };
        for (int i = 0; i < RIGHE * COLONNE; i++) CELLE[i / COLONNE][i % COLONNE] = id[i];
    }

    /** Mostra le righe che stanno nell'altezza `altezzaDp`; le altre restano nascoste. */
    static void riempi(Context ctx, RemoteViews rv, JSONObject pubblicato, int altezzaDp) {
        GiorniModel m = pubblicato == null ? null : GiorniModel.leggi(pubblicato);
        int n = m == null ? 0 : Math.min(GiorniModel.righeExtra(altezzaDp, m.persona != null, RIGHE), (m.giorni() / COLONNE) - 1);
        rv.setViewVisibility(R.id.w_extra, n > 0 ? View.VISIBLE : View.GONE);
        if (n <= 0) return;
        boolean conPersona = m.persona != null;
        for (int r = 0; r < RIGHE; r++) {
            rv.setViewVisibility(RIGA[r], r < n ? View.VISIBLE : View.GONE);
            if (r >= n) continue;
            for (int c = 0; c < COLONNE; c++) {
                int i = (r + 1) * COLONNE + c;                       // la prima riga è la settimana già in alto
                int[] id = CELLE[r][c], dt = m.data(i);
                GiorniModel.Cella mia = m.mio(i), sua = m.sua(i);
                rv.setTextViewText(id[1], dt[2] == 1 ? "1 " + MESI[dt[1] - 1] : String.valueOf(dt[2]));
                rv.setTextViewText(id[2], mia == null || mia.tipo == '?' ? "?" : mia.sigla);
                rv.setInt(id[2], "setBackgroundResource", sfondo(mia, false));
                rv.setViewVisibility(id[3], conPersona ? View.VISIBLE : View.GONE);
                if (conPersona) {
                    rv.setTextViewText(id[3], sua == null || sua.tipo == '?' ? "·" : sua.sigla);
                    rv.setInt(id[3], "setBackgroundResource", sfondo(sua, true));
                    rv.setTextColor(id[3], ctx.getColor(sua != null && sua.tipo == 'n' ? R.color.w_p_notte_t : R.color.w_ink));
                }
                String iso = String.format(Locale.ROOT, "%04d-%02d-%02d", dt[0], dt[1], dt[2]);
                Intent gi = new Intent(Intent.ACTION_VIEW, Uri.parse("notturnisti://giorno/" + iso), ctx, MainActivity.class);
                gi.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                rv.setOnClickPendingIntent(id[0], PendingIntent.getActivity(ctx, 400 + i, gi, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
                rv.setContentDescription(id[0], dt[2] + " " + MESI[dt[1] - 1] + ": " + etichetta(mia) + (conPersona ? ", " + m.persona + ": " + etichetta(sua) : ""));
            }
        }
        rv.setViewVisibility(R.id.w_x_leg, conPersona ? View.VISIBLE : View.GONE);
        if (conPersona) rv.setTextViewText(R.id.w_x_leg, "Sopra tu, sotto " + m.persona);
    }

    private static int sfondo(GiorniModel.Cella c, boolean persona) {
        if (c == null) return R.drawable.widget_cella_riposo;
        switch (c.tipo) {
            case 'n': return persona ? R.drawable.widget_cella_p_notte : R.drawable.widget_cella_notte;
            case 'l': return persona ? R.drawable.widget_cella_p_lavoro : R.drawable.widget_cella_lavoro;
            default: return R.drawable.widget_cella_riposo;
        }
    }

    private static String etichetta(GiorniModel.Cella c) {
        if (c == null || c.tipo == '?') return "da impostare";
        String t = c.tipo == 'n' ? "notte" : c.tipo == 'r' ? "riposo" : "lavoro";
        return c.sigla.equals("R") || c.sigla.equals("N") || c.sigla.equals(t) ? t : c.sigla + ", " + t;
    }
}
