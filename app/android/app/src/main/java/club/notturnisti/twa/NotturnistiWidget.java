package club.notturnisti.twa;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;
import java.util.Calendar;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Widget "Il tuo piano": cosa vale adesso e le prossime due cose da fare.
 *
 * La timeline arriva già calcolata dalla pagina (WidgetPlugin) come elenco
 * di voci {s: inizio ms, e: fine ms, t: titolo}. Qui si sceglie solo cosa
 * mostrare in base all'ora, e si programma il prossimo ridisegno al prossimo
 * cambio (inizio o fine di una voce) — più l'aggiornamento di sistema ogni
 * 30 minuti come rete di sicurezza. Se l'app non viene aperta per giorni la
 * timeline si esaurisce e il widget lo dice, invece di mostrare dati vecchi.
 */
public class NotturnistiWidget extends AppWidgetProvider {
    static final String AZIONE_TICK = "club.notturnisti.twa.WIDGET_TICK";

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        disegna(ctx, mgr, ids);
    }

    @Override
    public void onReceive(Context ctx, Intent intent) {
        super.onReceive(ctx, intent);
        if (AZIONE_TICK.equals(intent.getAction())) aggiornaTutti(ctx);
    }

    static int quanti(Context ctx) {
        return AppWidgetManager.getInstance(ctx).getAppWidgetIds(new ComponentName(ctx, NotturnistiWidget.class)).length;
    }

    static void aggiornaTutti(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, NotturnistiWidget.class));
        if (ids.length > 0) disegna(ctx, mgr, ids);
    }

    private static String hhmm(long t, long ora) {
        Calendar c = Calendar.getInstance(); c.setTimeInMillis(t);
        Calendar n = Calendar.getInstance(); n.setTimeInMillis(ora);
        String h = String.format(Locale.ITALY, "%02d:%02d", c.get(Calendar.HOUR_OF_DAY), c.get(Calendar.MINUTE));
        boolean domani = c.get(Calendar.DAY_OF_YEAR) != n.get(Calendar.DAY_OF_YEAR) || c.get(Calendar.YEAR) != n.get(Calendar.YEAR);
        return domani ? "domani " + h : h;
    }

    static void disegna(Context ctx, AppWidgetManager mgr, int[] ids) {
        long ora = System.currentTimeMillis();
        String adesso = "Apri Notturnisti";
        String sotto = "per vedere il tuo piano qui";
        String p1 = "", p2 = "";
        long prossimoCambio = Long.MAX_VALUE;
        try {
            String json = ctx.getSharedPreferences(WidgetPlugin.PREFS, Context.MODE_PRIVATE).getString(WidgetPlugin.KEY, null);
            if (json != null) {
                JSONArray v = new JSONObject(json).getJSONArray("voci");
                JSONObject corrente = null;
                int prossimi = 0;
                for (int i = 0; i < v.length(); i++) {
                    JSONObject x = v.getJSONObject(i);
                    long s = x.getLong("s"), e = x.getLong("e");
                    if (s > ora && s < prossimoCambio) prossimoCambio = s;
                    if (e > ora && e < prossimoCambio) prossimoCambio = e;
                    if (s <= ora && e > ora && corrente == null) corrente = x;
                    else if (s > ora && prossimi < 2) {
                        String riga = hhmm(s, ora) + "  " + x.getString("t");
                        if (prossimi == 0) p1 = riga; else p2 = riga;
                        prossimi++;
                    }
                }
                if (corrente != null) {
                    adesso = corrente.getString("t");
                    sotto = "fino alle " + hhmm(corrente.getLong("e"), ora);
                } else if (prossimi > 0) {
                    adesso = "Nessun impegno adesso";
                    sotto = "";
                } else {
                    adesso = "Piano da aggiornare";
                    sotto = "apri Notturnisti";
                }
            }
        } catch (Exception ignored) { }

        Intent apri = new Intent(ctx, MainActivity.class);
        apri.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, 0, apri, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        for (int id : ids) {
            RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.widget_piano);
            rv.setTextViewText(R.id.w_adesso, adesso);
            rv.setTextViewText(R.id.w_sotto, sotto);
            rv.setTextViewText(R.id.w_p1, p1);
            rv.setTextViewText(R.id.w_p2, p2);
            rv.setOnClickPendingIntent(R.id.w_root, pi);
            mgr.updateAppWidget(id, rv);
        }

        // Prossimo ridisegno al prossimo cambio. Allarme inesatto e senza
        // risveglio: se il telefono dorme si aggiorna appena si accende lo
        // schermo, che è quando il widget si guarda. Nessun permesso speciale.
        if (prossimoCambio != Long.MAX_VALUE) {
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            Intent tick = new Intent(ctx, NotturnistiWidget.class).setAction(AZIONE_TICK);
            PendingIntent tp = PendingIntent.getBroadcast(ctx, 1, tick, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
            if (am != null) am.set(AlarmManager.RTC, Math.max(prossimoCambio + 1000, ora + 60_000), tp);
        }
    }
}
