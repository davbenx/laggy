package club.notturnisti.twa;

import android.os.Bundle;
import android.os.SystemClock;
import androidx.core.splashscreen.SplashScreen;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {
    /** La pagina ha finito il primo disegno (DevicePlugin.pronta): fino ad allora resta lo splash, mai oltre 2,5 secondi. */
    static volatile boolean paginaPronta = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Lo splash di sistema (logo sul colore della pagina) resta finché la pagina non ha disegnato: prima spariva
        // subito e si vedeva la pagina vuota riempirsi. Va installato prima di super.onCreate.
        paginaPronta = false;
        final long inizio = SystemClock.uptimeMillis();
        SplashScreen.installSplashScreen(this)
            .setKeepOnScreenCondition(() -> !paginaPronta && SystemClock.uptimeMillis() - inizio < 2500);
        // Plugin locali dell'app (non pacchetti npm): vanno registrati prima
        // di super.onCreate, che avvia il ponte con la pagina web.
        registerPlugin(WidgetPlugin.class);
        registerPlugin(PrintPlugin.class);
        registerPlugin(ReviewPlugin.class);
        registerPlugin(AlarmPlugin.class);
        registerPlugin(DevicePlugin.class);
        registerPlugin(SalutePlugin.class);
        super.onCreate(savedInstanceState);
        // Se Android chiude il motore della pagina (memoria scarsa, crash del
        // WebView), di default l'intera app si chiude di colpo. Qui invece si
        // ricrea l'attività: la pagina riparte e i dati, già salvati sul
        // telefono, restano.
        if (bridge != null) {
            bridge.addWebViewListener(new WebViewListener() {
                @Override
                public boolean onRenderProcessGone(WebView webView, RenderProcessGoneDetail detail) {
                    runOnUiThread(MainActivity.this::recreate);
                    return true;
                }
            });
        }
    }
}
