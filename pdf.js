// PDF dal foglio di stampa (#printSheet), scritto a mano, senza librerie.
// Serve su iPhone: lì window.print() dall'app aggiunta alla schermata Home non
// apre niente, e in Safari il PDF si raggiunge solo con un gesto nascosto
// nell'anteprima di stampa. Un file vero invece si condivide (Salva su File,
// WhatsApp, Stampa) dal pannello di iOS.
//
// Legge la struttura già costruita per la stampa — pagine calendario
// (section.pc: titolo, sottotitolo, griglia .pc-g, piede con QR) e la tabella
// giorno per giorno — e la ridisegna in A4 con i font standard del PDF
// (Helvetica), quindi niente font da incorporare e un file di pochi KB.

const PW = 595.28, PH = 841.89, M = 36;

// Larghezze di Helvetica (1/1000 em) per i caratteri 32–126, dalle metriche
// standard Adobe. Le lettere accentate misurano come quella base.
const WH = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,
  556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,
  667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,
  278,278,278,469,556,333,
  556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,
  334,260,334,584];
const BASE = { "à":"a","á":"a","è":"e","é":"e","ì":"i","í":"i","ò":"o","ó":"o","ù":"u","ú":"u",
  "À":"A","È":"E","É":"E","Ì":"I","Ò":"O","Ù":"U" };
// Caratteri fuori dall'ASCII nella codifica WinAnsi dei font standard.
const WIN = { "–":0x96, "—":0x97, "·":0xB7, "’":0x92, "‘":0x91, "“":0x93, "”":0x94, "€":0x80, "…":0x85,
  "«":0xAB, "»":0xBB, "°":0xB0 };

function larg(s, size, bold) {
  let w = 0;
  for (const ch of String(s)) {
    const c = (BASE[ch] || ch).charCodeAt(0);
    w += (c >= 32 && c <= 126) ? WH[c - 32] : 556;
  }
  return w * size / 1000 * (bold ? 1.06 : 1);
}
function enc(s) {
  let out = "";
  for (const ch of String(s).replace(/→/g, "–").replace(/\u00a0/g, " ")) {
    const c = ch.charCodeAt(0);
    if (ch === "(" || ch === ")" || ch === "\\") out += "\\" + ch;
    else if (c >= 32 && c <= 126) out += ch;
    else if (WIN[ch]) out += "\\" + WIN[ch].toString(8);
    else if (c >= 160 && c <= 255) out += "\\" + c.toString(8);
    else out += "?";
  }
  return out;
}
const n2 = v => (Math.round(v * 100) / 100).toString();

