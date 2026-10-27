package club.notturnisti.twa;

/**
 * Quanto mostrare, dall'altezza del widget: parte minimale e aggiunge un pezzo alla volta, nell'ordine di quanto
 * serve: «adesso» (sempre), la barra se qualcosa è in corso, il pulsante del momento, la prima voce, la prima
 * riga di calendario, la seconda voce, poi le altre settimane. Il calendario riempie lo spazio che resta (le righe
 * hanno peso), quindi non restano vuoti. Misure in dp ricavate dall'anteprima su computer (tools/anteprima-widget), non a occhio; senza Android: si prova sulla JVM.
 */
final class WidgetPiano {
    static final int MARGINI = 28, ADESSO = 46, BARRA = 10, PULSANTE = 50, PRIMA_VOCE = 30, VOCE = 24, TESTA_CAL = 72, RIGA = 44, RIGA_PERSONA = 54;
    /** I launcher riportano un'altezza un po' più bassa del vero (15-28% misurato, fino a 28% su un OnePlus): prudente 5%, generosa 12% (vedi calcola). */
    static final float ALTEZZA_VERA = 1.05f, ALTEZZA_GENEROSA = 1.12f;

    boolean barra, pulsante, calendario;
    int voci, righe;

    static WidgetPiano calcola(int altezzaDp, boolean inCorso, boolean haPulsante, int vociDisponibili, boolean conPersona, int righeMax) {
        // Due stime. Con il calendario conta solo la prudente: le righe si allargano da sole per riempire lo spazio che avanza, ma se ne
        // mettessimo troppe si schiaccerebbero fino a perdere la lettera del turno. Senza calendario, un launcher che dichiara meno
        // del vero (fino al 28%, misurato) lascerebbe un buco in fondo: allora barra, pulsante e voci si decidono con la stima generosa;
        // se il launcher è esatto, al peggio si accorcia l'ultima riga di testo.
        WidgetPiano p = calcolaCon(ALTEZZA_VERA, altezzaDp, inCorso, haPulsante, vociDisponibili, conPersona, righeMax);
        if (p.calendario) {
            // il mese intero vale più delle voci: se togliendole entra tutto, si tolgono
            WidgetPiano m = calcolaCon(ALTEZZA_VERA, altezzaDp, inCorso, haPulsante, 0, conPersona, righeMax);
            return m.calendario && m.righe == righeMax && p.righe < righeMax ? m : p;
        }
        return calcolaCon(ALTEZZA_GENEROSA, altezzaDp, inCorso, haPulsante, vociDisponibili, conPersona, 0);
    }

    private static WidgetPiano calcolaCon(float fattore, int altezzaDp, boolean inCorso, boolean haPulsante, int vociDisponibili, boolean conPersona, int righeMax) {
        WidgetPiano p = new WidgetPiano();
        int resto = Math.round(altezzaDp * fattore) - MARGINI - ADESSO;
        if (inCorso && resto >= BARRA) { p.barra = true; resto -= BARRA; }
        if (haPulsante && resto >= PULSANTE) { p.pulsante = true; resto -= PULSANTE; }
        if (vociDisponibili >= 1 && resto >= PRIMA_VOCE) { p.voci = 1; resto -= PRIMA_VOCE; }
        int riga = conPersona ? RIGA_PERSONA : RIGA;
        if (righeMax >= 1 && resto >= TESTA_CAL + riga) { p.calendario = true; p.righe = 1; resto -= TESTA_CAL + riga; }
        // il mese intero (anche con la persona) viene prima della seconda voce
        while (p.calendario && p.righe < righeMax && resto >= riga) { p.righe++; resto -= riga; }
        // lo spazio che avanza si riempie con altre voci, una riga alla volta (fino a quattro)
        while (p.voci >= 1 && p.voci < vociDisponibili && p.voci < WidgetStato.MAX_VOCI && resto >= VOCE) { p.voci++; resto -= VOCE; }
        return p;
    }
}
