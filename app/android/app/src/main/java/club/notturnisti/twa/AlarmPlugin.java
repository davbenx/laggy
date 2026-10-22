package club.notturnisti.twa;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.provider.AlarmClock;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Sveglia vera, nell'app Orologio del telefono (AlarmClock.ACTION_SET_ALARM):
 * suona anche ad app chiusa, con il volume e lo snooze che la persona conosce
 * già. Niente allarmi esatti nostri (permesso e regole di Play a parte): la
 * sveglia la tiene l'Orologio. Senza giorni, l'Orologio la mette alla prossima
 * volta che arriva quell'ora, quindi la pagina la propone solo entro 24 ore.
 */
@CapacitorPlugin(name = "NTAlarm")
public class AlarmPlugin extends Plugin {
    @PluginMethod
    public void set(PluginCall call) {
        Integer ora = call.getInt("hour"), min = call.getInt("minutes");
        if (ora == null || min == null) { call.reject("orario mancante"); return; }
        Intent i = new Intent(AlarmClock.ACTION_SET_ALARM)
            .putExtra(AlarmClock.EXTRA_HOUR, ora)
            .putExtra(AlarmClock.EXTRA_MINUTES, min)
            .putExtra(AlarmClock.EXTRA_MESSAGE, call.getString("message", "Notturnisti"))
            .putExtra(AlarmClock.EXTRA_SKIP_UI, true)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getActivity().startActivity(i);
            call.resolve();
        } catch (ActivityNotFoundException e) {
            call.reject("nessuna app Orologio", e);
        }
    }
}
