/* Notturnisti — il calendario a settimane del ciclo.
   Le stesse regole del widget Android (CalendarioModel.java), in JS per chi non ha il widget: settimane dal lunedì,
   ogni settimana appartiene al mese del suo giovedì (come le settimane ISO), le frecce fanno una pagina ma si
   agganciano all'inizio del mese se è più vicino (mai una settimana saltata). Solo conti sulle date, niente DOM:
   si prova con node. I dati (sigle e tipi dei giorni) arrivano già calcolati dal motore, qui non si calcolano turni. */

export const MESI = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

const mezzogiorno = iso => { const [a, m, g] = iso.split("-").map(Number); return new Date(a, m - 1, g, 12, 0, 0); };
export const isoDi = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

/** Il giorno i-esimo dei dati che cominciano da `da` (un lunedì, «2026-10-19»): {anno, mese 1-12, giorno, iso}. */
export function dataDi(da, i) {
  const d = mezzogiorno(da); d.setDate(d.getDate() + i);
  return { anno: d.getFullYear(), mese: d.getMonth() + 1, giorno: d.getDate(), iso: isoDi(d) };
}
/** Posizione nei dati di una data («2026-10-24»), o -1 se è fuori. */
export function indiceDi(da, giorni, iso) {
  const i = Math.round((mezzogiorno(iso) - mezzogiorno(da)) / 86400000);
  return i >= 0 && i < giorni ? i : -1;
}
/** Mese (anno, 1-12) della settimana nella riga: quello del suo giovedì. */
export function meseDellaRiga(da, riga) { const d = dataDi(da, riga * 7 + 3); return [d.anno, d.mese]; }
/** «Ottobre», o «Gennaio 2027» se non è l'anno di oggi. */
export function titolo(da, riga, annoOggi) {
  const [a, m] = meseDellaRiga(da, riga);
  return MESI[m - 1] + (a !== annoOggi ? " " + a : "");
}
/** La riga è la prima settimana di un mese. */
export function inizioMese(da, riga) {
  if (riga <= 0) return false;
  const a = meseDellaRiga(da, riga - 1), b = meseDellaRiga(da, riga);
  return a[0] !== b[0] || a[1] !== b[1];
}
/** Prima riga mostrata: la settimana di oggi spostata di `spostamento` settimane, senza uscire dai dati. */
export function primaRiga(rigaOggi, spostamento, righe, settimane) {
  const massimo = Math.max(0, settimane - righe);
  return Math.max(0, Math.min(massimo, Math.max(rigaOggi, 0) + spostamento));
}
/**
 * Lo spostamento dopo un tocco su ‹ (-1) o › (+1): una pagina intera, o l'inizio del mese se è più vicino. Così nei
 * calendari alti le frecce sono il mese prima e dopo, e in quelli bassi non si salta mai una settimana.
 */
export function paginaDopo(da, settimane, rigaOggi, spostamento, righe, verso) {
  const massimo = Math.max(0, settimane - righe);
  const attuale = primaRiga(rigaOggi, spostamento, righe, settimane);
  let passo = righe;
  if (verso > 0) { for (let r = attuale + 1; r < attuale + righe; r++) if (inizioMese(da, r)) { passo = r - attuale; break; } }
  else { for (let r = attuale - 1; r > attuale - righe && r > 0; r--) if (inizioMese(da, r)) { passo = attuale - r; break; } }
  const nuova = Math.max(0, Math.min(massimo, attuale + (verso > 0 ? passo : -passo)));
  return nuova - Math.max(rigaOggi, 0);
}
