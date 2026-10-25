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
