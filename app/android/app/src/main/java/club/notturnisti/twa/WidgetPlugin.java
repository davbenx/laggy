package club.notturnisti.twa;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Ponte minimo pagina → widget: la pagina (platform.js, widget.publish)
 * passa la timeline delle prossime ore già calcolata dal motore JS; qui la
 * si salva e si chiede ad Android di ridisegnare i widget. Nessun calcolo
 * qui: il motore resta uno solo, in engine.js.
 */
@CapacitorPlugin(name = "NTWidget")
public class WidgetPlugin extends Plugin {
    static final String PREFS = "nt_widget";
    static final String KEY = "timeline";

    @PluginMethod
    public void publish(PluginCall call) {
        String json = call.getString("json");
        if (json == null) { call.reject("json mancante"); return; }
        Context ctx = getContext();
        SharedPreferences.Editor ed = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit();
        ed.putString(KEY, json).apply();
        NotturnistiWidget.aggiornaTutti(ctx);
        JSObject r = new JSObject();
        r.put("widgets", NotturnistiWidget.quanti(ctx));
        call.resolve(r);
    }
}
