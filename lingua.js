// lingua.js — l'unico punto in cui il codice sa in che lingua e con che
// formato scrive date e giorni. Oggi solo italiano: serve a non avere il
// formato sparso in decine di righe il giorno in cui arriverà un'altra lingua
// (lì cambierà solo questo file, e il resto lo seguirà).
export const LINGUA = "it-IT";

const maiusc = s => s.charAt(0).toUpperCase() + s.slice(1);

// Una data come la vuole l'opzione Intl (giorno, mese, anno, giorno della settimana).
export const fmtData = (d, opzioni) => d.toLocaleDateString(LINGUA, opzioni);

// Nomi brevi dei giorni, da domenica (come Date.getDay()) o da lunedì.
// "dom, lun…" in minuscolo, oppure "Dom, Lun…" con maiuscola=true.
export function giorniBrevi({ daLunedi = false, maiuscola = false } = {}) {
  const domenica = new Date(2024, 0, 7, 12);           // una domenica qualsiasi
  const out = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(domenica); d.setDate(d.getDate() + i + (daLunedi ? 1 : 0));
    const g = d.toLocaleDateString(LINGUA, { weekday: "short" }).replace(/\.$/, "");
    out.push(maiuscola ? maiusc(g) : g);
  }
  return out;
}

// Nomi brevi dei mesi, da gennaio: "gen, feb…".
export function mesiBrevi() {
  const out = [];
  for (let m = 0; m < 12; m++) out.push(new Date(2024, m, 15).toLocaleDateString(LINGUA, { month: "short" }).replace(/\.$/, ""));
  return out;
}
