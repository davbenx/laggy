package club.notturnisti.twa

import android.view.View
import android.widget.FrameLayout
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import com.android.ide.common.rendering.api.SessionParams
import com.android.resources.NightMode
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import java.util.Calendar
import java.util.TimeZone

/** Il widget com'è davvero (stesse risorse, stessa costruzione delle viste), nei momenti e alle altezze che contano. */
class AnteprimaTest {
    @Before fun fuso() { TimeZone.setDefault(TimeZone.getTimeZone("Europe/Rome")) }
    @get:Rule val paparazzi = Paparazzi(deviceConfig = DeviceConfig.PIXEL_5, theme = "android:Theme.Material.Light.NoActionBar", renderingMode = SessionParams.RenderingMode.SHRINK)

    private fun t(g: Int, h: Int, m: Int): Long { val c = Calendar.getInstance(); c.clear(); c.set(2026, Calendar.OCTOBER, 24 + g, h, m, 0); return c.timeInMillis }
    private fun voce(s: Long, e: Long, titolo: String, k: String) = JSONObject().put("s", s).put("e", e).put("t", titolo).put("k", k)

    private fun calendario(persone: Boolean): JSONObject {
        val pat = "NNNRRRPPPRRMMMR"; val mie = JSONArray(); val sue = JSONArray()
        fun cella(c: Char) = "$c:" + (if (c == 'N') "n" else if (c == 'R') "r" else "l")
        // 20 settimane da lunedì 21 settembre (quattro prima di quella di oggi), come le pubblica la pagina
        for (i in 0 until 140) { mie.put(if (i == 52) "Fe:r" else cella(pat[(i + 4 - 28 + 150) % pat.length])); sue.put(cella(pat[(i + 6 - 28 + 150) % pat.length])) }
        val o = JSONObject().put("da", "2026-09-21").put("io", mie).put("sel", 0).put("star", "0|Anna")
        o.put("p", if (persone) JSONArray().put(JSONObject().put("n", "Anna").put("g", sue)) else JSONArray())
        return o
    }

    private fun scena(p: Paparazzi, nome: String, hDp: Int, ora: Long, voci: List<JSONObject>, diario: JSONObject? = null, persone: Boolean = true, persona: Int = if (persone) 0 else -1, spostamento: Int = 0) {
        TimeZone.setDefault(TimeZone.getTimeZone("Europe/Rome"))
        NotturnistiWidget.senzaIntent = true
        val v = JSONArray(); voci.forEach { v.put(it) }
        val r = JSONObject().put("voci", v).put("mese", calendario(persone))
        voci.firstOrNull { it.getString("k").startsWith("turno") }?.let { r.put("turno", JSONObject().put("s", it.getLong("s")).put("e", it.getLong("e")).put("t", it.getString("t"))) }
        if (diario != null) r.put("diario", diario)
        val st = WidgetStato.calcola(r, JSONObject(), ora)
        val m = CalendarioModel.leggi(r.getJSONObject("mese"))
        val ctx = p.context
        val d = ctx.resources.displayMetrics.density
        val rv = NotturnistiWidget.costruisci(ctx, st, m, hDp, ora, persona, 1, spostamento)
        val w: View = rv.apply(ctx, FrameLayout(ctx))
        val box = FrameLayout(ctx); box.setBackgroundColor(0xFF2A6A7A.toInt()); box.setPadding(24, 24, 24, 24)
        box.addView(w, FrameLayout.LayoutParams((330 * d).toInt(), (hDp * d).toInt()))
        p.snapshot(box, nome)
    }