function documento() {
  const pagine = [];
  let cur = null;
  const d = {
    nuova() { cur = []; pagine.push(cur); },
    rett(x, y, w, h, o = {}) {
      const ops = [];
      if (o.lw) ops.push(n2(o.lw) + " w");
      if (o.fill != null) ops.push(n2(o.fill) + " g");
      if (o.stroke != null) ops.push(n2(o.stroke) + " G");
      ops.push(n2(x) + " " + n2(PH - y - h) + " " + n2(w) + " " + n2(h) + " re " +
        (o.fill != null && o.stroke != null ? "B" : o.fill != null ? "f" : "S"));
      cur.push(ops.join(" "));
    },
    testo(x, y, s, size, bold, grigio = 0) {
      cur.push("BT " + n2(grigio) + " g /" + (bold ? "F2" : "F1") + " " + n2(size) + " Tf " +
        n2(x) + " " + n2(PH - y) + " Td (" + enc(s) + ") Tj ET");
    },
    blob() {
      const obj = [];
      obj[1] = "<< /Type /Catalog /Pages 2 0 R >>";
      obj[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
      obj[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
      const kids = [];
      pagine.forEach((ops, i) => {
        const p = 5 + i * 2, c = p + 1, stream = ops.join("\n");
        obj[p] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + PW + " " + PH + "] " +
          "/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents " + c + " 0 R >>";
        obj[c] = "<< /Length " + stream.length + " >>\nstream\n" + stream + "\nendstream";
        kids.push(p + " 0 R");
      });
      obj[2] = "<< /Type /Pages /Kids [" + kids.join(" ") + "] /Count " + kids.length + " >>";
      // Tutto ASCII (i caratteri accentati sono scritti come \ottale): la
      // lunghezza della stringa è quella in byte, gli offset sono esatti.
      let out = "%PDF-1.4\n";
      const off = [];
      for (let i = 1; i < obj.length; i++) { off[i] = out.length; out += i + " 0 obj\n" + obj[i] + "\nendobj\n"; }
      const x = out.length;
      out += "xref\n0 " + obj.length + "\n0000000000 65535 f \n" +
        off.slice(1).map(o => String(o).padStart(10, "0") + " 00000 n \n").join("") +
        "trailer\n<< /Size " + obj.length + " /Root 1 0 R >>\nstartxref\n" + x + "\n%%EOF";
      return new Blob([out], { type: "application/pdf" });
    }
  };
  return d;
}

// Righe di testo di un elemento: <br> va a capo, <b> è grassetto.
function righe(el) {
  const out = [[]];
  (function giro(n, bold) {
    n.childNodes.forEach(c => {
      if (c.nodeType === 3) { const t = c.textContent.replace(/\s+/g, " "); if (t.trim()) out[out.length - 1].push({ t, bold }); }
      else if (c.nodeName === "BR") out.push([]);
      else if (c.nodeType === 1 && c.nodeName !== "svg") giro(c, bold || c.nodeName === "B");
    });
  })(el, false);
  return out.map(r => r.map(p => ({ ...p, t: p.t })).filter(p => p.t.trim())).filter(r => r.length);
}
// Va a capo entro "w": parole con il loro grassetto.
function aCapo(riga, w, size) {
  const parole = [];
  riga.forEach(p => p.t.split(/(\s+)/).forEach(t => { if (t.trim()) parole.push({ t, bold: p.bold }); }));
  const out = []; let cur = [], lw = 0;
  parole.forEach(p => {
    const pw = larg(p.t, size, p.bold), sp = cur.length ? larg(" ", size) : 0;
    if (cur.length && lw + sp + pw > w) { out.push(cur); cur = []; lw = 0; }
    cur.push(p); lw += (cur.length > 1 ? larg(" ", size) : 0) + pw;
  });
  if (cur.length) out.push(cur);
  return out;
}
function scriviRiga(d, x, y, riga, size, grigio) {
  let cx = x;
  riga.forEach((p, i) => { if (i) cx += larg(" ", size); d.testo(cx, y, p.t, size, p.bold, grigio); cx += larg(p.t, size, p.bold); });
}
function taglia(s, w, size, bold) {
  s = String(s).trim();
  if (larg(s, size, bold) <= w) return s;
  while (s.length > 1 && larg(s + "…", size, bold) > w) s = s.slice(0, -1);
  return s + "…";
}

function paginaCalendario(d, sec) {
  d.nuova();
  const h1 = sec.querySelector("h1"), sub = sec.querySelector(".ps-sub");
  let y = M + 16;
  d.testo(M, y, h1 ? h1.textContent : "", 20, true);
  y += 16;
  if (sub) { d.testo(M, y, sub.textContent.replace(/\s+/g, " ").trim(), 9, false, 0.3); }
  y += 14;
  const W = PW - 2 * M, cw = W / 7;
  const testa = [...sec.querySelectorAll(".pc-h")];
  testa.forEach((h, i) => {
    d.rett(M + i * cw, y, cw, 16, { fill: 0, stroke: 0, lw: 0.6 });
    d.testo(M + i * cw + 4, y + 11, h.textContent.toUpperCase(), 8, true, 1);
  });
  y += 16;
  const piede = sec.querySelector(".pc-piede"), hPiede = piede ? 92 : 0;
  const celle = [...sec.querySelectorAll(".pc-g")], nr = Math.ceil(celle.length / 7);
  const ch = Math.min(118, (PH - M - hPiede - y) / nr);
  celle.forEach((c, i) => {
    const x = M + (i % 7) * cw, cy = y + Math.floor(i / 7) * ch, cl = c.classList;
    const fill = cl.contains("pc-notte") ? 0.83 : cl.contains("pc-lavoro") ? 0.94 : null;
    d.rett(x, cy, cw, ch, { fill: fill == null ? 1 : fill, stroke: 0, lw: 0.6 });
    if (cl.contains("pc-oggi")) d.rett(x + 1, cy + 1, cw - 2, ch - 2, { stroke: 0, lw: 1.6 });
    const g = cl.contains("pc-pass") ? 0.62 : 0, wi = cw - 8;
    let ty = cy + 12;
    const parti = [...c.children];
    parti.forEach(p => {
      if (p.classList.contains("pc-s")) return;
      const num = p.classList.contains("pc-n"), b = p.nodeName === "B";
      const size = num ? 9 : b ? 10 : 8;
      if (b && !num) ty += 3;
      d.testo(x + 4, ty, taglia(p.textContent, wi, size, num || b), size, num || b, g || (num || b ? 0 : 0.15));
      ty += size + 3;
    });
    const s = c.querySelector(".pc-s");
    if (s) d.testo(x + 4, cy + ch - 6, taglia(s.textContent, wi, 8), 8, false, g || 0.15);
  });
  y += nr * ch + 12;
  if (piede) {
    let tx = M;
    const svg = piede.querySelector("svg");
    if (svg) {
      const vb = (svg.getAttribute("viewBox") || "0 0 1 1").split(/\s+/).map(Number), dim = vb[2] || 1, lato = 74, k = lato / dim;
      const path = (svg.querySelector("path") || {}).getAttribute ? svg.querySelector("path").getAttribute("d") : "";
      const re = /M(\d+),(\d+)h1v1h-1z/g; let m;
      while ((m = re.exec(path))) d.rett(M + (+m[1]) * k, y + (+m[2]) * k, k + 0.05, k + 0.05, { fill: 0 });
      tx = M + lato + 12;
    }
    const p = piede.querySelector("p");
    if (p) {
      let ly = y + 12;
      righe(p).forEach(r => aCapo(r, PW - M - tx, 8.5).forEach(l => { scriviRiga(d, tx, ly, l, 8.5, 0.2); ly += 11.5; }));
    }
  }
}

function paginaTabella(d, h1, sub, tab, foot) {
  const cols = [0.17, 0.2, 0.18, 0.17, 0.14, 0.14], W = PW - 2 * M;
  const xs = []; let acc = M; cols.forEach(c => { xs.push(acc); acc += c * W; });
  let y;
  const intesta = () => {
    d.nuova(); y = M + 14;
    if (h1) { d.testo(M, y, h1.textContent, 14, true); y += 14; }
    if (sub) { d.testo(M, y, sub.textContent.replace(/\s+/g, " ").trim(), 9, false, 0.3); y += 10; }
    y += 6;
    const th = [...tab.querySelectorAll("thead th")];
    d.rett(M, y, W, 16, { fill: 0 });
    th.forEach((t, i) => d.testo(xs[i] + 4, y + 11, t.textContent, 8, true, 1));
    y += 16;
  };
  intesta();
  [...tab.querySelectorAll("tbody tr")].forEach(tr => {
    const celle = [...tr.children].map(td => righe(td));
    const n = Math.max(1, ...celle.map(r => r.length)), h = n * 9.2 + 5;
    if (y + h > PH - M - 20) intesta();
    if (tr.classList.contains("oggi")) d.rett(M, y, W, h, { fill: 0.92 });
    celle.forEach((r, i) => r.forEach((l, j) => {
      const w = cols[i] * W - 8;
      scriviRiga(d, xs[i] + 4, y + 10.5 + j * 9.2, l.map(p => ({ ...p, t: taglia(p.t, w, 8.5, p.bold) })), 8.5, 0);
    }));
    d.rett(M, y + h, W, 0.01, { stroke: 0.75, lw: 0.4 });
    y += h;
  });
  if (foot) d.testo(M, Math.min(y + 16, PH - M), foot.textContent.replace(/\s+/g, " ").trim(), 7.5, false, 0.35);
}

// Il foglio #printSheet già costruito → Blob PDF.
export function pdfDaFoglio(el) {
  const d = documento();
  const figli = [...el.children];
  for (let i = 0; i < figli.length; i++) {
    const f = figli[i];
    if (f.matches("section.pc")) { paginaCalendario(d, f); continue; }
    if (f.matches("table")) {
      const prima = figli.slice(0, i).reverse();
      const h1 = prima.find(x => x.matches("h1")), sub = prima.find(x => x.matches(".ps-sub"));
      const foot = figli.slice(i + 1).find(x => x.matches(".ps-foot"));
      paginaTabella(d, h1, sub, f, foot);
    }
  }
  return d.blob();
}
