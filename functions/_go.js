// _go.js — quanti passaggi dai social all'app, per codice (il prefisso _ = non è una rotta).
//
// /go/<codice> (es. /go/ig-reel-1103) rimanda all'app e aggiunge 1 a un
// contatore go_counts(day, code, n). Si salva SOLO questo: niente IP, niente
// user-agent, niente cookie, niente orario. Lo user-agent si legge al volo e
// basta per due cose: non contare le anteprime dei link (WhatsApp, Facebook…)
// e mandare Android su Google Play quando la scheda sarà pubblica (GO_PLAY=1).
//
// In lettura (/stats/go, protetto) i totali di un giorno sotto GO_MIN_GIORNO non
// compaiono: restano solo nei totali della settimana, così un numero piccolo
// non racconta il clic di una persona precisa.

export const GO_MIN_GIORNO = 5;
export const GO_MAX_CODICI = 50;       // codici diversi al giorno: oltre, «altro» (un link inventato non riempie il database)
export const GO_RETENTION_DAYS = 400;
const PLAY = "https://play.google.com/store/apps/details?id=club.notturnisti.app";
const BOT = /bot|crawl|spider|preview|facebookexternalhit|facebot|whatsapp|telegram|slack|discord|skype|embedly|quora|pinterest|vkshare|headless|lighthouse/i;

export function codiceGo(raw) {
  let c = "";
  try { c = decodeURIComponent(String(raw || "")).trim().toLowerCase(); } catch (_) { c = ""; }
  return /^[a-z0-9][a-z0-9_-]{0,31}$/.test(c) ? c : "altro";
}

export const eBot = ua => !ua || BOT.test(ua);

export function destinazioneGo(env, ua, code) {
  if (env.GO_PLAY === "1" && /Android/i.test(ua || ""))
    return PLAY + "&referrer=" + encodeURIComponent("utm_source=" + code + "&utm_medium=social");
  return (env.SITE_ORIGIN || "https://app.notturnisti.club") + "/";
}

let _schemaOk = false;
async function schema(db) {
  if (_schemaOk) return;
  await db.prepare("CREATE TABLE IF NOT EXISTS go_counts (day TEXT NOT NULL, code TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, code))").run();
  _schemaOk = true;
}
export function _resetSchemaGo() { _schemaOk = false; }   // solo per i test

export async function registraGo(env, code, now = Date.now()) {
  if (!env.DB) return;
  await schema(env.DB);
  const day = new Date(now).toISOString().slice(0, 10);
  // Un codice nuovo entra solo se oggi ce ne sono meno di GO_MAX_CODICI.
  const r = await env.DB.prepare(
    "SELECT (SELECT COUNT(*) FROM go_counts WHERE day = ?1) AS tot, (SELECT COUNT(*) FROM go_counts WHERE day = ?1 AND code = ?2) AS c"
  ).bind(day, code).first();
  if (r && !r.c && r.tot >= GO_MAX_CODICI) code = "altro";
  await env.DB.prepare(
    "INSERT INTO go_counts (day, code, n) VALUES (?1, ?2, 1) ON CONFLICT (day, code) DO UPDATE SET n = n + 1"
  ).bind(day, code).run();
}

// Lunedì (UTC) della settimana di un giorno "AAAA-MM-GG".
export function settimanaDi(day) {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export async function leggiGo(env, days, now = Date.now()) {
  await schema(env.DB);
  const since = new Date(now - (days - 1) * 86400e3).toISOString().slice(0, 10);
  const purge = new Date(now - GO_RETENTION_DAYS * 86400e3).toISOString().slice(0, 10);
  const [righe] = await env.DB.batch([
    env.DB.prepare("SELECT day, code, n FROM go_counts WHERE day >= ?1 ORDER BY day, code").bind(since),
    env.DB.prepare("DELETE FROM go_counts WHERE day < ?1").bind(purge)
  ]);
  const tutte = righe.results || [];
  const sett = new Map(), totali = new Map();
  for (const { day, code, n } of tutte) {
    const k = settimanaDi(day) + "|" + code;
    sett.set(k, (sett.get(k) || 0) + n);
    totali.set(code, (totali.get(code) || 0) + n);
  }
  return {
    since, min_giorno: GO_MIN_GIORNO,
    giorni: tutte.filter(r => r.n >= GO_MIN_GIORNO).map(({ day, code, n }) => ({ day, code, n })),
    settimane: [...sett].map(([k, n]) => { const [week, code] = k.split("|"); return { week, code, n }; }),
    totali: Object.fromEntries(totali)
  };
}
