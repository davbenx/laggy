// _analytics.js — telemetria aggregata, lato server (il prefisso _ = non è una rotta).
//
// Cosa si salva: SOLO contatori per giorno, mai eventi singoli.
//   counts(day, event, prop, n)   es. ("2026-09-23", "plan_generated", "pattern_type=notte", 14)
// Niente IP, niente user-agent, niente id, niente orario preciso: dal database
// non si può ricostruire la sequenza di azioni di nessuno, nemmeno volendo.
//
// Unica eccezione, per sapere quanti calendari (feed ICS) sono ancora vivi prima
// di spegnerli: feed_seen(day, kind, h), con h = primi 12 caratteri esadecimali
// dello SHA-256 dell'id del feed. È un id casuale già privo di dati personali,
// qui ulteriormente troncato; serve solo a contare feed DISTINTI per giorno, e
// le righe più vecchie di FEED_RETENTION_DAYS vengono cancellate.
//
// Database: D1 (SQLite di Cloudflare), binding "DB". Le tabelle si creano da
// sole al primo uso. Se il binding manca (anteprime, sviluppo) tutto diventa un
// no-op silenzioso: la telemetria non deve mai rompere niente.

// Stesso elenco di analytics.js (lato browser): tests/analytics.test.js verifica
// che coincidano, così aggiungere un evento solo da una parte fa fallire i test.
export const ALLOWED = {
  landing_view: [],
  example_started: [],
  example_completed: [],

  onboarding_started: [],
  onboarding_step_completed: ["step"],
  onboarding_abandoned: ["step"],
  onboarding_completed: [],

  plan_generated: ["pattern_type"],
  today_viewed: [],
  calendar_viewed: [],

  share_started: [],
  share_created: [],
  share_opened: [],
  share_accepted: [],

  install_prompt_shown: [],
  pwa_installed: [],

  notification_prompt_shown: [],
  notifications_enabled: [],

  return_d1: [],
  return_d7: [],
  return_d30: [],

  share_whatsapp: [],

  active_day: ["platform"]
};

// Valori ammessi per le proprietà: brevi e a bassa cardinalità. Qualunque altra
// cosa viene scartata — un campo libero è il modo in cui un dato personale
// finisce per sbaglio in un database di "statistiche anonime".
const VALUE_RE = /^[a-z0-9_]{1,24}$/;
const PLATFORMS = new Set(["web", "pwa", "android", "ios"]);

export const RETENTION_DAYS = 400;      // contatori aggregati
export const FEED_RETENTION_DAYS = 90;  // hash dei feed: il minimo per vedere un trend

export function sanitizeEvent(body) {
  if (!body || typeof body !== "object") return null;
  const event = String(body.event || "");
  if (!Object.prototype.hasOwnProperty.call(ALLOWED, event)) return null;
  const allowed = ALLOWED[event];
  const props = body.props && typeof body.props === "object" ? body.props : {};
  // Al massimo UNA proprietà per riga (oggi nessun evento ne ha di più): la
  // chiave del contatore resta semplice e i conteggi non si moltiplicano.
  let prop = "";
  for (const k of allowed) {
    if (props[k] == null) continue;
    const v = String(props[k]).toLowerCase();
    if (!VALUE_RE.test(v)) continue;
    if (k === "platform" && !PLATFORMS.has(v)) continue;
    prop = k + "=" + v;
    break;
  }
  return { event, prop };
}

// Giorno UTC dell'evento: quello del client se plausibile (gli eventi in coda
// offline arrivano in ritardo e devono contare nel giorno giusto), altrimenti
// oggi. Mai nel futuro, mai più di 30 giorni indietro.
export function eventDay(t, now = Date.now()) {
  const n = Number(t);
  const ok = Number.isFinite(n) && n <= now + 5 * 60e3 && n >= now - 30 * 86400e3;
  return new Date(ok ? Math.min(n, now) : now).toISOString().slice(0, 10);
}

let _schemaOk = false;
async function ensureSchema(db) {
  if (_schemaOk) return;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS counts (day TEXT NOT NULL, event TEXT NOT NULL, prop TEXT NOT NULL DEFAULT '', n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, event, prop))"),
    db.prepare("CREATE TABLE IF NOT EXISTS feed_seen (day TEXT NOT NULL, kind TEXT NOT NULL, h TEXT NOT NULL, PRIMARY KEY (day, kind, h))")
  ]);
  _schemaOk = true;
}

export async function increment(env, day, event, prop) {
  if (!env.DB) return false;
  await ensureSchema(env.DB);
  await env.DB.prepare(
    "INSERT INTO counts (day, event, prop, n) VALUES (?1, ?2, ?3, 1) ON CONFLICT (day, event, prop) DO UPDATE SET n = n + 1"
  ).bind(day, event, prop).run();
  return true;
}

async function shortHash(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(s)));
  return [...new Uint8Array(buf)].slice(0, 6).map(b => b.toString(16).padStart(2, "0")).join("");
}

// Chiamata dai feed ICS: conta le letture e i feed distinti del giorno.
// kind ∈ "feed" | "couple". Non blocca mai la risposta (va in waitUntil).
export async function recordFeedPoll(env, kind, id) {
  if (!env.DB) return;
  try {
    await ensureSchema(env.DB);
    const day = new Date().toISOString().slice(0, 10);
    const h = await shortHash(id);
    await env.DB.batch([
      env.DB.prepare("INSERT OR IGNORE INTO feed_seen (day, kind, h) VALUES (?1, ?2, ?3)").bind(day, kind, h),
      env.DB.prepare(
        "INSERT INTO counts (day, event, prop, n) VALUES (?1, ?2, '', 1) ON CONFLICT (day, event, prop) DO UPDATE SET n = n + 1"
      ).bind(day, kind + "_poll")
    ]);
  } catch (_) { /* mai far fallire il calendario per una statistica */ }
}

export async function readStats(env, days) {
  await ensureSchema(env.DB);
  const since = new Date(Date.now() - (days - 1) * 86400e3).toISOString().slice(0, 10);
  const purge = new Date(Date.now() - RETENTION_DAYS * 86400e3).toISOString().slice(0, 10);
  const purgeFeed = new Date(Date.now() - FEED_RETENTION_DAYS * 86400e3).toISOString().slice(0, 10);
  const [counts, feeds] = await env.DB.batch([
    env.DB.prepare("SELECT day, event, prop, n FROM counts WHERE day >= ?1 ORDER BY day").bind(since),
    // feed distinti per giorno, più i distinti sull'intero periodo
    env.DB.prepare(
      "SELECT day, kind, COUNT(*) AS n FROM feed_seen WHERE day >= ?1 GROUP BY day, kind " +
      "UNION ALL SELECT 'periodo' AS day, kind, COUNT(DISTINCT h) AS n FROM feed_seen WHERE day >= ?1 GROUP BY kind"
    ).bind(since),
    env.DB.prepare("DELETE FROM feed_seen WHERE day < ?1").bind(purgeFeed),
    env.DB.prepare("DELETE FROM counts WHERE day < ?1").bind(purge)
  ]);
  return { since, counts: counts.results || [], feeds: feeds.results || [] };
}
