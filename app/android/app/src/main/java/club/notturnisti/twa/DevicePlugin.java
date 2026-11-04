package club.notturnisti.twa;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.view.HapticFeedbackConstants;
import android.view.View;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * Un'impronta del telefono (8 byte di un hash di ANDROID_ID e del nome dell'app), non
 * l'identificativo vero. Serve solo alla pagina per accorgersi che i dati arrivano da
 * un altro telefono (backup di Android, trasloco) e far riattivare calendario e widget.
 * Resta sul telefono: non si invia a nessuno.
 */
@CapacitorPlugin(name = "NTDispositivo")
public class DevicePlugin extends Plugin {
    @PluginMethod
    public void id(PluginCall call) {
        try {
            String a = Settings.Secure.getString(getContext().getContentResolver(), Settings.Secure.ANDROID_ID);
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] h = md.digest((a + "|" + getContext().getPackageName()).getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 8; i++) sb.append(String.format("%02x", h[i]));
            JSObject r = new JSObject();
            r.put("id", sb.toString());
            call.resolve(r);
        } catch (Exception e) {
            call.reject("impronta non disponibile", e);
        }
    }

    /**
     * Il «tocco» di sistema (feedback aptico), come nelle app native: segue le impostazioni del telefono (se l'aptica è
     * spenta non vibra) e non chiede permessi, a differenza della vibrazione. «conferma» per un salvataggio, «scelta» per
     * un chip o un interruttore.
     */
    @PluginMethod
    public void tocco(PluginCall call) {
        String tipo = call.getString("tipo", "scelta");
        getActivity().runOnUiThread(() -> {
            try {
                View v = getBridge().getWebView();
                int k = "conferma".equals(tipo)
                        ? (Build.VERSION.SDK_INT >= 30 ? HapticFeedbackConstants.CONFIRM : HapticFeedbackConstants.VIRTUAL_KEY)
                        : (Build.VERSION.SDK_INT >= 27 ? HapticFeedbackConstants.KEYBOARD_TAP : HapticFeedbackConstants.VIRTUAL_KEY);
                v.performHapticFeedback(k);
            } catch (Exception e) { /* niente aptica: nessun problema */ }
            call.resolve();
        });
    }

    /** La pagina ha disegnato la prima volta: lo splash di sistema può andare via (vedi MainActivity). */
    @PluginMethod
    public void pronta(PluginCall call) {
        MainActivity.paginaPronta = true;
        call.resolve();
    }

    /** Le impostazioni di questa app (permessi compresi): dopo un permesso negato Android non lo richiede più. */
    @PluginMethod
    public void apriImpostazioni(PluginCall call) {
        try {
            Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject("impostazioni non disponibili", e);
        }
    }
}
