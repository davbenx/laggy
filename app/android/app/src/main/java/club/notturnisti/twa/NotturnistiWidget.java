package club.notturnisti.twa;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.provider.AlarmClock;
import android.view.View;
import android.widget.RemoteViews;
import java.util.Calendar;
import org.json.JSONObject;

/**
 * Widget «Il tuo piano»: parte minimale (cosa conta adesso, con la barra se è in corso) e aggiunge pezzi via via che lo
 * allarghi in altezza: il pulsante giusto per il momento (sveglia, orario del sonno o del pisolino, voto del sonno e
 * dell'energia), le prossime voci, il calendario a settimane con la persona che segui. Cosa dire lo calcola WidgetStato,
 * cosa mostrare WidgetPiano, il calendario CalendarioWidget; qui si assemblano le viste e si programma il prossimo ridisegno
 * (al prossimo cambio, o fra pochi minuti se c'è un conto alla rovescia; a mezzanotte se c'è il calendario).
 * Se l'app non viene aperta per giorni la timeline si esaurisce e il widget lo dice, invece di mostrare dati vecchi.
 * Le risposte del diario restano qui finché l'app non le prende (WidgetPlugin.risposte).
 */
public class NotturnistiWidget extends AppWidgetProvider {
    static final String AZIONE_TICK = "club.notturnisti.twa.WIDGET_TICK";
    static final String AZIONE_DIARIO = "club.notturnisti.twa.WIDGET_DIARIO";
    static final String AZIONE_PERSONA = "club.notturnisti.twa.WIDGET_PERSONA";
    static final String AZIONE_PAGINA = "club.notturnisti.twa.WIDGET_PAGINA";
    static final String KEY_RISPOSTE = "risposte";

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) { disegna(ctx, mgr, ids); }

    // Ridimensionato dall'utente: le sezioni compaiono o spariscono.
    @Override
    public void onAppWidgetOptionsChanged(Context ctx, AppWidgetManager mgr, int id, Bundle opzioni) { disegna(ctx, mgr, new int[]{ id }); }

    @Override
    public void onDeleted(Context ctx, int[] ids) {
        SharedPreferences.Editor ed = prefs(ctx).edit();
        for (int id : ids) ed.remove("pers_" + id).remove("star_" + id).remove("off_" + id).remove("offd_" + id);
        ed.apply();
    }

    @Override
    public void onReceive(Context ctx, Intent intent) {
        super.onReceive(ctx, intent);
        String a = intent.getAction();
        if (AZIONE_TICK.equals(a)) aggiornaTutti(ctx);
        if (AZIONE_DIARIO.equals(a)) { salvaRisposta(ctx, intent); aggiornaTutti(ctx); }
        if (AZIONE_PERSONA.equals(a)) { cambiaPersona(ctx, intent.getIntExtra("id", 0)); aggiornaTutti(ctx); }
        if (AZIONE_PAGINA.equals(a)) { vaiAPagina(ctx, intent.getIntExtra("id", 0), intent.getIntExtra("off", 0)); aggiornaTutti(ctx); }
    }

    /** Solo per le prove sulla JVM (anteprima dei layout): senza sistema Android non si creano PendingIntent. */
    static boolean senzaIntent = false;
    private static final int FLAG = PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT;
    static PendingIntent attivita(Context ctx, int codice, Intent i) { return senzaIntent ? null : PendingIntent.getActivity(ctx, codice, i, FLAG); }
    static PendingIntent trasmetti(Context ctx, int codice, Intent i) { return senzaIntent ? null : PendingIntent.getBroadcast(ctx, codice, i, FLAG); }

    static SharedPreferences prefs(Context ctx) { return ctx.getSharedPreferences(WidgetPlugin.PREFS, Context.MODE_PRIVATE); }

    static int quanti(Context ctx) {
        return AppWidgetManager.getInstance(ctx).getAppWidgetIds(new ComponentName(ctx, NotturnistiWidget.class)).length;
    }

    static void aggiornaTutti(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, NotturnistiWidget.class));
        if (ids.length > 0) disegna(ctx, mgr, ids);
    }

    // Altezza disponibile in dp (in verticale conta la massima).
    static int altezza(AppWidgetManager mgr, int id) {
        Bundle o = mgr.getAppWidgetOptions(id);
        return o == null ? 110 : Math.max(o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT), o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT));
    }

    // Una risposta dal widget: si tiene qui finché l'app non la prende (WidgetPlugin.risposte), così vale anche ad app chiusa.
    static void salvaRisposta(Context ctx, Intent i) {
        String d = i.getStringExtra("d"); if (d == null) return;
        try {
            SharedPreferences sp = prefs(ctx);
            JSONObject tutte = new JSONObject(sp.getString(KEY_RISPOSTE, "{}"));
            JSONObject r = tutte.optJSONObject(d); if (r == null) r = new JSONObject();
            if ("sonno".equals(i.getStringExtra("cosa"))) { r.put("sonno", true); r.put("bed", i.getStringExtra("bed")); r.put("wake", i.getStringExtra("wake")); }
            else { r.put("voto", i.getIntExtra("v", 3)); r.put("at", System.currentTimeMillis()); }
            tutte.put(d, r);
            sp.edit().putString(KEY_RISPOSTE, tutte.toString()).apply();
        } catch (Exception ignored) { }
    }

    // Tocco sul nome della persona: la successiva, poi nascosta, poi la prima.
    static void cambiaPersona(Context ctx, int id) {
        try {
            SharedPreferences sp = prefs(ctx);
            CalendarioModel m = CalendarioModel.leggi(new JSONObject(sp.getString(WidgetPlugin.KEY, "{}")).optJSONObject("mese"));
            if (m == null) return;
            int attiva = m.personaAttiva(sp.getInt("pers_" + id, CalendarioModel.SEGUI_STELLA), sp.getString("star_" + id, ""));
            sp.edit().putInt("pers_" + id, m.dopo(attiva)).putString("star_" + id, m.stella).apply();
        } catch (Exception ignored) { }
    }

    // ‹ › e titolo del calendario: lo spostamento (in settimane da oggi) vale per questo giorno; domani si riparte da oggi.
    static void vaiAPagina(Context ctx, int id, int spostamento) {
        prefs(ctx).edit().putInt("off_" + id, spostamento).putString("offd_" + id, CalendarioWidget.giornoIso(System.currentTimeMillis())).apply();
    }

    static int icona(String k) {
        switch (k == null ? "" : k) {
            case "sonno": return R.drawable.ic_w_sonno;
            case "pisolino": return R.drawable.ic_w_pisolino;
            case "turno": return R.drawable.ic_w_turno;
            case "caffe": return R.drawable.ic_w_caffe;
            case "luce": return R.drawable.ic_w_luce;
            case "rientro": return R.drawable.ic_w_rientro;
            default: return R.drawable.ic_w_libero;
        }
    }

    static PendingIntent risposta(Context ctx, int codice, JSONObject dia, String cosa, int v) {
        Intent i = new Intent(ctx, NotturnistiWidget.class).setAction(AZIONE_DIARIO)
            .putExtra("d", dia.optString("d")).putExtra("cosa", cosa).putExtra("v", v)
            .putExtra("bed", dia.optString("bed")).putExtra("wake", dia.optString("wake"));
        return trasmetti(ctx, codice, i);
    }

    static PendingIntent apriGiorno(Context ctx, int codice, String iso) {
        Intent ap = new Intent(Intent.ACTION_VIEW, Uri.parse("notturnisti://giorno/" + iso), ctx, MainActivity.class);
        ap.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return attivita(ctx, codice, ap);
    }

    /** Le viste del widget per questo stato e questa altezza (in dp). Senza effetti: si può provare a parte. */
    static RemoteViews costruisci(Context ctx, WidgetStato st, CalendarioModel cal, int altezzaDp, long ora, int persona, int idWidget, int spostamento) {
        RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.widget_piano);
        int righeCal = CalendarioWidget.righeDisponibili(cal, ora);
        WidgetPiano p = WidgetPiano.calcola(altezzaDp, st.progresso >= 0, st.azione != WidgetStato.Azione.NESSUNA, st.eventi.size(), persona >= 0, righeCal);

        // ───── adesso ─────
        rv.setTextViewText(R.id.w_etichetta, st.etichetta);
        rv.setTextViewText(R.id.w_adesso, st.titolo);
        rv.setTextViewText(R.id.w_sotto, st.sotto);
        rv.setImageViewResource(R.id.w_icona, icona(st.icona));
        rv.setContentDescription(android.R.id.background, st.etichetta + ": " + st.titolo + ", " + st.sotto);
        rv.setViewVisibility(R.id.w_progresso, p.barra ? View.VISIBLE : View.GONE);
        if (p.barra) rv.setProgressBar(R.id.w_progresso, 1000, st.progresso, false);
        PendingIntent apri = attivita(ctx, 0, new Intent(ctx, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP));
        rv.setOnClickPendingIntent(android.R.id.background, apri);

        // ───── il pulsante del momento ─────
        rv.setViewVisibility(R.id.w_azione, p.pulsante ? View.VISIBLE : View.GONE);
        if (p.pulsante) azione(ctx, rv, st);

        // ───── le prossime voci ─────
        rv.setViewVisibility(R.id.w_eventi, p.voci > 0 ? View.VISIBLE : View.GONE);
        int[][] riga = { { R.id.w_e1, R.id.w_e1_ic, R.id.w_e1_ora, R.id.w_e1_t, R.id.w_e1_chip }, { R.id.w_e2, R.id.w_e2_ic, R.id.w_e2_ora, R.id.w_e2_t, R.id.w_e2_chip } };
        for (int i = 0; i < 2; i++) {
            rv.setViewVisibility(riga[i][0], i < p.voci ? View.VISIBLE : View.GONE);
            if (i >= p.voci) continue;
            WidgetStato.Evento e = st.eventi.get(i);
            rv.setImageViewResource(riga[i][1], icona(e.icona));
            rv.setTextViewText(riga[i][2], e.ora);
            rv.setTextViewText(riga[i][3], e.titolo);
            rv.setViewVisibility(riga[i][4], e.chip.isEmpty() ? View.GONE : View.VISIBLE);
            rv.setTextViewText(riga[i][4], e.chip);
        }

        // ───── calendario ─────
        if (p.calendario) CalendarioWidget.riempi(ctx, rv, cal, p.righe, persona, ora, idWidget, spostamento);
        else rv.setViewVisibility(R.id.w_cal, View.GONE);
        return rv;
    }

    private static final String[] ENERGIA = { "Senza energie", "Poca energia", "Così così", "Bene", "Al meglio" };

    private static void azione(Context ctx, RemoteViews rv, WidgetStato st) {
        boolean sonno = st.azione == WidgetStato.Azione.VOTO_SONNO, energia = st.azione == WidgetStato.Azione.VOTO_ENERGIA;
        rv.setViewVisibility(R.id.w_voto, sonno ? View.VISIBLE : View.GONE);
        rv.setViewVisibility(R.id.w_facce, energia ? View.VISIBLE : View.GONE);
        rv.setViewVisibility(R.id.w_az, sonno || energia ? View.GONE : View.VISIBLE);
        if (!sonno && !energia) {
            rv.setTextViewText(R.id.w_az, st.testoAzione);
            boolean pieno = st.azione == WidgetStato.Azione.SVEGLIA;
            rv.setInt(R.id.w_az, "setBackgroundResource", pieno ? R.drawable.widget_bottone_pri : R.drawable.widget_bottone);
            rv.setTextColor(R.id.w_az, ctx.getColor(pieno ? R.color.w_su_accento : R.color.w_ink));
            if (pieno) {
                Intent al = new Intent(AlarmClock.ACTION_SET_ALARM)
                    .putExtra(AlarmClock.EXTRA_HOUR, st.oraSveglia).putExtra(AlarmClock.EXTRA_MINUTES, st.minSveglia)
                    .putExtra(AlarmClock.EXTRA_MESSAGE, "Notturnisti").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                rv.setOnClickPendingIntent(R.id.w_az, attivita(ctx, 205, al));
            } else rv.setOnClickPendingIntent(R.id.w_az, apriGiorno(ctx, 206, st.giornoAzione));
            return;
        }
        JSONObject dia = st.diario;
        if (energia) {
            // le stesse cinque facce dell'app: dal widget si può dare anche il voto più basso e il più alto
            int[] f = { R.id.w_f1, R.id.w_f2, R.id.w_f3, R.id.w_f4, R.id.w_f5 };
            for (int i = 0; i < f.length; i++) {
                rv.setContentDescription(f[i], "Energie: " + ENERGIA[i]);
                rv.setOnClickPendingIntent(f[i], risposta(ctx, 210 + i, dia, "voto", i + 1));
            }
            return;
        }
        rv.setTextViewText(R.id.w_v1, "Sì, così");
        rv.setInt(R.id.w_v1, "setBackgroundResource", R.drawable.widget_bottone_pri);
        rv.setTextColor(R.id.w_v1, ctx.getColor(R.color.w_su_accento));
        rv.setOnClickPendingIntent(R.id.w_v1, risposta(ctx, 200, dia, "sonno", 0));
        rv.setTextViewText(R.id.w_v2, "Altri orari");
        rv.setInt(R.id.w_v2, "setBackgroundResource", R.drawable.widget_bottone);
        rv.setTextColor(R.id.w_v2, ctx.getColor(R.color.w_ink));
        rv.setOnClickPendingIntent(R.id.w_v2, apriGiorno(ctx, 201, dia.optString("d")));
    }

    static void disegna(Context ctx, AppWidgetManager mgr, int[] ids) {
        long ora = System.currentTimeMillis();
        SharedPreferences sp = prefs(ctx);
        WidgetStato st = new WidgetStato();
        CalendarioModel cal = null;
        try {
            String json = sp.getString(WidgetPlugin.KEY, null);
            if (json != null) {
                JSONObject radice = new JSONObject(json);
                st = WidgetStato.calcola(radice, new JSONObject(sp.getString(KEY_RISPOSTE, "{}")), ora);
                cal = CalendarioModel.leggi(radice.optJSONObject("mese"));
            }
        } catch (Exception ignored) { }

        long quando = st.rinfresco;
        if (st.prossimoCambio != Long.MAX_VALUE) quando = Math.min(quando, st.prossimoCambio + 1000);
        boolean haCalendario = false;
        for (int id : ids) {
            // la persona: la scelta di questo widget regge finché la stellina nell'app non cambia
            int persona = -1;
            if (cal != null) {
                String vista = sp.getString("star_" + id, "");
                persona = cal.personaAttiva(sp.getInt("pers_" + id, CalendarioModel.SEGUI_STELLA), vista);
                if (!cal.stella.equals(vista)) sp.edit().putString("star_" + id, cal.stella).putInt("pers_" + id, CalendarioModel.SEGUI_STELLA).apply();
            }
            int spostamento = CalendarioModel.spostamentoValido(sp.getInt("off_" + id, 0), sp.getString("offd_" + id, ""), CalendarioWidget.giornoIso(ora));
            int h = altezza(mgr, id);
            mgr.updateAppWidget(id, costruisci(ctx, st, cal, h, ora, persona, id, spostamento));
            if (cal != null && WidgetPiano.calcola(h, st.progresso >= 0, st.azione != WidgetStato.Azione.NESSUNA, st.eventi.size(), persona >= 0, CalendarioWidget.righeDisponibili(cal, ora)).calendario) haCalendario = true;
        }
        if (haCalendario) {   // a mezzanotte «oggi» cambia
            Calendar m = Calendar.getInstance(); m.add(Calendar.DAY_OF_YEAR, 1);
            m.set(Calendar.HOUR_OF_DAY, 0); m.set(Calendar.MINUTE, 1); m.set(Calendar.SECOND, 0);
            quando = Math.min(quando, m.getTimeInMillis());
        }

        // Prossimo ridisegno: al prossimo cambio, o prima se c'è un conto alla rovescia. Allarme inesatto e senza risveglio:
        // se il telefono dorme si aggiorna appena si accende lo schermo, che è quando il widget si guarda.
        if (quando != Long.MAX_VALUE) {
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            Intent tick = new Intent(ctx, NotturnistiWidget.class).setAction(AZIONE_TICK);
            PendingIntent tp = PendingIntent.getBroadcast(ctx, 1, tick, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
            if (am != null) am.set(AlarmManager.RTC, Math.max(quando, ora + 60_000), tp);
        }
    }
}
