package club.notturnisti.twa;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;
import java.util.Calendar;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Widget "Il tuo piano": cosa vale adesso (o la prossima cosa importante,
 * con il conto alla rovescia), il prossimo turno anche se è fra giorni, la
 * voce successiva e, se il widget è alto abbastanza, la settimana. La
 * mattina, dalla sveglia per 14 ore, al posto delle righe il diario: «Come
 * hai dormito?» e «Come ti senti?», a un tocco; le risposte restano qui
 * finché l'app non le prende (WidgetPlugin.risposte).
 *
 * La timeline arriva già calcolata dalla pagina (WidgetPlugin) come elenco
 * di voci {s: inizio ms, e: fine ms, t: titolo, k: tipo} e, per la
 * settimana, {d, g, c, t, s}. Qui si sceglie solo cosa mostrare in base
 * all'ora e alla dimensione, e si programma il prossimo ridisegno: al
 * prossimo cambio, oppure fra pochi minuti se c'è un conto alla rovescia
 * da tenere aggiornato. Se l'app non viene aperta per giorni la timeline si
 * esaurisce e il widget lo dice, invece di mostrare dati vecchi.
 */
public class NotturnistiWidget extends AppWidgetProvider {
    static final String AZIONE_TICK = "club.notturnisti.twa.WIDGET_TICK";
    static final String AZIONE_DIARIO = "club.notturnisti.twa.WIDGET_DIARIO";
    static final String KEY_RISPOSTE = "risposte";

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        disegna(ctx, mgr, ids);
    }

    // Ridimensionato dall'utente: le sezioni compaiono o spariscono.
    @Override
    public void onAppWidgetOptionsChanged(Context ctx, AppWidgetManager mgr, int id, Bundle opzioni) {
        disegna(ctx, mgr, new int[]{ id });
    }

    @Override
    public void onReceive(Context ctx, Intent intent) {
        super.onReceive(ctx, intent);
        if (AZIONE_TICK.equals(intent.getAction())) aggiornaTutti(ctx);
        if (AZIONE_DIARIO.equals(intent.getAction())) { salvaRisposta(ctx, intent); aggiornaTutti(ctx); }
    }

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

    static final int[][] CELLE = {
        { R.id.w_g0, R.id.w_g0_d, R.id.w_g0_c, R.id.w_g0_s }, { R.id.w_g1, R.id.w_g1_d, R.id.w_g1_c, R.id.w_g1_s },
        { R.id.w_g2, R.id.w_g2_d, R.id.w_g2_c, R.id.w_g2_s }, { R.id.w_g3, R.id.w_g3_d, R.id.w_g3_c, R.id.w_g3_s },
        { R.id.w_g4, R.id.w_g4_d, R.id.w_g4_c, R.id.w_g4_s }, { R.id.w_g5, R.id.w_g5_d, R.id.w_g5_c, R.id.w_g5_s },
        { R.id.w_g6, R.id.w_g6_d, R.id.w_g6_c, R.id.w_g6_s } };

    // Icona per tipo di voce (campo "k", lo stesso "tipo" degli eventi del calendario).
    static int icona(String k) {
        if (k == null) return R.drawable.ic_w_libero;
        if (k.startsWith("sonno")) return R.drawable.ic_w_sonno;
        if (k.startsWith("pisolino")) return R.drawable.ic_w_pisolino;
        if (k.startsWith("turno")) return R.drawable.ic_w_turno;
        if (k.startsWith("caffe")) return R.drawable.ic_w_caffe;
        if (k.startsWith("luce")) return R.drawable.ic_w_luce;
        if (k.startsWith("rientro")) return R.drawable.ic_w_rientro;
        return R.drawable.ic_w_libero;
    }

    private static String hhmm(long t, long ora) {
        Calendar c = Calendar.getInstance(); c.setTimeInMillis(t);
        Calendar n = Calendar.getInstance(); n.setTimeInMillis(ora);
        String h = String.format(Locale.ITALY, "%02d:%02d", c.get(Calendar.HOUR_OF_DAY), c.get(Calendar.MINUTE));
        boolean domani = c.get(Calendar.DAY_OF_YEAR) != n.get(Calendar.DAY_OF_YEAR) || c.get(Calendar.YEAR) != n.get(Calendar.YEAR);
        return domani ? "domani " + h : h;
    }

    // Una risposta dal widget: si tiene qui finché l'app non la prende
    // (WidgetPlugin.risposte), così vale anche ad app chiusa.
    static void salvaRisposta(Context ctx, Intent i) {
        String d = i.getStringExtra("d"); if (d == null) return;
        try {
            android.content.SharedPreferences sp = ctx.getSharedPreferences(WidgetPlugin.PREFS, Context.MODE_PRIVATE);
            JSONObject tutte = new JSONObject(sp.getString(KEY_RISPOSTE, "{}"));
            JSONObject r = tutte.optJSONObject(d); if (r == null) r = new JSONObject();
            if ("sonno".equals(i.getStringExtra("cosa"))) { r.put("sonno", true); r.put("bed", i.getStringExtra("bed")); r.put("wake", i.getStringExtra("wake")); }
            else { r.put("voto", i.getIntExtra("v", 3)); r.put("at", System.currentTimeMillis()); }
            tutte.put(d, r);
            sp.edit().putString(KEY_RISPOSTE, tutte.toString()).apply();
        } catch (Exception ignored) { }
    }

    static PendingIntent risposta(Context ctx, int codice, JSONObject dia, String cosa, int v) {
        Intent i = new Intent(ctx, NotturnistiWidget.class).setAction(AZIONE_DIARIO)
            .putExtra("d", dia.optString("d")).putExtra("cosa", cosa).putExtra("v", v)
            .putExtra("bed", dia.optString("bed")).putExtra("wake", dia.optString("wake"));
        return PendingIntent.getBroadcast(ctx, codice, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    // Le voci che contano: turno, sonno, pisolino, rientro. Luce e caffè sono
    // promemoria brevi e non devono mai nascondere il turno o il sonno.
    static boolean importante(String k) {
        return k != null && (k.startsWith("turno") || k.startsWith("sonno") || k.startsWith("pisolino") || k.startsWith("rientro"));
    }

    // "21:00", "domani 21:00", "gio 23 21:00"
    private static String quando(long t, long ora) {
        Calendar c = Calendar.getInstance(); c.setTimeInMillis(t);
        Calendar n = Calendar.getInstance(); n.setTimeInMillis(ora);
        String h = String.format(Locale.ITALY, "%02d:%02d", c.get(Calendar.HOUR_OF_DAY), c.get(Calendar.MINUTE));
        Calendar dom = (Calendar) n.clone(); dom.add(Calendar.DAY_OF_YEAR, 1);
        if (c.get(Calendar.YEAR) == n.get(Calendar.YEAR) && c.get(Calendar.DAY_OF_YEAR) == n.get(Calendar.DAY_OF_YEAR)) return h;
        if (c.get(Calendar.YEAR) == dom.get(Calendar.YEAR) && c.get(Calendar.DAY_OF_YEAR) == dom.get(Calendar.DAY_OF_YEAR)) return "domani " + h;
        String[] gg = { "dom", "lun", "mar", "mer", "gio", "ven", "sab" };
        return gg[c.get(Calendar.DAY_OF_WEEK) - 1] + " " + c.get(Calendar.DAY_OF_MONTH) + " " + h;
    }

    // "2 h 10 min", "45 min", "1 h"
    private static String durata(long ms) {
        long m = Math.max(1, Math.round(ms / 60000.0));
        if (m < 60) return m + " min";
        long h = m / 60, r = m % 60;
        return r == 0 ? h + " h" : h + " h " + r + " min";
    }

    static void disegna(Context ctx, AppWidgetManager mgr, int[] ids) {
        long ora = System.currentTimeMillis();
        String etichetta = "Notturnisti", adesso = "Apri Notturnisti", sotto = "per vedere qui il tuo piano";
        int icona = R.drawable.ic_w_libero, progresso = -1;
        String[] pOra = { "", "" }, pT = { "", "" };
        int[] pIc = { 0, 0 };
        long prossimoCambio = Long.MAX_VALUE, rinfresco = Long.MAX_VALUE;
        JSONArray giorni = null;
        JSONObject dia = null;      // la domanda del diario, se è il momento
        String fase = null;         // "sonno" | "voto"
        try {
            android.content.SharedPreferences sp = ctx.getSharedPreferences(WidgetPlugin.PREFS, Context.MODE_PRIVATE);
            String json = sp.getString(WidgetPlugin.KEY, null);
            if (json != null) {
                JSONObject radice = new JSONObject(json);
                giorni = radice.optJSONArray("giorni");
                JSONArray v = radice.getJSONArray("voci");
                JSONObject turno = radice.optJSONObject("turno");
                if (turno != null && turno.optLong("e") <= ora) turno = null;
                // la voce in corso (la più importante, se ce n'è più d'una) e la prossima importante
                JSONObject corrente = null, primo = null;
                for (int i = 0; i < v.length(); i++) {
                    JSONObject x = v.getJSONObject(i);
                    long s = x.getLong("s"), e = x.getLong("e");
                    if (s > ora && s < prossimoCambio) prossimoCambio = s;
                    if (e > ora && e < prossimoCambio) prossimoCambio = e;
                    String k = x.optString("k", null);
                    if (s <= ora && e > ora && (corrente == null || (!importante(corrente.optString("k", null)) && importante(k)))) corrente = x;
                    if (s > ora && primo == null && importante(k)) primo = x;
                }
                if (corrente == null && primo == null) for (int i = 0; i < v.length(); i++) { JSONObject x = v.getJSONObject(i); if (x.getLong("s") > ora) { primo = x; break; } }
                JSONObject eroe = corrente != null ? corrente : primo;
                if (corrente != null) {
                    long s = corrente.getLong("s"), e = corrente.getLong("e");
                    etichetta = "Adesso";
                    adesso = corrente.getString("t");
                    sotto = "fino alle " + hhmm(e, ora) + " · ancora " + durata(e - ora);
                    // in turno: quando smettere con il caffè, se cade prima della fine
                    if (corrente.optString("k", "").startsWith("turno")) for (int i = 0; i < v.length(); i++) {
                        JSONObject x = v.getJSONObject(i);
                        if (x.optString("k", "").startsWith("caffe") && x.getLong("s") > ora && x.getLong("s") < e) { sotto = "fino alle " + hhmm(e, ora) + " · caffè entro le " + hhmm(x.getLong("s"), ora); break; }
                    }
                    icona = icona(corrente.optString("k", null));
                    progresso = (int) Math.max(0, Math.min(1000, (ora - s) * 1000 / Math.max(1, e - s)));
                    rinfresco = ora + 5 * 60_000;
                } else if (primo != null) {
                    long s = primo.getLong("s");
                    // Mai "nessun impegno": la prossima cosa, con quanto manca.
                    etichetta = "Prossimo";
                    adesso = primo.getString("t");
                    sotto = "alle " + hhmm(s, ora) + " · tra " + durata(s - ora);
                    if (primo.optString("k", "").startsWith("sonno")) sotto = "alle " + hhmm(s, ora) + " · sveglia " + hhmm(primo.getLong("e"), ora);
                    icona = icona(primo.optString("k", null));
                    rinfresco = ora + (s - ora < 3_600_000 ? 60_000 : 5 * 60_000);
                } else {
                    etichetta = "Notturnisti";
                    adesso = "Piano da aggiornare";
                    sotto = "apri l'app per i prossimi giorni";
                }
                // Le righe sotto: prima il prossimo turno (sempre, anche fra giorni),
                // poi le voci in arrivo che non sono già in alto.
                int n = 0;
                boolean turnoInAlto = eroe != null && turno != null && eroe.optString("k", "").startsWith("turno") && eroe.getLong("s") == turno.getLong("s");
                if (turno != null && !turnoInAlto) {
                    pOra[n] = quando(turno.getLong("s"), ora); pT[n] = turno.optString("t", "Turno"); pIc[n] = R.drawable.ic_w_turno; n++;
                }
                for (int i = 0; i < v.length() && n < 2; i++) {
                    JSONObject x = v.getJSONObject(i);
                    long s = x.getLong("s"); String k = x.optString("k", "");
                    if (s <= ora || x == eroe || k.startsWith("turno")) continue;
                    if (corrente != null && corrente.optString("k", "").startsWith("turno") && k.startsWith("caffe") && s < corrente.getLong("e")) continue;
                    pOra[n] = hhmm(s, ora);
                    pT[n] = k.startsWith("sonno") ? x.getString("t") + " · sveglia " + hhmm(x.getLong("e"), ora) : x.getString("t");
                    pIc[n] = icona(k); n++;
                }
                // Diario: dalla sveglia per 14 ore, finché non c'è risposta (nell'app o qui).
                JSONObject d = radice.optJSONObject("diario");
                // la domanda compare da sola all'ora della sveglia
                if (d != null && d.optLong("da") > ora && d.optLong("da") < prossimoCambio) prossimoCambio = d.optLong("da");
                if (d != null && ora >= d.optLong("da") && ora < d.optLong("a")) {
                    JSONObject r = new JSONObject(sp.getString(KEY_RISPOSTE, "{}")).optJSONObject(d.optString("d"));
                    boolean sonno = d.optBoolean("sonno") || (r != null && r.optBoolean("sonno"));
                    boolean voto = d.optBoolean("voto") || (r != null && r.has("voto"));
                    if (!sonno) fase = "sonno"; else if (!voto) fase = "voto";
                    if (fase != null) { dia = d; long a = d.optLong("a"); if (a < prossimoCambio) prossimoCambio = a; }
                }
            }
        } catch (Exception ignored) { }

        Intent apri = new Intent(ctx, MainActivity.class);
        apri.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, 0, apri, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        String oggiIso = String.format(Locale.ROOT, "%1$tY-%1$tm-%1$td", Calendar.getInstance());

        for (int id : ids) {
            int h = altezza(mgr, id);
            RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.widget_piano);
            rv.setTextViewText(R.id.w_etichetta, etichetta);
            rv.setTextViewText(R.id.w_adesso, adesso);
            rv.setTextViewText(R.id.w_sotto, sotto);
            rv.setImageViewResource(R.id.w_icona, icona);
            rv.setContentDescription(android.R.id.background, etichetta + ": " + adesso + ", " + sotto);
            if (progresso >= 0) { rv.setViewVisibility(R.id.w_progresso, View.VISIBLE); rv.setProgressBar(R.id.w_progresso, 1000, progresso, false); }
            else rv.setViewVisibility(R.id.w_progresso, View.GONE);

            // Le prossime due: da 2 righe in su (sotto i 100 dp resta solo "adesso").
            int[][] righe = { { R.id.w_p1, R.id.w_p1_ic, R.id.w_p1_ora, R.id.w_p1_t }, { R.id.w_p2, R.id.w_p2_ic, R.id.w_p2_ora, R.id.w_p2_t } };
            for (int i = 0; i < 2; i++) {
                boolean c = h >= 100 && !pT[i].isEmpty() && (i == 0 || h >= 130 || progresso < 0);
                rv.setViewVisibility(righe[i][0], c ? View.VISIBLE : View.GONE);
                if (c) {
                    rv.setImageViewResource(righe[i][1], pIc[i]);
                    rv.setTextViewText(righe[i][2], pOra[i]);
                    rv.setTextViewText(righe[i][3], pT[i]);
                }
            }
            rv.setOnClickPendingIntent(android.R.id.background, pi);

            // Diario: sostituisce le righe sotto (stessa altezza del widget).
            boolean diario = dia != null && h >= 100;
            rv.setViewVisibility(R.id.w_diario, diario ? View.VISIBLE : View.GONE);
            if (diario) {
                rv.setViewVisibility(R.id.w_progresso, View.GONE);
                rv.setViewVisibility(R.id.w_p1, View.GONE); rv.setViewVisibility(R.id.w_p2, View.GONE);
                rv.setImageViewResource(R.id.w_icona, R.drawable.ic_w_sonno);
                if ("sonno".equals(fase)) {
                    rv.setTextViewText(R.id.w_etichetta, "Come hai dormito?");
                    rv.setTextViewText(R.id.w_adesso, dia.optString("bed") + " → " + dia.optString("wake"));
                    rv.setTextViewText(R.id.w_sotto, "è andata così?");
                    rv.setTextViewText(R.id.w_db1, "Sì, così");
                    rv.setTextViewText(R.id.w_db2, "Altri orari");
                    rv.setViewVisibility(R.id.w_db3, View.GONE);
                    rv.setInt(R.id.w_db1, "setBackgroundResource", R.drawable.widget_bottone_pri);
                    rv.setTextColor(R.id.w_db1, ctx.getResources().getColor(R.color.w_su_accento, null));
                    rv.setOnClickPendingIntent(R.id.w_db1, risposta(ctx, 200, dia, "sonno", 0));
                    Intent ap = new Intent(Intent.ACTION_VIEW, Uri.parse("notturnisti://giorno/" + dia.optString("d")), ctx, MainActivity.class);
                    ap.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                    rv.setOnClickPendingIntent(R.id.w_db2, PendingIntent.getActivity(ctx, 201, ap, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
                    rv.setContentDescription(android.R.id.background, "Come hai dormito? " + dia.optString("bed") + " - " + dia.optString("wake"));
                } else {
                    rv.setTextViewText(R.id.w_etichetta, "Come ti senti?");
                    rv.setTextViewText(R.id.w_adesso, "La tua energia oggi");
                    rv.setTextViewText(R.id.w_sotto, "un tocco, resta nel diario");
                    rv.setTextViewText(R.id.w_db1, "Poca");
                    rv.setTextViewText(R.id.w_db2, "Così così");
                    rv.setTextViewText(R.id.w_db3, "Bene");
                    rv.setViewVisibility(R.id.w_db3, View.VISIBLE);
                    rv.setInt(R.id.w_db1, "setBackgroundResource", R.drawable.widget_bottone);
                    rv.setTextColor(R.id.w_db1, ctx.getResources().getColor(R.color.w_ink, null));
                    rv.setOnClickPendingIntent(R.id.w_db1, risposta(ctx, 202, dia, "voto", 2));
                    rv.setOnClickPendingIntent(R.id.w_db2, risposta(ctx, 203, dia, "voto", 3));
                    rv.setOnClickPendingIntent(R.id.w_db3, risposta(ctx, 204, dia, "voto", 4));
                    rv.setContentDescription(android.R.id.background, "Come ti senti? Energia di oggi");
                }
            }

            boolean sett = giorni != null && giorni.length() > 0 && h >= 160;
            rv.setViewVisibility(R.id.w_settimana, sett ? View.VISIBLE : View.GONE);
            if (sett) {
                for (int i = 0; i < CELLE.length; i++) {
                    JSONObject g = giorni.optJSONObject(i);
                    if (g == null) { rv.setViewVisibility(CELLE[i][0], View.INVISIBLE); continue; }
                    rv.setViewVisibility(CELLE[i][0], View.VISIBLE);
                    boolean oggi = oggiIso.equals(g.optString("d"));
                    rv.setInt(CELLE[i][0], "setBackgroundResource", oggi ? R.drawable.widget_cella_oggi : 0);
                    rv.setTextViewText(CELLE[i][1], g.optString("g"));
                    rv.setTextViewText(CELLE[i][2], g.optString("c"));
                    rv.setTextViewText(CELLE[i][3], g.optString("s"));
                    String tipo = g.optString("t");
                    rv.setInt(CELLE[i][2], "setBackgroundResource", "notte".equals(tipo) ? R.drawable.widget_cella_notte
                        : "lavoro".equals(tipo) ? R.drawable.widget_cella_lavoro : R.drawable.widget_cella_riposo);
                    // Un tocco sul giorno apre l'app su quel giorno (notturnisti://giorno/AAAA-MM-GG).
                    Intent gi = new Intent(Intent.ACTION_VIEW, Uri.parse("notturnisti://giorno/" + g.optString("d")), ctx, MainActivity.class);
                    gi.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                    rv.setOnClickPendingIntent(CELLE[i][0], PendingIntent.getActivity(ctx, 100 + i, gi, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
                }
            }
            mgr.updateAppWidget(id, rv);
        }

        // Prossimo ridisegno: al prossimo cambio, o prima se c'è un conto alla
        // rovescia. Allarme inesatto e senza risveglio: se il telefono dorme si
        // aggiorna appena si accende lo schermo, che è quando il widget si
        // guarda. Nessun permesso speciale, consumo trascurabile.
        long quando = Math.min(prossimoCambio == Long.MAX_VALUE ? Long.MAX_VALUE : prossimoCambio + 1000, rinfresco);
        if (quando != Long.MAX_VALUE) {
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            Intent tick = new Intent(ctx, NotturnistiWidget.class).setAction(AZIONE_TICK);
            PendingIntent tp = PendingIntent.getBroadcast(ctx, 1, tick, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
            if (am != null) am.set(AlarmManager.RTC, Math.max(quando, ora + 60_000), tp);
        }
    }
}
