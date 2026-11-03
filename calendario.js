/* Notturnisti — il calendario del ciclo, a mese come un calendario da muro.
   Le stesse regole del widget Android (CalendarioModel.java), in JS per chi non ha il widget: settimane dal lunedì,
   il mese intero dalla settimana del giorno 1, le frecce vanno di mese in mese. Se le righe non bastano per tutto il
   mese di oggi, si parte dalla settimana di oggi (le settimane passate servono meno). Solo conti sulle date, niente DOM:
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
/** Il mese (anno, 1-12) spostato di `mesi` mesi. */
export function meseSpostato(anno, mese, mesi) { const t = anno * 12 + (mese - 1) + mesi; return [Math.floor(t / 12), ((t % 12) + 12) % 12 + 1]; }
/** Le settimane (righe) del mese nei dati che cominciano da `da`: [prima, ultima], o null se il mese non c'è. */
export function righeMese(da, giorni, anno, mese) {
  const ultimo = new Date(anno, mese, 0).getDate(), iso = g => anno + "-" + String(mese).padStart(2, "0") + "-" + String(g).padStart(2, "0");
  let a = indiceDi(da, giorni, iso(1)), z = indiceDi(da, giorni, iso(ultimo));
  if (a < 0 && z < 0) return null;
  if (a < 0) a = 0; if (z < 0) z = giorni - 1;
  return [Math.floor(a / 7), Math.floor(z / 7)];
}
/** Prima riga per mostrare il mese con `righe` righe: la settimana del giorno 1; se il mese di oggi non entra tutto, la settimana di oggi. */
export function primaRigaMese(rm, rigaOggi, meseDiOggi, righe, settimane) {
  let r = rm[0];
  if (rm[1] - rm[0] + 1 > righe && meseDiOggi && rigaOggi >= 0) r = Math.max(rm[0], Math.min(rigaOggi, rm[1] - righe + 1));
  return Math.max(0, Math.min(Math.max(0, settimane - righe), r));
}
/** «Novembre», o «Gennaio 2027» se non è l'anno di oggi. */
export function titoloMese(anno, mese, annoOggi) { return MESI[mese - 1] + (anno !== annoOggi ? " " + anno : ""); }
