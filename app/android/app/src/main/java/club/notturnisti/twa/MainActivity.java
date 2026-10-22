package club.notturnisti.twa;

import android.os.Bundle;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin locali dell'app (non pacchetti npm): vanno registrati prima
        // di super.onCreate, che avvia il ponte con la pagina web.
        registerPlugin(WidgetPlugin.class);
        registerPlugin(PrintPlugin.class);
        registerPlugin(ReviewPlugin.class);
        registerPlugin(AlarmPlugin.class);
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