    private fun sera() = listOf(voce(t(0, 22, 0), t(1, 6, 15), "Turno Notte", "turno"), voce(t(1, 3, 10), t(1, 9, 55), "Sonno", "sonno"), voce(t(1, 9, 55), t(1, 10, 15), "Luce", "luce"))
    private fun pomeriggio() = listOf(voce(t(0, 19, 5), t(0, 19, 50), "Pisolino di recupero", "pisolino-recupero"), voce(t(0, 19, 10), t(0, 19, 25), "Ultimo caffè", "caffe"), voce(t(0, 22, 0), t(1, 6, 15), "Turno Notte", "turno"), voce(t(1, 3, 10), t(1, 9, 55), "Sonno", "sonno"))
    private fun diario() = JSONObject().put("d", "2026-10-24").put("bed", "23:30").put("wake", "07:10").put("da", t(0, 7, 10)).put("a", t(0, 21, 10))

    private fun tutte(nome: String, ora: Long, voci: List<JSONObject>, diario: JSONObject? = null, persone: Boolean = true) {
        for (tema in listOf("chiaro", "scuro")) {
            paparazzi.unsafeUpdateConfig(
                deviceConfig = if (tema == "scuro") DeviceConfig.PIXEL_5.copy(nightMode = NightMode.NIGHT) else DeviceConfig.PIXEL_5,
                theme = if (tema == "scuro") "android:Theme.Material.NoActionBar" else "android:Theme.Material.Light.NoActionBar")
            for (h in listOf(80, 130, 190, 256, 330, 460, 560)) scena(paparazzi, "${nome}_${tema}_h$h", h, ora, voci, diario, persone)
        }
    }

    @Test fun sera_prima_della_notte() = tutte("a_sera", t(0, 20, 43), sera())
    @Test fun sveglia_prima_di_dormire() = tutte("b_sveglia", t(1, 0, 30), sera())
    @Test fun pisolino_in_corso() = tutte("c_pisolino", t(0, 19, 20), pomeriggio())
    @Test fun voto_del_sonno() = tutte("d_voto", t(0, 9, 0), sera(), diario())
    // dopo il sì al sonno: le cinque facce dell'energia
    @Test fun voto_energia() = tutte("d2_energia", t(0, 9, 0), sera(), diario().put("sonno", true))
    @Test fun senza_persone() = tutte("e_solo_io", t(0, 20, 43), sera(), null, false)

    // ‹ › del calendario: › da oggi si aggancia all'inizio di novembre (+2 settimane), ‹ a quello di ottobre (-3), dicembre (+6), l'ultima pagina dei dati
    @Test fun pagine_del_calendario() {
        for (tema in listOf("chiaro", "scuro")) {
            paparazzi.unsafeUpdateConfig(
                deviceConfig = if (tema == "scuro") DeviceConfig.PIXEL_5.copy(nightMode = NightMode.NIGHT) else DeviceConfig.PIXEL_5,
                theme = if (tema == "scuro") "android:Theme.Material.NoActionBar" else "android:Theme.Material.Light.NoActionBar")
            for (h in listOf(330, 460)) {
                scena(paparazzi, "h_pagina_avanti_${tema}_h$h", h, t(0, 20, 43), sera(), spostamento = 2)
                scena(paparazzi, "i_pagina_indietro_${tema}_h$h", h, t(0, 20, 43), sera(), spostamento = -3)
                scena(paparazzi, "j_pagina_fine_${tema}_h$h", h, t(0, 20, 43), sera(), spostamento = 99)
                scena(paparazzi, "k_pagina_avanti_solo_io_${tema}_h$h", h, t(0, 20, 43), sera(), persone = false, spostamento = 6)
            }
        }
    }

