package club.notturnisti.twa;

import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebView;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Stampa nel WebView: window.print() lì non fa nulla. Qui si passa la pagina
 * corrente al servizio di stampa di Android, che applica lo stesso
 * @media print del sito (si vede solo #printSheet) e offre anche
 * "Salva come PDF".
 */
@CapacitorPlugin(name = "NTPrint")
public class PrintPlugin extends Plugin {
    @PluginMethod
    public void print(PluginCall call) {
        String titolo = call.getString("title", "Notturnisti");
        getActivity().runOnUiThread(() -> {
            try {
                PrintManager pm = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                WebView wv = getBridge().getWebView();
                PrintDocumentAdapter a = wv.createPrintDocumentAdapter(titolo);
                pm.print(titolo, a, new PrintAttributes.Builder()
                    .setMediaSize(PrintAttributes.MediaSize.ISO_A4).build());
                call.resolve();
            } catch (Exception e) {
                call.reject("stampa non disponibile", e);
            }
        });
    }
}
