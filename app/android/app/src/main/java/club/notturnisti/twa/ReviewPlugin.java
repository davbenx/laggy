package club.notturnisti.twa;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.play.core.review.ReviewInfo;
import com.google.android.play.core.review.ReviewManager;
import com.google.android.play.core.review.ReviewManagerFactory;

/**
 * Recensione dentro l'app (Play In-App Review): il riquadro delle stelle
 * di Google Play, senza uscire dall'app. Google decide da sé se mostrarlo
 * (quota per utente) e non dice mai se è comparso o cosa ha votato la
 * persona: per questo la chiamata si risolve sempre, e la pagina non deve
 * mai far dipendere qualcosa dall'esito.
 */
@CapacitorPlugin(name = "NTReview")
public class ReviewPlugin extends Plugin {
    @PluginMethod
    public void request(PluginCall call) {
        ReviewManager rm = ReviewManagerFactory.create(getContext());
        rm.requestReviewFlow().addOnCompleteListener(t -> {
            if (!t.isSuccessful() || getActivity() == null) { call.resolve(); return; }
            ReviewInfo info = t.getResult();
            rm.launchReviewFlow(getActivity(), info).addOnCompleteListener(x -> call.resolve());
        });
    }
}
