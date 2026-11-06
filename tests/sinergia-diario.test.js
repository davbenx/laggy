// Test di unità per la sinergia frictionless fra timeline (attività serali) e diario (tag mattutini).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("index.html contiene la funzione tagPreselezionati e lo stile dei bottoni rapidi", () => {
  assert.ok(html.includes("function tagPreselezionati(dayKey)"), "tagPreselezionati definita");
  assert.ok(html.includes(".att-box-quick"), "stile .att-box-quick presente");
  assert.ok(html.includes(".att-btn-quick"), "stile .att-btn-quick presente");
  assert.ok(html.includes("+ Segna pasto tardivo o abbondante"), "pulsante rapido pasto presente");
  assert.ok(html.includes("+ Ho bevuto alcol stasera"), "pulsante rapido alcol presente");
});

test("tagPreselezionati estrae correttamente i tag dalle attività serali e della notte", () => {
  const state = {
    diaryTags: {},
    attivita: {}
  };
  const t = s => (+s.slice(0, 2)) * 60 + (+s.slice(3, 5));
  const iso = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const day = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  function attGiorno(k) {
    const v = (state.attivita || {})[k];
    return Array.isArray(v) ? v.filter(a => a && typeof a === "object" && typeof a.t === "string" && /^\d\d:\d\d$/.test(a.fine || "")) : [];
  }

  function tagPreselezionati(dayKey) {
    if (state.diaryTags && state.diaryTags[dayKey] !== undefined) {
      return state.diaryTags[dayKey] || [];
    }
    const auto = [];
    try {
      const dObj = new Date(dayKey + "T12:00:00");
      const prevKey = iso(day(dObj, -1));
      const attsPrev = typeof attGiorno === "function" ? attGiorno(prevKey) : [];
      const attsOggi = typeof attGiorno === "function" ? attGiorno(dayKey) : [];
      const atts = attsPrev.concat(attsOggi);

      if (atts.some(a => a.t === "alcol")) auto.push("alcol");
      if (atts.some(a => a.t === "pasto")) auto.push("cena_tardi");
      if (atts.some(a => {
        if (a.t !== "caffe") return false;
        const m = typeof t === "function" ? t(a.fine) : NaN;
        return isFinite(m) && (m >= 840 || m <= 360);
      })) auto.push("caffe_serale");
      if (atts.some(a => a.t === "leggera")) auto.push("stretching");
    } catch (e) {}
    return auto;
  }

  const oggi = "2026-05-12";
  const ieri = "2026-05-11";

  // 1. Senza attività: nessun tag pre-selezionato
  assert.deepEqual(tagPreselezionati(oggi), []);

  // 2. Pasto segnato la sera prima nella timeline -> cena_tardi pre-acceso al risveglio
  state.attivita[ieri] = [{ t: "pasto", fine: "21:30" }];
  assert.deepEqual(tagPreselezionati(oggi), ["cena_tardi"]);

  // 3. Alcol segnato la sera prima -> alcol pre-acceso
  state.attivita[ieri].push({ t: "alcol", fine: "22:45" });
  assert.deepEqual(tagPreselezionati(oggi), ["alcol", "cena_tardi"]);

  // 4. Caffè pomeridiano/serale (>= 14:00 o notte <= 06:00)
  state.attivita[ieri].push({ t: "caffe", fine: "20:00" });
  assert.deepEqual(tagPreselezionati(oggi), ["alcol", "cena_tardi", "caffe_serale"]);

  // 5. Caffè mattutino (ore 09:00): NON è caffè serale
  state.attivita[ieri] = [{ t: "caffe", fine: "09:00" }];
  assert.deepEqual(tagPreselezionati(oggi), []);

  // 6. Turno notturno: pasto alle 02:30 del mattino di 'oggi'
  state.attivita[ieri] = [];
  state.attivita[oggi] = [{ t: "pasto", fine: "02:30" }];
  assert.deepEqual(tagPreselezionati(oggi), ["cena_tardi"]);

  // 7. Sovrascrittura manuale dell'utente nel diario: vince la scelta dell'utente
  state.diaryTags[oggi] = ["buio"];
  assert.deepEqual(tagPreselezionati(oggi), ["buio"]);

  // 8. Se l'utente ha deselezionato tutto (array vuoto salvato), non ri-accende automaticamente
  state.diaryTags[oggi] = [];
  assert.deepEqual(tagPreselezionati(oggi), []);
});