    // Geometria vera delle viste (non l'aspetto): le frecce ‹ › stanno sulla stessa linea del titolo e il bordo sinistro della prima
    // sta allineato alle celle. Prova alle altezze in cui il calendario c'è, con e senza persona, in chiaro e scuro.
    @Test fun freccette_allineate() {
        fun posizione(v: View, radice: View): IntArray { var x = 0; var y = 0; var c: View? = v
            while (c != null && c !== radice) { x += c.left; y += c.top; c = c.parent as? View }
            return intArrayOf(x, y) }
        for (tema in listOf("chiaro", "scuro")) {
            paparazzi.unsafeUpdateConfig(
                deviceConfig = if (tema == "scuro") DeviceConfig.PIXEL_5.copy(nightMode = NightMode.NIGHT) else DeviceConfig.PIXEL_5,
                theme = if (tema == "scuro") "android:Theme.Material.NoActionBar" else "android:Theme.Material.Light.NoActionBar")
            for (persone in listOf(true, false)) for (h in listOf(330, 460, 560)) {
                TimeZone.setDefault(TimeZone.getTimeZone("Europe/Rome")); NotturnistiWidget.senzaIntent = true
                val ora = t(0, 20, 43); val v = JSONArray(); sera().forEach { v.put(it) }
                val r = JSONObject().put("voci", v).put("mese", calendario(persone))
                val st = WidgetStato.calcola(r, JSONObject(), ora); val m = CalendarioModel.leggi(r.getJSONObject("mese"))
                val ctx = paparazzi.context; val d = ctx.resources.displayMetrics.density
                val w = NotturnistiWidget.costruisci(ctx, st, m, h, ora, if (persone) 0 else -1, 1, 0).apply(ctx, FrameLayout(ctx))
                val larg = (330 * d).toInt(); val alt = (h * d).toInt()
                w.measure(View.MeasureSpec.makeMeasureSpec(larg, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(alt, View.MeasureSpec.EXACTLY)); w.layout(0, 0, larg, alt)
                val prec = w.findViewById<View>(R.id.w_cal_prec); val mese = w.findViewById<View>(R.id.w_cal_mese); val succ = w.findViewById<View>(R.id.w_cal_succ)
                val cella = w.findViewById<View>(R.id.w_c0_0_m)
                val nome = "$tema persone=$persone h=$h"
                val pp = posizione(prec, w); val pm = posizione(mese, w); val ps = posizione(succ, w); val pc = posizione(cella, w)
                val cPrec = pp[1] + prec.height / 2.0; val cMese = pm[1] + mese.height / 2.0; val cSucc = ps[1] + succ.height / 2.0
                println("MISURA $nome | centro ‹ ${"%.1f".format(cPrec / d)} dp, titolo ${"%.1f".format(cMese / d)} dp, › ${"%.1f".format(cSucc / d)} dp | tratto ‹ a ${"%.1f".format((pp[0] + 16 * d - pc[0]) / d)} dp dal bordo celle | ‹→titolo ${"%.1f".format((pm[0] - (pp[0] + prec.width)) / d)} dp, titolo→› ${"%.1f".format((ps[0] - (pm[0] + mese.width)) / d)} dp")
                org.junit.Assert.assertTrue("$nome: ‹ e titolo sulla stessa linea ($cPrec vs $cMese)", Math.abs(cPrec - cMese) <= 1.0)
                org.junit.Assert.assertTrue("$nome: › e titolo sulla stessa linea ($cSucc vs $cMese)", Math.abs(cSucc - cMese) <= 1.0)
                // il disegno della freccia comincia a 16 dp dal bordo sinistro della sua vista (8 di margine interno + 8 di vuoto nell'icona)
                val sporgenza = (pp[0] + 16 * d - pc[0]) / d
                org.junit.Assert.assertTrue("$nome: il tratto della freccia sta a ${"%.1f".format(sporgenza)} dp dal bordo delle celle (voglio 0-4)", sporgenza >= -0.5 && sporgenza <= 4.0)
                org.junit.Assert.assertTrue("$nome: ‹ titolo › sono vicini (titolo a ${(pm[0] - (pp[0] + prec.width)) / d} dp dalla freccia)", pm[0] - (pp[0] + prec.width) <= 6 * d && ps[0] - (pm[0] + mese.width) <= 6 * d)
                org.junit.Assert.assertTrue("$nome: le frecce hanno un'area di tocco di almeno 32 dp di altezza e 40 di larghezza", prec.height >= 32 * d - 1 && prec.width >= 40 * d - 1 && succ.width >= 40 * d - 1)
            }
        }
    }

    // oggi è domenica (ultima colonna) o lunedì (prima): la cornice di oggi arriva al bordo del calendario e non deve essere tagliata
    @Test fun oggi_ai_bordi() {
        for (tema in listOf("chiaro", "scuro")) {
            paparazzi.unsafeUpdateConfig(
                deviceConfig = if (tema == "scuro") DeviceConfig.PIXEL_5.copy(nightMode = NightMode.NIGHT) else DeviceConfig.PIXEL_5,
                theme = if (tema == "scuro") "android:Theme.Material.NoActionBar" else "android:Theme.Material.Light.NoActionBar")
            scena(paparazzi, "n_domenica_${tema}_h460", 460, t(1, 14, 8), sera(), null, true)
            scena(paparazzi, "n_lunedi_${tema}_h460", 460, t(2, 14, 8), sera(), null, true)
        }
    }

    // la finestra «Come hai dormito?» aperta da «Altri orari»: orari del piano e orari corretti, e uno non plausibile
    @Test fun finestra_orari() {
        for (tema in listOf("chiaro", "scuro")) {
            paparazzi.unsafeUpdateConfig(
                deviceConfig = if (tema == "scuro") DeviceConfig.PIXEL_5.copy(nightMode = NightMode.NIGHT) else DeviceConfig.PIXEL_5,
                theme = if (tema == "scuro") "android:Theme.Material.NoActionBar" else "android:Theme.Material.Light.NoActionBar")
            val ctx = paparazzi.context
            for ((nome, letto, sveglia, somma, valido) in listOf(
                Quintupla("piano", "23:30", "07:10", "Dormito 7h40 · previsto 7h40", true),
                Quintupla("corretti", "00:30", "06:40", "Dormito 6h10 · previsto 7h40", true),
                Quintupla("impossibili", "07:00", "07:30", "Fra l'andare a letto e la sveglia devono passare da 1 a 16 ore", false))) {
                val v = android.view.LayoutInflater.from(ctx).inflate(R.layout.orari_sonno, null)
                (v.findViewById<android.widget.TextView>(R.id.o_letto)).text = letto
                (v.findViewById<android.widget.TextView>(R.id.o_sveglia)).text = sveglia
                val t = v.findViewById<android.widget.TextView>(R.id.o_sommario); t.text = somma
                if (!valido) { t.setTextColor(ctx.getColor(R.color.w_t_rientro)); v.findViewById<View>(R.id.o_salva).alpha = 0.4f }
                val box = FrameLayout(ctx); box.setBackgroundColor(0xFF2A6A7A.toInt()); box.setPadding(24, 24, 24, 24)
                box.addView(v, FrameLayout.LayoutParams((330 * ctx.resources.displayMetrics.density).toInt(), FrameLayout.LayoutParams.WRAP_CONTENT))
                paparazzi.snapshot(box, "m_finestra_${nome}_$tema")
            }
        }
    }
    private data class Quintupla(val nome: String, val letto: String, val sveglia: String, val somma: String, val valido: Boolean)

    // persona nascosta col tasto, piano esaurito, più di una riga di voci in arrivo
    @Test fun casi_particolari() {
        for (tema in listOf("chiaro", "scuro")) {
            paparazzi.unsafeUpdateConfig(
                deviceConfig = if (tema == "scuro") DeviceConfig.PIXEL_5.copy(nightMode = NightMode.NIGHT) else DeviceConfig.PIXEL_5,
                theme = if (tema == "scuro") "android:Theme.Material.NoActionBar" else "android:Theme.Material.Light.NoActionBar")
            for (h in listOf(130, 330)) {
                scena(paparazzi, "f_nascosta_${tema}_h$h", h, t(0, 20, 43), sera(), null, true, -1)
                scena(paparazzi, "g_esaurito_${tema}_h$h", h, t(5, 12, 0), sera(), null, true)
            }
        }
    }
}
