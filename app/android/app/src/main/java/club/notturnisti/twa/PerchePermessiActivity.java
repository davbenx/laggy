package club.notturnisti.twa;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

/** Health Connect chiede «perché questa app vuole questi dati?»: si apre l'informativa privacy (sezione Health Connect). */
public class PerchePermessiActivity extends Activity {
    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("https://app.notturnisti.club/privacy/#health-connect"))); } catch (Exception e) { /* nessun browser */ }
        finish();
    }
}
