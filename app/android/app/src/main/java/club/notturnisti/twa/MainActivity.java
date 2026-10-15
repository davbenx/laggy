package club.notturnisti.twa;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin locali dell'app (non pacchetti npm): vanno registrati prima
        // di super.onCreate, che avvia il ponte con la pagina web.
        registerPlugin(WidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
