package club.notturnisti.twa;

/**
 * Quanto mostrare, dall'altezza del widget: parte minimale e aggiunge un pezzo alla volta, nell'ordine di quanto
 * serve: «adesso» (sempre), la barra se qualcosa è in corso, il pulsante del momento, la prima voce, la prima
 * riga di calendario, la seconda voce, poi le altre settimane. Il calendario riempie lo spazio che resta (le righe
 * hanno peso), quindi non restano vuoti. Misure in dp ricavate dall'anteprima su computer (tools/anteprima-widget), non a occhio; senza Android: si prova sulla JVM.
 */
final class WidgetPiano {
    static final int MARGINI = 28, ADESSO = 46, BARRA = 10, PULSANTE = 50, PRIMA_VOCE = 30, VOCE = 24, TESTA_CAL = 58, RIGA = 44, RIGA_PERSONA = 54;
    /** I launcher riportano un'altezza un po' più bassa del vero (15-28% misurato, fino a 28% su un OnePlus): prudente 5%, generosa 12% (vedi calcola). */
    static final float ALTEZZA_VERA = 1.05f, ALTEZZA_GENEROSA = 1.12f;

    boolean barra, pulsante, calendario;
    int voci, righe;

    static WidgetPiano calcola(int altezzaDp, boolean inCorso, boolean haPulsante, int vociDisponibili, boolean conPersona, int righeMax) {
        // Due stime. La prudente decide se il calendario c'è: una riga schiacciata non si perdona. La generosa (i launcher dichiarano
        // fino al 28% in meno del vero, misurato) decide il resto: barra, pulsante, voci e, se la prudente non ne ha trovate, il
        // calendario con la riga più bassa; altrimenti restano buchi in fondo. Se il launcher è esatto, al peggio si accorciano un po' le righe.
        WidgetPiano p = calcolaCon(ALTEZZA_VERA, altezzaDp, inCorso, haPulsante, vociDisponibili, conPersona, righeMax, 0);
        WidgetPiano g = calcolaCon(ALTEZZA_GENEROSA, altezzaDp, inCorso, haPulsante, vociDisponibili, conPersona, righeMax, 4);
        if (!p.calendario && !g.calendario) return g;
        if (!p.calendario) return g;
        p.voci = Math.max(p.voci, g.voci);
        p.righe = Math.max(p.righe, g.righe);
        return p;
    }

    private static WidgetPiano calcolaCon(float fattore, int altezzaDp, boolean inCorso, boolean haPulsante, int vociDisponibili, boolean conPersona, int righeMax, int riduzioneRiga) {
        WidgetPiano p = new WidgetPiano();
        int resto = Math.round(altezzaDp * fattore) - MARGINI - ADESSO;
        if (inCorso && resto >= BARRA) { p.barra = true; resto -= BARRA; }
        if (haPulsante && resto >= PULSANTE) { p.pulsante = true; resto -= PULSANTE; }
        if (vociDisponibili >= 1 && resto >= PRIMA_VOCE) { p.voci = 1; resto -= PRIMA_VOCE; }
        int riga = (conPersona ? RIGA_PERSONA : RIGA) - riduzioneRiga;
        if (righeMax >= 1 && resto >= TESTA_CAL + riga) { p.calendario = true; p.righe = 1; resto -= TESTA_CAL + riga; }
        // il mese intero (anche con la persona) viene prima della seconda voce
        while (p.calendario && p.righe < righeMax && resto >= riga) { p.righe++; resto -= riga; }
        if (vociDisponibili >= 2 && p.voci == 1 && resto >= VOCE) { p.voci = 2; resto -= VOCE; }
        return p;
    }
}
