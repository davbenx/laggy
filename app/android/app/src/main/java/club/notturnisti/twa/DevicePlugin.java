package club.notturnisti.twa;

import android.provider.Settings;
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
}
