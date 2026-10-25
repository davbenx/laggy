package club.notturnisti.twa;

import android.app.Activity;
import android.app.TimePickerDialog;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.TextView;

/**
 * La finestra «Come hai dormito?» del widget: due orari (letto, sveglia) già sul piano da correggere con ±30 minuti o
 * con il selettore, senza entrare nell'app. Salva come le altre risposte del widget (la pagina le prende alla prossima
 * apertura) e dice se gli orari sono rimasti quelli del piano: in quel caso la notte non conta per la regolarità.
 * Il widget non può mostrare un selettore dell'ora: per questo una finestra a parte, trasparente, sopra la Home.
 */
public class OrariSonnoActivity extends Activity {
    private int letto, sveglia, pianoLetto, pianoSveglia;
    private String giorno;

    @Override
    protected void onCreate(Bundle stato) {
        super.onCreate(stato);
        Intent i = getIntent();
        giorno = i.getStringExtra("d");
        pianoLetto = OrariSonno.minuti(i.getStringExtra("bed"));
        pianoSveglia = OrariSonno.minuti(i.getStringExtra("wake"));
        if (giorno == null || pianoLetto < 0 || pianoSveglia < 0) { finish(); return; }
        setContentView(R.layout.orari_sonno);
        letto = stato != null ? stato.getInt("letto", pianoLetto) : pianoLetto;
        sveglia = stato != null ? stato.getInt("sveglia", pianoSveglia) : pianoSveglia;

        collega(R.id.o_letto, true, 0); collega(R.id.o_letto_m, true, -OrariSonno.PASSO); collega(R.id.o_letto_p, true, OrariSonno.PASSO);
        collega(R.id.o_sveglia, false, 0); collega(R.id.o_sveglia_m, false, -OrariSonno.PASSO); collega(R.id.o_sveglia_p, false, OrariSonno.PASSO);
        findViewById(R.id.o_prev).setOnClickListener(v -> salva(pianoLetto, pianoSveglia));
        findViewById(R.id.o_salva).setOnClickListener(v -> salva(letto, sveglia));
        findViewById(R.id.o_annulla).setOnClickListener(v -> finish());
        aggiorna();
    }

    @Override
    protected void onSaveInstanceState(Bundle fuori) {
        super.onSaveInstanceState(fuori);
        fuori.putInt("letto", letto); fuori.putInt("sveglia", sveglia);
    }

    /** delta 0: il tocco sull'orario apre il selettore; altrimenti sposta di quei minuti. */
    private void collega(int id, boolean èLetto, int delta) {
        findViewById(id).setOnClickListener(v -> {
            int attuale = èLetto ? letto : sveglia;
            if (delta != 0) { imposta(èLetto, OrariSonno.sposta(attuale, delta)); return; }
            new TimePickerDialog(this, (picker, h, m) -> imposta(èLetto, h * 60 + m), attuale / 60, attuale % 60, true).show();
        });
    }

    private void imposta(boolean èLetto, int minuti) {
        if (èLetto) letto = minuti; else sveglia = minuti;
        aggiorna();
    }

    private void aggiorna() {
        ((TextView) findViewById(R.id.o_letto)).setText(OrariSonno.hhmm(letto));
        ((TextView) findViewById(R.id.o_sveglia)).setText(OrariSonno.hhmm(sveglia));
        int d = OrariSonno.durata(letto, sveglia), prevista = OrariSonno.durata(pianoLetto, pianoSveglia);
        boolean ok = OrariSonno.plausibile(d);
        TextView somma = findViewById(R.id.o_sommario);
        somma.setText(ok ? "Dormito " + OrariSonno.testo(d) + " · previsto " + OrariSonno.testo(prevista) : "Fra l'andare a letto e la sveglia devono passare da 1 a 16 ore");
        somma.setTextColor(getColor(ok ? R.color.w_ink : R.color.w_t_rientro));
        View salva = findViewById(R.id.o_salva);
        salva.setEnabled(ok); salva.setAlpha(ok ? 1f : 0.4f);
    }

    private void salva(int l, int s) {
        NotturnistiWidget.salvaSonno(this, giorno, OrariSonno.hhmm(l), OrariSonno.hhmm(s), OrariSonno.fonte(l, s, pianoLetto, pianoSveglia));
        NotturnistiWidget.aggiornaTutti(this);
        finish();
    }
}
