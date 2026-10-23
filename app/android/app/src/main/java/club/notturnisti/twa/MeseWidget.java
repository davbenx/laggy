package club.notturnisti.twa;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;
import java.util.Calendar;
import java.util.Locale;
import org.json.JSONObject;

/**
 * Il widget grande: un mese in griglia, la mia sigla per giorno e, sotto, quella della persona scelta
 * (la compagna, il collega…). I dati li calcola la pagina (MeseModel); qui si disegna e si ricordano
 * mese e persona scelti. La persona scelta dal widget resta finché non la cambi tu; se nell'app
 * sposti la stellina in «Le tue persone», si riparte da quella.
 */
final class MeseWidget {
    static final String AZIONE = "club.notturnisti.twa.WIDGET_MESE";
    private static final String[] MESI = { "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre" };
    private static final String[] GIORNI = { "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica" };
    private static final String LETTERE = "LMMGVSD";
    private static final int[][] CASELLE = new int[6][7];
    private static final int[] RIGHE = { R.id.w_m_r0, R.id.w_m_r1, R.id.w_m_r2, R.id.w_m_r3, R.id.w_m_r4, R.id.w_m_r5 };
    private static final int STRISCIA_DP = 16, TESTA_DP = 40, MARGINE_DP = 8;

    static {
        int[] c = { R.id.w_m_c0, R.id.w_m_c1, R.id.w_m_c2, R.id.w_m_c3, R.id.w_m_c4, R.id.w_m_c5, R.id.w_m_c6, R.id.w_m_c7, R.id.w_m_c8, R.id.w_m_c9,
            R.id.w_m_c10, R.id.w_m_c11, R.id.w_m_c12, R.id.w_m_c13, R.id.w_m_c14, R.id.w_m_c15, R.id.w_m_c16, R.id.w_m_c17, R.id.w_m_c18, R.id.w_m_c19,
            R.id.w_m_c20, R.id.w_m_c21, R.id.w_m_c22, R.id.w_m_c23, R.id.w_m_c24, R.id.w_m_c25, R.id.w_m_c26, R.id.w_m_c27, R.id.w_m_c28, R.id.w_m_c29,
            R.id.w_m_c30, R.id.w_m_c31, R.id.w_m_c32, R.id.w_m_c33, R.id.w_m_c34, R.id.w_m_c35, R.id.w_m_c36, R.id.w_m_c37, R.id.w_m_c38, R.id.w_m_c39,
            R.id.w_m_c40, R.id.w_m_c41 };
        for (int i = 0; i < 42; i++) CASELLE[i / 7][i % 7] = c[i];
    }

    /** Il mese ha spazio solo da una certa dimensione in su. */
    static boolean abbastanzaGrande(int larghezzaDp, int altezzaDp) { return larghezzaDp >= 250 && altezzaDp >= 280; }

    private static SharedPreferences prefs(Context ctx) { return ctx.getSharedPreferences(WidgetPlugin.PREFS, Context.MODE_PRIVATE); }

    /** Mese (‹ ›) o persona (tocco sul titolo), per un widget. */
    static void azione(Context ctx, Intent i) {
        int id = i.getIntExtra("id", 0);
        SharedPreferences sp = prefs(ctx);
        try {
            MeseModel m = MeseModel.leggi(new JSONObject(sp.getString(WidgetPlugin.KEY, "{}")).optJSONObject("mese"));
            if (m == null) return;
            SharedPreferences.Editor ed = sp.edit();
            int dir = i.getIntExtra("dir", 0);
            if (dir != 0) {
                int off = Math.max(0, Math.min(m.ultimoMese(), sp.getInt("mese_off_" + id, 0) + dir));
                ed.putInt("mese_off_" + id, off);
            } else if (i.getBooleanExtra("persona", false) && m.persone.size() > 1) {
                int attiva = m.personaAttiva(sp.getInt("mese_pers_" + id, -1), sp.getString("mese_star_" + id, ""));
                ed.putInt("mese_pers_" + id, m.prossimaPersona(attiva)).putString("mese_star_" + id, m.stella);
            }
            ed.apply();
        } catch (Exception ignored) { }
    }

