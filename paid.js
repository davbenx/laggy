/* paid.js — modulo del calendario automatico (nome storico, non più "a
   pagamento": Notturnisti è gratis per chiunque). Dialoga col core via
   window.NT, e con lo storico via NTHistory. Un accesso gratuito, creato al
   primo tocco, sblocca calendario vivo, griglia turni, coppia e storico —
   nessun pagamento richiesto. Sostenere il progetto (Ko-fi, window.NT_DONATE)
   è un modo per chi vuole ricambiare, mai una condizione. Config: window.NT_CAL
   = { api }. */
(function () {
  "use strict";
  var CAL = Object.assign({ api: "" }, window.NT_CAL || {});
  var KEY = "nt:sub";
  var $ = function (s, r) { return (r || document).querySelector(s); };

  // ── entitlement locale ──
  function getSub() { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; } }
  function setSub(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  function clearSub() { try { localStorage.removeItem(KEY); } catch (e) {} }
  function paid() { var s = getSub(); return !!(s && s.id && s.writeKey); }

  // ── API ──
  function api(method, path, body, writeKey) {
    var h = { "content-type": "application/json" };
    if (writeKey) h["x-write-key"] = writeKey;
    return fetch(CAL.api + path, { method: method, headers: h, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, status: r.status, data: j }; }, function () { return { ok: r.ok, status: r.status, data: {} }; }); });
  }
  function paramsObj() { return Object.fromEntries(new URLSearchParams(window.NT.read().params)); }
  function donateUrl() { try { return (window.NT_DONATE && window.NT_DONATE.url) || ""; } catch (e) { return ""; } }

  // ── stile ──
  function css() {
    if ($("#pf-style")) return;
    var s = document.createElement("style"); s.id = "pf-style";
    s.textContent =
      "#pf-open{display:inline-flex;align-items:center;gap:6px;background:var(--blue);color:#fff;border:none;" +
      "border-radius:var(--r);padding:11px 16px;font:inherit;font-weight:600;font-size:14px;cursor:pointer;min-height:44px;margin-top:10px}" +
      ".pf-modal{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center;z-index:9999}" +
      "@media(min-width:560px){.pf-modal{align-items:center}}" +
      ".pf-card{background:var(--bg);color:var(--ink);width:100%;max-width:560px;max-height:92vh;overflow:auto;" +
      "border-radius:16px 16px 0 0;padding:20px}@media(min-width:560px){.pf-card{border-radius:16px}}" +
      ".pf-x{float:right;background:none;border:none;color:var(--dim);font-size:22px;cursor:pointer;line-height:1;padding:4px 8px}" +
      ".pf-h{font-family:var(--serif);font-size:20px;margin:0 0 4px}.pf-p{color:var(--dim);font-size:14px;line-height:1.55;margin:8px 0}" +
      ".pf-nav{display:flex;gap:6px;flex-wrap:wrap;margin:14px 0}.pf-nav button{flex:1;min-width:96px;background:var(--s2);border:1px solid var(--line);" +
      "color:var(--ink);border-radius:var(--r);padding:9px;font:inherit;font-size:13px;font-weight:600;cursor:pointer;min-height:40px}" +
      ".pf-nav button.on{background:var(--bg);color:var(--blue);border-color:var(--blue-lt)}" +
      ".pf-btn{background:var(--blue);color:#fff;border:none;border-radius:var(--r);padding:12px 16px;font:inherit;font-weight:600;cursor:pointer;min-height:46px;width:100%}" +
      ".pf-lnk{display:block;background:var(--blue-soft);border:1px solid var(--blue-lt);border-radius:var(--r);padding:12px 14px;color:var(--blue);text-decoration:none;font-weight:600;margin:10px 0;word-break:break-all}" +
      ".pf-in{width:100%;padding:11px;border:1px solid var(--line);border-radius:var(--r);background:var(--s1);color:var(--ink);font:inherit;margin:6px 0}" +
      ".pf-note{font-size:12.5px;color:var(--faint);line-height:1.5;margin:8px 0}" +
      ".pf-danger{background:none;border:none;color:#c0392b;text-decoration:underline;cursor:pointer;font:inherit;font-size:13px;padding:6px 0}" +
      ".pf-save{background:var(--s1);border:1px solid var(--line);border-radius:var(--r);padding:14px;margin:14px 0}.pf-save b{display:block;margin-bottom:2px}" +
      ".pf-lnk2{display:block;width:100%;background:none;border:1px solid var(--line);border-radius:var(--r);padding:11px;color:var(--blue);font:inherit;font-weight:600;cursor:pointer;margin-top:8px}";
    document.head.appendChild(s);
  }

  // ── modale ──
  var screen = "account";
  function open(to) { css(); screen = to || (paid() ? "account" : "attiva"); if (!$("#pf-modal")) mount(); paint(); }
  function close() { var m = $("#pf-modal"); if (m) m.remove(); }
  function mount() {
    var m = document.createElement("div"); m.className = "pf-modal"; m.id = "pf-modal";
    m.innerHTML = '<div class="pf-card"><button class="pf-x" id="pf-close">×</button><div id="pf-body"></div></div>';
    m.addEventListener("click", function (e) { if (e.target === m) close(); });
    document.body.appendChild(m);
    $("#pf-close").onclick = close;
  }
  function nav() {
    if (!paid()) return "";
    var items = [["account", "Calendario"], ["couple", "Coppia"]];
    return '<div class="pf-nav">' + items.map(function (x) {
      return '<button data-pf-nav="' + x[0] + '"' + (screen === x[0] ? ' class="on"' : '') + '>' + x[1] + '</button>';
    }).join("") + '</div>';
  }
  function paint() {
    var b = $("#pf-body"); if (!b) return;
    var body = paid() ? ({ account: scAccount, couple: scCouple }[screen] || scAccount)()
                      : scAttiva();
    b.innerHTML = nav() + body;
    var nb = b.querySelectorAll("[data-pf-nav]");
    nb.forEach(function (el) { el.onclick = function () { screen = el.getAttribute("data-pf-nav"); paint(); }; });
    wire();
  }

  // ── schermate ──
  function scAttiva() {
    var url = donateUrl();
    return '<h2 class="pf-h">Il calendario che si aggiorna da solo</h2>' +
      '<p class="pf-p">Gratis, per chiunque. Turni, sonno, ultimo caffè — anche quello di coppia se lo usi con qualcuno — scritti da soli nel calendario del telefono, aggiornati ogni volta che cambi qualcosa qui. Lo attivi una volta, poi non ci pensi più.</p>' +
      '<button class="pf-btn" id="pf-activate" type="button">Attiva il calendario →</button>' +
      '<p class="pf-note" id="pf-activate-status" style="display:none"></p>' +
      (url ? '<p class="pf-note">L\'app è gratis e lo resta. Se vuoi <a href="' + url + '" target="_blank" rel="noopener" style="color:var(--blue)">offrire un caffè</a>, è benvenuto ma mai necessario.</p>' : '') +
      '<p class="pf-note">Hai già attivato il calendario su un altro dispositivo? <button class="pf-danger" id="pf-restore" style="color:var(--blue)">Ripristina</button></p>' +
      '<div id="pf-restore-box" hidden><input class="pf-in" id="pf-rid" placeholder="id"><input class="pf-in" id="pf-rkey" placeholder="chiave di scrittura">' +
      '<button class="pf-btn" id="pf-rgo">Ripristina l\'accesso</button></div>';
  }
  function scAccount() {
    var s = getSub();
    var feed = s.feedUrl || "";
    var https = feed.replace(/^webcal/, "https");
    var url = donateUrl();
    // Il link di ripristino contiene la writeKey — non lo rendiamo mai navigabile
    // (href) per evitare che finisca in cronologia browser, preview WhatsApp,
    // iCloud Backup URL, ecc. Solo copia-clipboard e download .txt.
    var restoreText = restoreLink(s);
    return '<h2 class="pf-h">Il tuo calendario</h2>' +
      '<p class="pf-p">Iscrivi il calendario del telefono a questo indirizzo. Da lì in poi si aggiorna da solo.</p>' +
      '<a class="pf-lnk" id="pf-sub" href="' + feed + '">Aggiungi al calendario (iPhone/Mac) →</a>' +
      '<p class="pf-note"><b>Android / Google:</b> apri Google Calendar sul web → Altri calendari → <b>Da URL</b> → incolla:<br>' + https + '</p>' +
      '<p class="pf-note">L\'aggiornamento non è istantaneo: ogni calendario decide da sé ogni quanto ricontrollare (spesso qualche ora, a volte un giorno intero) — non dipende da noi, e da qui non c\'è modo di farlo controllare più spesso.</p>' +
      '<button class="pf-btn" id="pf-sync" style="margin-top:12px">Sincronizza i turni di adesso</button>' +
      '<p class="pf-note">Aggiorna il feed con la configurazione attuale del pianificatore.</p>' +
      '<p class="pf-note" style="margin-top:16px">La tua configurazione dei turni è salvata sul nostro server per far ruotare il calendario. Non salviamo il diario. ' +
      '<button class="pf-danger" id="pf-del">Cancella tutto</button></p>' +
      '<div style="border-top:1px solid var(--line);margin-top:16px;padding-top:14px">' +
      '<p class="pf-p" style="margin-top:0"><b>Salva questo accesso.</b> Con questo link riattivi tutto su un altro telefono, senza email. Tienilo privato: è la tua chiave.</p>' +
      '<code class="pf-lnk" id="pf-rlink" style="word-break:break-all;user-select:all;cursor:text;display:block;padding:8px;background:var(--s2);border-radius:6px">' + restoreText + '</code>' +
      '<button class="pf-btn" id="pf-copy">Copia il link</button>' +
      '<button class="pf-btn" id="pf-dl" style="margin-top:8px;background:var(--s2);color:var(--ink);border:1px solid var(--line)">Scarica come file .txt</button>' +
      '</div>' +
      (url ? '<p class="pf-note" style="margin-top:16px">Notturnisti è gratis, e lo resta. Se ti è utile, <a href="' + url + '" target="_blank" rel="noopener" style="color:var(--blue)">offrimi un caffè</a> — mai necessario, sempre benvenuto.</p>' : '');
  }
  function scCouple() {
    var r = window.NT.read();
    var s = getSub();
    var coupleUrl = (s.feedUrl || "").replace("/feed/", "/couple/");
    var https = coupleUrl.replace(/^webcal/, "https");
    if (!r.pPattern)
      return '<h2 class="pf-h">Calendario di coppia</h2>' +
        '<p class="pf-p">Il partner si imposta una volta sola, nella scheda <b>Quando sono disponibile → Aggiungi una persona</b>. ' +
        'Da lì i vostri riposi in comune arrivano anche qui, come calendario da iscrivere che si aggiorna da solo.</p>';
    return '<h2 class="pf-h">Calendario di coppia</h2>' +
      '<p class="pf-p">Partner impostato. Iscrivi questo calendario: mostra i <b>riposi in comune</b> nei prossimi 60 giorni e si aggiorna da solo.</p>' +
      '<a class="pf-lnk" id="pf-csub" href="' + coupleUrl + '">Aggiungi il calendario di coppia →</a>' +
      '<p class="pf-note">Android/Google: <b>Da URL</b> →<br>' + https + '</p>' +
      '<p class="pf-note">Come sopra: l\'aggiornamento non è istantaneo, lo decide il calendario che usi, non c\'è modo di forzarlo da qui.</p>' +
      '<button class="pf-btn" id="pf-couple-sync">Sincronizza il partner</button>' +
      '<p class="pf-note">Aggiorna il feed con la sequenza del partner impostata in Turni.</p>';
  }

  // ── azioni ──
  function wire() {
    var b = $("#pf-body"); if (!b) return;
    // attivazione + restore
    if ($("#pf-activate")) $("#pf-activate").onclick = attiva;
    var rb = $("#pf-restore"); if (rb) rb.onclick = function () { var x = $("#pf-restore-box"); x.hidden = !x.hidden; };
    var rgo = $("#pf-rgo"); if (rgo) rgo.onclick = function () {
      var id = ($("#pf-rid").value || "").trim(), key = ($("#pf-rkey").value || "").trim();
      if (!id || !key) return;
      api("GET", "/config/" + encodeURIComponent(id), null, key).then(function (r) {
        if (r.ok) { setSub({ id: id, writeKey: key, feedUrl: feedFromId(id) }); screen = "account"; paint();
          try { if (window.render) window.render(); } catch (e) {} }
        else toast("Credenziali non valide");
      });
    };
    // account
    var sync = $("#pf-sync"); if (sync) sync.onclick = function () {
      var s = getSub();
      api("PUT", "/config/" + s.id, { cfg: paramsObj() }, s.writeKey).then(function (r) { toast(r.ok ? "Turni sincronizzati" : "Errore di sincronizzazione"); });
    };
    // Nessun confirm() bloccante — coerente con lo stile del resto dell'app.
    // Qui però l'azione è irreversibile lato server (a differenza di una
    // rimozione locale, non si può "annullare dopo" con uno snapshot): primo
    // tocco arma il bottone con un'etichetta esplicita, la cancellazione
    // vera parte solo al secondo tocco entro pochi secondi.
    var del = $("#pf-del"); if (del) del.onclick = function () {
      if (!del.dataset.armed) {
        del.dataset.armed = "1"; del.dataset.testo = del.textContent;
        del.textContent = "Tocca di nuovo per confermare";
        clearTimeout(del._armTimer);
        del._armTimer = setTimeout(function () {
          delete del.dataset.armed; del.textContent = del.dataset.testo;
        }, 4000);
        return;
      }
      clearTimeout(del._armTimer); delete del.dataset.armed; del.textContent = del.dataset.testo;
      var s = getSub(); api("DELETE", "/config/" + s.id, null, s.writeKey).then(function () { clearSub(); screen = "attiva"; paint(); toast("Cancellato"); });
    };
    var cp = $("#pf-copy"); if (cp) cp.onclick = function () { copyText(restoreLink(getSub())); };
    var dl = $("#pf-dl"); if (dl) dl.onclick = function () {
      var s = getSub();
      downloadTxt("notturnisti-accesso.txt",
        "Notturnisti — il tuo accesso (tienilo privato)\n\n" +
        "Link di ripristino (aprilo su un altro dispositivo per riattivare):\n" + restoreLink(s) + "\n\n" +
        "Iscrizione calendario:\n" + (s.feedUrl || "") + "\n\n" +
        "id: " + s.id + "\nchiave: " + s.writeKey + "\n");
    };
    // couple
    var csync = $("#pf-couple-sync"); if (csync) csync.onclick = function () {
      var s = getSub(); if (!s) return;
      api("PUT", "/config/" + s.id, { cfg: paramsObj() }, s.writeKey).then(function (r) {
        toast(r.ok ? "Partner sincronizzato" : "Errore di sincronizzazione");
      });
    };
  }

  function feedFromId(id) { return location.origin.replace(/^https?/, "webcal") + "/feed/" + id; }
  // Il fragment (#) non viene mai inviato al server: a differenza di una query
  // string, non finisce nei log di accesso di Cloudflare/proxy intermedi né,
  // se l'utente preme Invio sulla barra indirizzi, nella cronologia del
  // browser. Per un link che contiene la chiave di scrittura dell'account è
  // l'unica forma sicura.
  function restoreLink(s) { return location.origin + location.pathname + "#restore=" + s.id + "." + s.writeKey; }
  function copyText(txt) {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function () { toast("Link copiato"); }, function () { prompt("Copia il link:", txt); });
    else prompt("Copia il link:", txt);
  }
  function downloadTxt(name, text) {
    try {
      var blob = new Blob([text], { type: "text/plain" }), url = URL.createObjectURL(blob);
      var a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click();
      setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
    } catch (e) {}
  }
  function cleanUrl() {
    try {
      var u = new URL(location.href);
      u.searchParams.delete("restore");
      if (/^#restore=/.test(u.hash)) u.hash = "";
      history.replaceState(null, "", u.pathname + u.search + u.hash);
    } catch (e) {}
  }
  function autoRestore() {
    var tok;
    try {
      // Fragment prima (nuovo formato, mai inviato al server); la query
      // string resta come fallback di lettura solo per i link già generati
      // prima di questa modifica, così non si rompono per chi li ha salvati.
      var h = location.hash || "";
      if (/^#restore=/.test(h)) tok = decodeURIComponent(h.slice("#restore=".length));
      else tok = new URLSearchParams(location.search).get("restore");
    } catch (e) { return; }
    if (!tok) return;
    var i = tok.indexOf("."); if (i < 1) { cleanUrl(); return; }
    var id = tok.slice(0, i), key = tok.slice(i + 1); if (!id || !key) { cleanUrl(); return; }
    api("GET", "/config/" + encodeURIComponent(id), null, key).then(function (r) {
      if (r.ok) { setSub({ id: id, writeKey: key, feedUrl: feedFromId(id) }); var b = $("#pf-open"); if (b) b.textContent = "Il mio calendario"; toast("Accesso ripristinato"); }
      cleanUrl();
    });
  }

  function setStatus(msg) { var s = $("#pf-activate-status"); if (s) { s.textContent = msg; s.style.display = msg ? "block" : "none"; } }

  // Crea l'accesso gratuito al volo — nessun checkout, nessuna attesa di
  // conferma esterna: il server risponde direttamente con le credenziali.
  function attiva() {
    setStatus("Attivo il calendario…");
    api("POST", "/account", { cfg: paramsObj() }).then(function (r) {
      if (!r.ok || !r.data || !r.data.id) { setStatus("Non riesco ad attivare il calendario adesso — riprova."); return; }
      setSub({ id: r.data.id, writeKey: r.data.writeKey, feedUrl: r.data.feedUrl });
      setStatus(""); screen = "account"; paint();
      try { if (window.render) window.render(); } catch (e) {}
      toast("Attivato — buon turno.");
    }, function () { setStatus("Non riesco ad attivare il calendario adesso — riprova."); });
  }

  function toast(t) {
    try {
      var d = document.querySelector("#toast") || document.querySelector(".toast");
      if (d) {
        d.textContent = t;
        // assegna direttamente per evitare accumulo "show show show..." in sessioni lunghe
        d.className = "toast show";
        clearTimeout(toast._tid);
        toast._tid = setTimeout(function () { d.className = "toast"; }, 2200);
      }
    } catch (e) {}
  }

  // ── lancio ──
  function launcher() {
    if ($("#pf-open")) return;
    css();
    var b = document.createElement("button"); b.id = "pf-open";
    b.textContent = paid() ? "Il mio calendario" : "Attiva il calendario →";
    b.onclick = function () { open(); };
    var host = document.querySelector("#piuCal") || document.querySelector(".cta") || document.querySelector(".tools") || document.body;
    host.appendChild(b);
    // paid.js carica differito, dopo il primo render del core: senza questo,
    // "Il tuo andamento" mostrerebbe lo stato sbagliato a chi ha già attivato
    // il calendario, finché non cambia tab a mano.
    try { if (window.render) window.render(); } catch (e) {}
  }
  autoRestore();
  // Sync del feed su qualunque cambio di configurazione (griglia gratis in Turni,
  // wizard, eccezioni): teniamo allineato il calendario automatico senza un bottone.
  var _syncT = null;
  try {
    window.addEventListener("nt:config-changed", function () {
      if (!paid()) return;
      clearTimeout(_syncT);
      _syncT = setTimeout(function () {
        var s = getSub(); if (!s) return;
        api("PUT", "/config/" + s.id, { cfg: paramsObj() }, s.writeKey).then(function () {}, function () {});
      }, 2000);
    });
  } catch (e) {}
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", launcher);
  else launcher();
  window.NTPaid = { open: open, paid: paid };   // per test/uso esterno
})();
