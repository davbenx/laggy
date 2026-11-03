package club.notturnisti.twa

import android.content.Intent
import android.net.Uri
import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateGroupByDurationRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.time.Duration
import java.time.Instant

/**
 * Health Connect, solo in lettura e solo se l'utente lo sceglie: sonno (sessioni) e passi (a blocchi di 10 minuti).
 * Ogni tipo si chiede da solo, quando l'utente accende il suo interruttore; niente all'avvio, niente in background,
 * niente esce dal telefono. La pagina decide cosa farne (platform.js › salute).
 */
@CapacitorPlugin(name = "NTSalute")
class SalutePlugin : Plugin() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val tipi = mapOf(
        "sonno" to HealthPermission.getReadPermission(SleepSessionRecord::class),
        "passi" to HealthPermission.getReadPermission(StepsRecord::class)
    )
    private val contratto = PermissionController.createRequestPermissionResultContract()

    private fun client(): HealthConnectClient? =
        if (HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE) HealthConnectClient.getOrCreate(context) else null

    /** {stato: "ok" | "da_installare" | "assente", sonno: bool, passi: bool} */
    @PluginMethod
    fun stato(call: PluginCall) {
        val s = HealthConnectClient.getSdkStatus(context)
        val r = JSObject()
        r.put("stato", when (s) {
            HealthConnectClient.SDK_AVAILABLE -> "ok"
            HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "da_installare"
            else -> "assente"
        })
        val c = client()
        if (c == null) { r.put("sonno", false); r.put("passi", false); call.resolve(r); return }
        scope.launch {
            try {
                val g = c.permissionController.getGrantedPermissions()
                tipi.forEach { (k, p) -> r.put(k, g.contains(p)) }
                call.resolve(r)
            } catch (e: Exception) { call.reject("Health Connect non risponde", e) }
        }
    }

    /** Chiede i permessi dei tipi indicati ({tipi: ["sonno"]}); risponde con quelli concessi. */
    @PluginMethod
    fun chiedi(call: PluginCall) {
        if (client() == null) { call.reject("Health Connect non disponibile"); return }
        val richiesti = (call.getArray("tipi")?.toList<String>() ?: emptyList()).mapNotNull { tipi[it] }.toSet()
        if (richiesti.isEmpty()) { call.reject("nessun tipo"); return }
        val intent = contratto.createIntent(context, richiesti)
        startActivityForResult(call, intent, "dopoPermessi")
    }

    @ActivityCallback
    private fun dopoPermessi(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        val concessi = contratto.parseResult(result.resultCode, result.data)
        val r = JSObject(); tipi.forEach { (k, p) -> r.put(k, concessi.contains(p)) }
        call.resolve(r)
    }

    /** Sessioni di sonno fra da e a (millisecondi): [{inizio, fine, fonte}]. */
    @PluginMethod
    fun sonno(call: PluginCall) {
        val c = client() ?: run { call.reject("Health Connect non disponibile"); return }
        val da = Instant.ofEpochMilli(call.getLong("da") ?: 0L); val a = Instant.ofEpochMilli(call.getLong("a") ?: System.currentTimeMillis())
        scope.launch {
            try {
                val out = JSArray()
                var pagina: String? = null
                do {
                    val res = c.readRecords(ReadRecordsRequest(SleepSessionRecord::class, TimeRangeFilter.between(da, a), pageToken = pagina))
                    for (s in res.records) {
                        val o = JSObject()
                        o.put("inizio", s.startTime.toEpochMilli()); o.put("fine", s.endTime.toEpochMilli())
                        o.put("fonte", s.metadata.dataOrigin.packageName)
                        out.put(o)
                    }
                    pagina = res.pageToken
                } while (pagina != null)
                val r = JSObject(); r.put("sessioni", out); call.resolve(r)
            } catch (e: SecurityException) { call.reject("permesso negato", e)
            } catch (e: Exception) { call.reject("lettura non riuscita", e) }
        }
    }

    /** Passi fra da e a, sommati a blocchi di 10 minuti: [{t, n}] (t = inizio del blocco, ms). */
    @PluginMethod
    fun passi(call: PluginCall) {
        val c = client() ?: run { call.reject("Health Connect non disponibile"); return }
        val da = Instant.ofEpochMilli(call.getLong("da") ?: 0L); val a = Instant.ofEpochMilli(call.getLong("a") ?: System.currentTimeMillis())
        scope.launch {
            try {
                val res = c.aggregateGroupByDuration(AggregateGroupByDurationRequest(setOf(StepsRecord.COUNT_TOTAL), TimeRangeFilter.between(da, a), Duration.ofMinutes(10)))
                val out = JSArray()
                for (b in res) { val n = b.result[StepsRecord.COUNT_TOTAL] ?: 0L; if (n > 0) { val o = JSObject(); o.put("t", b.startTime.toEpochMilli()); o.put("n", n); out.put(o) } }
                val r = JSObject(); r.put("blocchi", out); call.resolve(r)
            } catch (e: SecurityException) { call.reject("permesso negato", e)
            } catch (e: Exception) { call.reject("lettura non riuscita", e) }
        }
    }

    /** Le impostazioni di Health Connect (per togliere i permessi), o Google Play se va installato o aggiornato. */
    @PluginMethod
    fun apri(call: PluginCall) {
        try {
            val i = if (HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE)
                Intent(HealthConnectClient.ACTION_HEALTH_CONNECT_SETTINGS)
            else Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=com.google.android.apps.healthdata&url=healthconnect%3A%2F%2Fonboarding"))
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); context.startActivity(i); call.resolve()
        } catch (e: Exception) { call.reject("non disponibile", e) }
    }
}
