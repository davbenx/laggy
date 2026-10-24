package club.notturnisti.twa;

/**
 * Quanto mostrare, dall'altezza del widget: parte minimale e aggiunge un pezzo alla volta, nell'ordine di quanto
 * serve: «adesso» (sempre), la barra se qualcosa è in corso, il pulsante del momento, la prima voce, la prima
 * riga di calendario, la seconda voce, poi le altre settimane. Il calendario riempie lo spazio che resta (le righe
 * hanno peso), quindi non restano vuoti. Misure in dp ricavate dall'anteprima su computer (tools/anteprima-widget), non a occhio; senza Android: si prova sulla JVM.
 */
final class WidgetPiano {
    static final int MARGINI = 28, ADESSO = 46, BARRA = 10, PULSANTE = 50, PRIMA_VOCE = 30, VOCE = 24, TESTA_CAL = 50, RIGA = 44, RIGA_PERSONA = 62;
    /** I launcher riportano un'altezza un po' più bassa del vero (15-25% misurato): piccolo margine. */
    static final float ALTEZZA_VERA = 1.05f;

    boolean barra, pulsante, calendario;
    int voci, righe;

    static WidgetPiano calcola(int altezzaDp, boolean inCorso, boolean haPulsante, int vociDisponibili, boolean conPersona, int righeMax) {
        WidgetPiano p = new WidgetPiano();
        int resto = Math.round(altezzaDp * ALTEZZA_VERA) - MARGINI - ADESSO;
        if (inCorso && resto >= BARRA) { p.barra = true; resto -= BARRA; }
        if (haPulsante && resto >= PULSANTE) { p.pulsante = true; resto -= PULSANTE; }
        if (vociDisponibili >= 1 && resto >= PRIMA_VOCE) { p.voci = 1; resto -= PRIMA_VOCE; }
        int riga = conPersona ? RIGA_PERSONA : RIGA;
        if (righeMax >= 1 && resto >= TESTA_CAL + riga) { p.calendario = true; p.righe = 1; resto -= TESTA_CAL + riga; }
        if (vociDisponibili >= 2 && p.voci == 1 && resto >= VOCE) { p.voci = 2; resto -= VOCE; }
        while (p.calendario && p.righe < righeMax && resto >= riga) { p.righe++; resto -= riga; }
        return p;
    }
}
