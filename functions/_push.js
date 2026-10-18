// _push.js — promemoria della web app anche ad app chiusa (Web Push).
//
// Il browser non sa programmare una notifica per un'ora precisa: i timer del
// service worker muoiono dopo pochi secondi di inattività. Funziona solo una
// push dal server. Per non portare sul server il piano di nessuno:
//   - il telefono manda SOLO gli orari in cui suonare (niente testi, turni,
//     diario), più l'indirizzo anonimo della push dato dal browser;
//   - ogni minuto il Worker manda una push VUOTA a chi ha un orario dovuto;
//   - la push sveglia il service worker, che legge il piano salvato sul
//     telefono e mostra la notifica giusta.
// Gli orari passati si cancellano a ogni giro; l'iscrizione si cancella
// quando l'utente spegne i promemoria o quando il servizio push risponde che
// non esiste più (404/410).
//
// Le chiavi VAPID (che dicono al servizio push "queste push vengono da
// Notturnisti") le genera il Worker al primo uso e le tiene nel KV: nessun
// segreto da impostare a mano.

const SUB = "mailto:notturnisti.club+pianificatore@gmail.com";
// Solo i servizi push dei browser veri: l'endpoint è un URL scelto dal client,
// e il Worker non deve diventare un modo per fare richieste verso chiunque.
const HOST_OK = [/^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/, /^web\.push\.apple\.com$/,
  /\.push\.apple\.com$/, /^updates\.push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/];
export const MAX_ORARI = 120;            // ~8 giorni di promemoria, con margine
const ORIZZONTE = 9 * 86400e3;
const TTL = 15 * 60;                     // un promemoria vecchio di 15 minuti non serve più

export function endpointValido(u) {
  try { const x = new URL(u); return x.protocol === "https:" && HOST_OK.some(r => r.test(x.hostname)) && u.length < 1024; }
  catch (e) { return false; }
}

const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function sha(s) { return b64u(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))).slice(0, 32); }

let _schema = false;
async function schema(db) {
  if (_schema) return;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS push_sub (id TEXT PRIMARY KEY, endpoint TEXT NOT NULL, agg INTEGER NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS push_at (id TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (id, at))"),
    db.prepare("CREATE INDEX IF NOT EXISTS push_at_at ON push_at (at)")
  ]);
  _schema = true;
}

// Chiavi VAPID: P-256, la privata resta nel KV (mai al client), la pubblica
// va al browser per iscriversi.
let _vapid = null;
export async function vapid(env) {
  if (_vapid) return _vapid;
  let k = env.SUBS ? await env.SUBS.get("vapid:v1", "json") : null;
  if (!k) {
    const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    k = { priv: await crypto.subtle.exportKey("jwk", pair.privateKey), pub: b64u(await crypto.subtle.exportKey("raw", pair.publicKey)) };
    if (env.SUBS) {
      await env.SUBS.put("vapid:v1", JSON.stringify(k));
      // Due giri concorrenti al primo avvio: vince quello scritto, così tutti
      // firmano con la stessa chiave che i browser hanno ricevuto.
      k = await env.SUBS.get("vapid:v1", "json") || k;
    }
  }
  _vapid = { pub: k.pub, priv: await crypto.subtle.importKey("jwk", k.priv, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]) };
  return _vapid;
}

async function jwt(aud, priv) {
  const enc = o => b64u(new TextEncoder().encode(JSON.stringify(o)));
  const dati = enc({ typ: "JWT", alg: "ES256" }) + "." + enc({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: SUB });
  const firma = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, priv, new TextEncoder().encode(dati));
  return dati + "." + b64u(firma);
}

// Il telefono rimanda tutti i suoi orari futuri: si sostituiscono in blocco.
export async function sincronizza(env, endpoint, orari) {
  if (!env.DB || !endpointValido(endpoint)) return false;
  await schema(env.DB);
  const id = await sha(endpoint), now = Date.now();
  const at = [...new Set((orari || []).map(Number).filter(t => Number.isFinite(t) && t > now - 60e3 && t < now + ORIZZONTE)
    .map(t => Math.floor(t / 60e3) * 60e3))].sort((a, b) => a - b).slice(0, MAX_ORARI);
  const q = [
    env.DB.prepare("INSERT INTO push_sub (id, endpoint, agg) VALUES (?1, ?2, ?3) ON CONFLICT(id) DO UPDATE SET endpoint=?2, agg=?3").bind(id, endpoint, now),
    env.DB.prepare("DELETE FROM push_at WHERE id=?1").bind(id),
    ...at.map(t => env.DB.prepare("INSERT OR IGNORE INTO push_at (id, at) VALUES (?1, ?2)").bind(id, t))
  ];
  await env.DB.batch(q);
  return at.length;
}

export async function cancella(env, endpoint) {
  if (!env.DB || !endpoint) return;
  await schema(env.DB);
  const id = await sha(endpoint);
  await env.DB.batch([env.DB.prepare("DELETE FROM push_at WHERE id=?1").bind(id), env.DB.prepare("DELETE FROM push_sub WHERE id=?1").bind(id)]);
}

// Una push vuota: niente contenuto da cifrare, il service worker sa già cosa mostrare.
async function invia(endpoint, v) {
  const aud = new URL(endpoint).origin;
  return fetch(endpoint, { method: "POST", headers: {
    TTL: String(TTL), Urgency: "high", "Content-Length": "0",
    Authorization: "vapid t=" + (await jwt(aud, v.priv)) + ", k=" + v.pub } });
}

// Ogni minuto (cron): chi ha un orario arrivato riceve una push, poi gli
// orari passati si cancellano. Iscrizioni ferme da 30 giorni: via.
export async function inviaDovute(env) {
  if (!env.DB) return { inviate: 0 };
  await schema(env.DB);
  const now = Date.now();
  const { results } = await env.DB.prepare(
    "SELECT DISTINCT s.id, s.endpoint FROM push_at a JOIN push_sub s ON s.id=a.id WHERE a.at<=?1 AND a.at>?2 LIMIT 500"
  ).bind(now + 20e3, now - TTL * 1000).all();
  const v = results.length ? await vapid(env) : null;
  let inviate = 0;
  const morte = [];
  await Promise.all(results.map(async r => {
    try {
      const res = await invia(r.endpoint, v);
      if (res.status === 404 || res.status === 410) morte.push(r.id); else if (res.ok) inviate++;
    } catch (e) {}
  }));
  const q = [env.DB.prepare("DELETE FROM push_at WHERE at<=?1").bind(now + 20e3),
    env.DB.prepare("DELETE FROM push_sub WHERE agg<?1").bind(now - 30 * 86400e3)];
  morte.forEach(id => { q.push(env.DB.prepare("DELETE FROM push_at WHERE id=?1").bind(id)); q.push(env.DB.prepare("DELETE FROM push_sub WHERE id=?1").bind(id)); });
  await env.DB.batch(q);
  return { inviate, morte: morte.length };
}