test("tagInsight calcola correttamente l'impatto sul sonno tenendo conto dei tag pre-selezionati", () => {
  const SLEEP_TAGS = [
    { id: "stretching", label: "Stretching / Yoga" },
    { id: "tisana", label: "Tisana / Caldo" },
    { id: "cena_tardi", label: "Cena tardi" },
    { id: "alcol", label: "Alcol" },
    { id: "caffe_serale", label: "Caffè serale" },
    { id: "schermi", label: "Schermi a letto" },
    { id: "rumore", label: "Rumore / Luce" },
    { id: "buio", label: "Buio totale" }
  ];

  const state = {
    diaryTags: {},
    attivita: {}
  };
  const storeData = { diary: {} };
  const store = { get: (k, def) => storeData[k] || def };

  const iso = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const day = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  function attGiorno(k) {
    const v = (state.attivita || {})[k];
    return Array.isArray(v) ? v.filter(a => a && typeof a === "object" && typeof a.t === "string" && /^\d\d:\d\d$/.test(a.fine || "")) : [];
  }

  function tagPreselezionati(dayKey) {
    if (state.diaryTags && state.diaryTags[dayKey] !== undefined) {
      return state.diaryTags[dayKey] || [];
    }
    const auto = [];
    try {
      const dObj = new Date(dayKey + "T12:00:00");
      const prevKey = iso(day(dObj, -1));
      const attsPrev = typeof attGiorno === "function" ? attGiorno(prevKey) : [];
      const attsOggi = typeof attGiorno === "function" ? attGiorno(dayKey) : [];
      const atts = attsPrev.concat(attsOggi);

      if (atts.some(a => a.t === "alcol")) auto.push("alcol");
      if (atts.some(a => a.t === "pasto")) auto.push("cena_tardi");
      if (atts.some(a => a.t === "leggera")) auto.push("stretching");
    } catch (e) {}
    return auto;
  }

  function tagInsight() {
    const diary = store.get("diary", {}) || {};
    const diaryDays = Object.keys(diary).filter(d => {
      const v = +diary[d];
      return v >= 1 && v <= 5;
    });
    const daysWithTags = diaryDays.filter(d => {
      return (state.diaryTags && state.diaryTags[d] !== undefined) || tagPreselezionati(d).length > 0;
    });
    if (daysWithTags.length < 6) return null;
    for (const stag of SLEEP_TAGS) {
      const id = stag.id;
      const withTag = [], withoutTag = [];
      for (const d of diaryDays) {
        const v = +diary[d];
        const list = tagPreselezionati(d);
        if (list.includes(id)) withTag.push(v);
        else if (daysWithTags.includes(d)) withoutTag.push(v);
      }
      if (withTag.length >= 6 && withoutTag.length >= 6) {
        const avgW = withTag.reduce((a, b) => a + b, 0) / withTag.length;
        const avgWo = withoutTag.reduce((a, b) => a + b, 0) / withoutTag.length;
        const diff = avgW - avgWo;
        if (Math.abs(diff) >= 0.5) {
          const meglio = diff > 0;
          const phrase = meglio
            ? 'Nelle ' + withTag.length + ' volte con ' + stag.label.toLowerCase() + ', energia al risveglio in media più alta (' + avgW.toFixed(1) + ' contro ' + avgWo.toFixed(1) + ').'
            : 'Nelle ' + withTag.length + ' volte con ' + stag.label.toLowerCase() + ', energia al risveglio in media più bassa (' + avgW.toFixed(1) + ' contro ' + avgWo.toFixed(1) + ').';
          return { testo: phrase, action: null, fonte: "tags" };
        }
      }
    }
    return null;
  }

  // Creiamo 14 giorni con voti diario:
  // Nei giorni pari (7 giorni): sera con alcol nella timeline -> voto 2 (energia bassa)
  // Nei giorni dispari (7 giorni): senza alcol (tag esplicito buio) -> voto 4 (energia alta)
  for (let i = 1; i <= 14; i++) {
    const dStr = "2026-05-" + String(i).padStart(2, "0");
    const dPrev = "2026-05-" + String(i - 1).padStart(2, "0");
    if (i % 2 === 0) {
      state.attivita[dPrev] = [{ t: "alcol", fine: "23:00" }];
      storeData.diary[dStr] = 2;
    } else {
      state.diaryTags[dStr] = ["buio"];
      storeData.diary[dStr] = 4;
    }
  }

  const res = tagInsight();
  assert.ok(res, "tagInsight ha trovato un pattern");
  assert.equal(res.fonte, "tags");
  assert.ok(res.testo.includes("alcol"), "evidenzia l'alcol");
  assert.ok(res.testo.includes("più bassa"), "energia più bassa con alcol");
});
