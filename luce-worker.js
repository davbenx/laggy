// luce-worker.js — l'ottimizzatore della luce (luce-ottima.js) gira qui, fuori dal filo dell'interfaccia: qualche secondo
// di calcolo una volta al giorno, o quando cambiano turni e diario, senza bloccare niente. Riceve lo stato dell'app,
// ricostruisce i piani dei giorni con lo stesso motore e restituisce le finestre di luce di oggi e dei 3 giorni dopo.
import { createEngine } from "./engine.js";
import { ottimizzaLuce, OTTIMO } from "./luce-ottima.js";

export function calcola({ stato, oggi, festivi = [] }) {
  const PRIMA = 10, e = createEngine({ ...stato, focus: oggi + "T12:00:00" });
  const fest = new Set(festivi); try { e.setFestivo(d => fest.has(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"))); } catch (x) {}
  const base = new Date(oggi + "T12:00:00"), giorni = [];
  for (let g = -PRIMA; g < OTTIMO.H; g++) {
    const d = new Date(base); d.setDate(d.getDate() + g); e.state.focus = d;
    const P = e.plan(), [alba, tramonto] = e.luceDelGiorno(d);
    giorni.push({ P: { s: P.s, b: P.b, wake: P.wake, night: P.night, shift: P.shift, cbt: P.cbt, sleeps: P.sleeps, naps: P.naps }, alba, tramonto });
  }
  const fw = (h => +h.slice(0, 2) * 60 + +h.slice(3, 5))(e.state.freeWake), [alba, tramonto] = e.luceDelGiorno(base);
  return ottimizzaLuce({ giorni, oggi: PRIMA, libero: { inizio: fw - e.state.need, fine: fw }, alba, tramonto, andata: e.state.cTo });
}
if (typeof self !== "undefined" && typeof window === "undefined" && typeof self.postMessage === "function") {
  self.onmessage = ev => {
    const { chiave } = ev.data || {};
    try { const t0 = Date.now(), giorni = calcola(ev.data); self.postMessage({ chiave, giorni, ms: Date.now() - t0 }); }
    catch (err) { self.postMessage({ chiave, errore: String(err && err.message || err) }); }
  };
}