    private static PendingIntent trasmetti(Context ctx, int id, int codice, int dir, boolean persona) {
        Intent i = new Intent(ctx, NotturnistiWidget.class).setAction(AZIONE).putExtra("id", id).putExtra("dir", dir).putExtra("persona", persona);
        // un codice diverso per widget e per azione: due widget non si pestano i piedi
        return PendingIntent.getBroadcast(ctx, 5000 + id * 8 + codice, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private static PendingIntent apriGiorno(Context ctx, int codice, String data) {
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse("notturnisti://giorno/" + data), ctx, MainActivity.class);
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(ctx, codice, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    /**
     * Riempie la vista del mese. Restituisce false se i dati non ci sono (allora il widget resta
     * quello normale, che dice di aprire l'app).
     */
    static boolean mostra(Context ctx, RemoteViews rv, JSONObject pubblicato, int id, int larghezzaDp, int altezzaDp, long ora, PendingIntent apri) {
        MeseModel m = MeseModel.leggi(pubblicato);
        if (m == null) return false;
        SharedPreferences sp = prefs(ctx);
        int off = Math.max(0, Math.min(m.ultimoMese(), sp.getInt("mese_off_" + id, 0)));
        MeseModel.Griglia g = m.griglia(off);
        if (g == null) return false;

        // Persona: la scelta di questo widget regge finché la stellina nell'app non cambia.
        String vista = sp.getString("mese_star_" + id, "");
        int attiva = m.personaAttiva(sp.getInt("mese_pers_" + id, -1), vista);
        if (!m.stella.equals(vista)) sp.edit().putString("mese_star_" + id, m.stella).putInt("mese_pers_" + id, attiva).apply();

        Calendar adesso = Calendar.getInstance(); adesso.setTimeInMillis(ora);
        int oggi = m.indice(adesso.get(Calendar.YEAR), adesso.get(Calendar.MONTH) + 1, adesso.get(Calendar.DAY_OF_MONTH));

        float d = ctx.getResources().getDisplayMetrics().density;
        float larghezza = larghezzaDp - 2 * MARGINE_DP, altezza = altezzaDp - 2 * MARGINE_DP - TESTA_DP;
        rv.setImageViewBitmap(R.id.w_m_img, disegna(ctx, m, g, attiva, oggi, larghezza, altezza, d));

        String nomePersona = attiva >= 0 ? m.persone.get(attiva).nome : "";
        rv.setTextViewText(R.id.w_m_titolo, MESI[g.mese - 1] + " " + g.anno);
        rv.setTextViewText(R.id.w_m_sub, attiva >= 0 ? "tu sopra · " + nomePersona + " sotto" + (m.persone.size() > 1 ? " · tocca per cambiare" : "") : "");
        rv.setViewVisibility(R.id.w_m_sub, attiva >= 0 ? View.VISIBLE : View.GONE);
        rv.setTextColor(R.id.w_m_prec, ctx.getColor(off > 0 ? R.color.w_ink : R.color.w_chip));
        rv.setTextColor(R.id.w_m_succ, ctx.getColor(off < m.ultimoMese() ? R.color.w_ink : R.color.w_chip));
        rv.setOnClickPendingIntent(R.id.w_m_prec, trasmetti(ctx, id, 0, -1, false));
        rv.setOnClickPendingIntent(R.id.w_m_succ, trasmetti(ctx, id, 1, 1, false));
        rv.setOnClickPendingIntent(R.id.w_m_testa, m.persone.size() > 1 ? trasmetti(ctx, id, 2, 0, true) : apri);
        rv.setContentDescription(R.id.w_m_testa, MESI[g.mese - 1] + " " + g.anno + (attiva >= 0 ? ", con " + nomePersona + (m.persone.size() > 1 ? ". Tocca per cambiare persona" : "") : ""));

        for (int r = 0; r < 6; r++) {
            rv.setViewVisibility(RIGHE[r], r < g.settimane ? View.VISIBLE : View.GONE);
            for (int c = 0; c < 7; c++) {
                if (r >= g.settimane) continue;
                int i = g.primo + r * 7 + c;
                int[] dt = m.data(i);
                String iso = String.format(Locale.ROOT, "%04d-%02d-%02d", dt[0], dt[1], dt[2]);
                rv.setOnClickPendingIntent(CASELLE[r][c], apriGiorno(ctx, 300 + r * 7 + c, iso));
                StringBuilder desc = new StringBuilder(GIORNI[c] + " " + dt[2] + " " + MESI[dt[1] - 1].toLowerCase(Locale.ITALY) + ": " + etichetta(m.mio(i)));
                if (attiva >= 0) {
                    desc.append(", ").append(nomePersona).append(": ").append(etichetta(m.di(attiva, i)));
                    if (m.insieme(attiva, i)) desc.append(", liberi insieme");
                }
                rv.setContentDescription(CASELLE[r][c], desc.toString());
            }
        }
        rv.setContentDescription(R.id.w_m_img, null);
        rv.setOnClickPendingIntent(android.R.id.background, apri);
        rv.setViewPadding(android.R.id.background, (int) (MARGINE_DP * d), (int) (MARGINE_DP * d), (int) (MARGINE_DP * d), (int) (MARGINE_DP * d));
        return true;
    }

    private static String etichetta(MeseModel.Cella c) {
        if (c == null || c.tipo == '?') return "da impostare";
        String t = c.tipo == 'n' ? "notte" : c.tipo == 'r' ? "riposo" : "lavoro";
        return c.sigla.equals("R") || c.sigla.equals(t) ? t : c.sigla + ", " + t;
    }

    // ───────── disegno ─────────

    private static Bitmap disegna(Context ctx, MeseModel m, MeseModel.Griglia g, int persona, int oggi, float wDp, float hDp, float d) {
        int w = Math.max(1, Math.min(1600, Math.round(wDp * d))), h = Math.max(1, Math.min(1600, Math.round(hDp * d)));
        Bitmap bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(bmp);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setTextAlign(Paint.Align.CENTER);
        float striscia = STRISCIA_DP * d, cw = w / 7f, ch = (h - striscia) / g.settimane;
        int ink = ctx.getColor(R.color.w_ink), dim = ctx.getColor(R.color.w_dim), accento = ctx.getColor(R.color.w_accento);

        // lettere dei giorni
        p.setTextSize(10 * d); p.setColor(dim); p.setTypeface(Typeface.DEFAULT_BOLD);
        for (int c = 0; c < 7; c++) cv.drawText(String.valueOf(LETTERE.charAt(c)), cw * (c + 0.5f), striscia - 4 * d, p);

        for (int r = 0; r < g.settimane; r++) for (int c = 0; c < 7; c++) {
            int i = g.primo + r * 7 + c;
            float x = c * cw, y = striscia + r * ch;
            boolean dentro = g.inMese(i);
            int alfa = dentro ? 255 : 90;

            // numero del giorno, in alto a sinistra; oggi su un cerchio
            float nx = x + 3 * d, base = y + 11 * d;
            p.setTypeface(Typeface.DEFAULT_BOLD); p.setTextSize(10 * d); p.setTextAlign(Paint.Align.LEFT);
            String numero = String.valueOf(g.numero(m, i));
            if (i == oggi) {
                p.setColor(accento); cv.drawCircle(nx + p.measureText(numero) / 2, base - 3.5f * d, 7.5f * d, p);
                p.setColor(ctx.getColor(R.color.w_su_accento));
            } else p.setColor(withAlpha(ink, alfa));
            cv.drawText(numero, nx, base, p);
            p.setTextAlign(Paint.Align.CENTER);

            // «liberi insieme»: un puntino in alto a destra
            if (persona >= 0 && m.insieme(persona, i)) { p.setColor(withAlpha(ctx.getColor(R.color.w_m_insieme), alfa)); cv.drawCircle(x + cw - 6 * d, y + 7 * d, 3 * d, p); }

            // le sigle: la mia sopra, quella della persona sotto
            float top = y + 14 * d, libero = y + ch - top - 2 * d;
            int righe = persona >= 0 ? 2 : 1;
            float alt = Math.min(libero / righe - 2 * d, 20 * d);
            if (alt < 6 * d) continue;
            pillola(ctx, cv, p, m.mio(i), false, x + 2 * d, top, cw - 4 * d, alt, alfa);
            if (persona >= 0) pillola(ctx, cv, p, m.di(persona, i), true, x + 2 * d, top + alt + 2 * d, cw - 4 * d, alt, alfa);
        }
        return bmp;
    }

    private static int withAlpha(int colore, int alfa) { return (colore & 0x00FFFFFF) | (alfa << 24); }

    /** Sigla in una pillola: lavoro e notte hanno colori propri, riposo e «da impostare» restano sobri. Le persone in verde acqua. */
    private static void pillola(Context ctx, Canvas cv, Paint p, MeseModel.Cella c, boolean altro, float x, float y, float w, float h, int alfa) {
        int sfondo, testo; String sigla;
        if (c == null || c.tipo == '?') { sfondo = ctx.getColor(R.color.w_chip); testo = ctx.getColor(R.color.w_dim); sigla = "?"; }
        else {
            sigla = c.sigla;
            switch (c.tipo) {
                case 'n': sfondo = ctx.getColor(altro ? R.color.w_p_notte : R.color.w_cella_notte); testo = ctx.getColor(altro ? R.color.w_p_notte_t : R.color.w_t_sonno); break;
                case 'l': sfondo = ctx.getColor(altro ? R.color.w_p_lavoro : R.color.w_cella_lavoro); testo = ctx.getColor(altro ? R.color.w_p_lavoro_t : R.color.w_t_turno); break;
                default: sfondo = ctx.getColor(R.color.w_chip); testo = ctx.getColor(R.color.w_dim);
            }
        }
        p.setColor(withAlpha(sfondo, alfa));
        cv.drawRoundRect(new RectF(x, y, x + w, y + h), h / 2.6f, h / 2.6f, p);
        p.setTypeface(Typeface.DEFAULT_BOLD);
        float size = Math.min(h * 0.64f, 12 * ctx.getResources().getDisplayMetrics().density);
        p.setTextSize(size);
        while (p.measureText(sigla) > w - 4 && size > 6) { size -= 1; p.setTextSize(size); }
        p.setColor(withAlpha(testo, alfa));
        p.setTextAlign(Paint.Align.CENTER);
        cv.drawText(sigla, x + w / 2, y + h / 2 + size * 0.35f, p);
    }
}
