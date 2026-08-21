// history.js — andamento del sonno reale nel tempo, dal diario (letto/sveglia).
// Puro e testabile. Gli altri due insight dello storico (quale giorno del ciclo
// pesa di più, deriva dell'orario di sveglia) NON sono qui: li fornisce già il
// core con cycleSummary()/wakeSummary(), che la vista riusa via il ponte.

const parseHM = s => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || "")); return m ? (+m[1]) * 60 + (+m[2]) : null; };

// diary: { wakes:{date:"HH:MM"}, beds:{date:"HH:MM"} }
// planFor: (Date) -> piano del giorno (per il sonno pianificato P.s.dur)
export function sleepTrend(diary, planFor, opts = {}) {
  const days = opts.days || 30;
  const need = opts.need || 480;
  const beds = (diary && diary.beds) || {};
  const wakes = (diary && diary.wakes) || {};
  const dates = Object.keys(wakes).filter(k => beds[k] != null).sort();

  const series = [];
  let debt = 0;
  for (const k of dates) {
    const bed = parseHM(beds[k]), wake = parseHM(wakes[k]);
    if (bed == null || wake == null) continue;
    let actual = wake - bed;
    if (actual <= 0) actual += 1440;                 // sonno a cavallo di mezzanotte
    if (actual < 60 || actual > 16 * 60) continue;   // voce implausibile, la salto
    let planned = null;
    try { const P = planFor && planFor(new Date(k + "T12:00:00")); planned = P && P.s ? P.s.dur : null; } catch (_) {}
    const target = planned != null ? planned : need;
    debt += (target - actual);                       // positivo = hai dormito meno del previsto
    series.push({ date: k, actual, planned, debt });
  }

  const recent = series.slice(-days);
  const avg = a => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null;
  return {
    series: recent,
    n: series.length,
    avgActual: avg(series.map(s => s.actual)),
    avgPlanned: avg(series.filter(s => s.planned != null).map(s => s.planned)),
    debtNow: series.length ? series[series.length - 1].debt : 0
  };
}

// esposizione al browser senza import incrociati con paid.js
try { if (typeof window !== "undefined") window.NTHistory = { sleepTrend }; } catch (_) {}
