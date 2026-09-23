/* migrate.js — trasloco dei dati dalla vecchia app (TWA/PWA, dati nel browser)
   alla nuova app nativa (Capacitor, dati nel suo WebView). Sono due storage
   separati anche sullo stesso telefono: senza questo, chi aggiorna l'app dal
   Play Store ripartirebbe con turni e diario vuoti.

   Nessun server: i dati passano dentro il link stesso, nel frammento (#…).
     1. App nativa, primo avvio a vuoto → "Recupera i miei dati" apre
        https://app.notturnisti.club/?export=app nel browser del telefono, cioè
        lo stesso in cui girava la vecchia app e in cui stanno i dati.
     2. Il sito, con ?export=app, legge le chiavi "nt:" dal suo localStorage,
        le comprime e al tocco su "Apri nell'app" naviga a
        notturnisti://import#v1.<dati>  (serve un tocco: i browser bloccano
        l'apertura di un'app senza un gesto dell'utente).
     3. L'app riceve il link (plugin App, evento appUrlOpen), chiede conferma,
        scrive le chiavi e ricarica.
   La telemetria (nt:analytics-*) non viaggia: il consenso è per dispositivo. */
(function () {
  "use strict";

  var PREFIX = "nt:";
  var SKIP = /^nt:analytics-/;
  var SCHEME = "notturnisti://import";
  var SITE = "https://app.notturnisti.club/?export=app";
  var DISMISS = "nt:migrazioneVista";

  var Cap = window.Capacitor;
  var nativo = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());

  // ── codifica: JSON → deflate → base64url (v1), o solo base64url (v0) ──
  function b64u(bytes) {
    var s = "", CH = 0x8000;
    for (var i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function unb64u(str) {
    var s = atob(str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4));
    var out = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  function pipe(bytes, stream) {
    return new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }
  function encode(obj) {
    var raw = new TextEncoder().encode(JSON.stringify(obj));
    if (typeof CompressionStream === "undefined") return Promise.resolve("v0." + b64u(raw));
    return pipe(raw, new CompressionStream("deflate-raw")).then(function (z) { return "v1." + b64u(z); });
  }
  function decode(str) {
    var m = /^(v[01])\.([A-Za-z0-9_-]+)$/.exec(str || "");
    if (!m) return Promise.reject(new Error("formato"));
    var bytes = unb64u(m[2]);
    var p = m[1] === "v1" ? pipe(bytes, new DecompressionStream("deflate-raw")) : Promise.resolve(bytes);
    return p.then(function (b) { return JSON.parse(new TextDecoder().decode(b)); });
  }

  function datiLocali() {
    var out = {};
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf(PREFIX) === 0 && !SKIP.test(k)) out[k] = localStorage.getItem(k);
    }
    return out;
  }
  // Solo turni configurati davvero contano come "ha dei dati": nt:state
  // esiste sempre, perché l'app salva i valori di default già al primo avvio.
  function haDati() {
    try { return localStorage.getItem("nt:turniConfigurati") === "true"; } catch (e) { return false; }
  }

  // ── UI minima, indipendente dal resto dell'app ──
  function dialog(html) {
    var d = document.createElement("div");
    d.setAttribute("role", "dialog");
    d.setAttribute("aria-modal", "true");
    d.style.cssText = "position:fixed;inset:0;z-index:99999;background:rgba(10,12,16,.72);display:flex;align-items:center;justify-content:center;padding:16px";
    d.innerHTML = '<div style="max-width:420px;width:100%;background:var(--s1,#1c1f24);color:var(--ink,#f2f2f2);border-radius:18px;padding:20px 18px;box-shadow:0 12px 40px rgba(0,0,0,.4);font:15px/1.45 system-ui,sans-serif">' + html + "</div>";
    document.body.appendChild(d);
    return d;
  }
  var BTN = "display:block;width:100%;min-height:46px;margin-top:10px;border-radius:12px;font:inherit;font-weight:600;cursor:pointer;";
  var PRI = BTN + "border:0;background:var(--blue,#3d7be0);color:#fff";
  var SEC = BTN + "border:1px solid var(--line,#3a3f47);background:none;color:inherit";

  /* ── lato sito: ?export=app ─────────────────────────────────────────── */
  function esporta() {
    var dati = datiLocali();
    var n = Object.keys(dati).length;
    if (!haDati()) {
      var v = dialog('<b style="font-size:17px">Nessun dato in questo browser</b>' +
        '<p style="margin:8px 0 0;opacity:.8">Qui non ci sono turni salvati. Se usavi Notturnisti da un altro browser (per esempio Samsung Internet), apri questo stesso link da lì. Altrimenti puoi ricominciare nell\'app: ci vogliono due minuti.</p>' +
        '<button type="button" style="' + SEC + '" data-x>Chiudi</button>');
      v.querySelector("[data-x]").onclick = function () { v.remove(); };
      return;
    }
    encode(dati).then(function (payload) {
      var d = dialog('<b style="font-size:17px">Porta i tuoi dati nell\'app</b>' +
        '<p style="margin:8px 0 0;opacity:.8">Turni, diario e impostazioni di questo browser (' + n + ' voci) passano all\'app Notturnisti direttamente sul telefono, senza server.</p>' +
        '<a href="' + SCHEME + "#" + payload + '" style="' + PRI + ';text-align:center;line-height:46px;text-decoration:none">Apri nell\'app →</a>' +
        '<button type="button" style="' + SEC + '" data-x>Annulla</button>');
      d.querySelector("[data-x]").onclick = function () { d.remove(); };
    }).catch(function () {});
  }

  /* ── lato app nativa ────────────────────────────────────────────────── */
  function importa(url) {
    var i = url.indexOf("#");
    if (url.indexOf(SCHEME) !== 0 || i < 0) return;
    decode(url.slice(i + 1)).then(function (dati) {
      var chiavi = Object.keys(dati).filter(function (k) { return k.indexOf(PREFIX) === 0 && !SKIP.test(k) && typeof dati[k] === "string"; });
      if (!chiavi.length) return;
      // Non si scrive qui: la pagina in corso ha un salvataggio automatico
      // che potrebbe riscriverci sopra. I dati passano dal sessionStorage e li
      // applica lo script in testa a index.html, al ricaricamento, prima di
      // qualunque altra cosa.
      var procedi = function () {
        var sub = {};
        chiavi.forEach(function (k) { sub[k] = dati[k]; });
        sub[DISMISS] = "true";
        try { sessionStorage.setItem("nt-import", JSON.stringify(sub)); }
        catch (e) { alert("Spazio insufficiente: dati non importati."); return; }
        location.reload();
      };
      if (!haDati()) { procedi(); return; }
      var d = dialog('<b style="font-size:17px">Sostituire i dati dell\'app?</b>' +
        '<p style="margin:8px 0 0;opacity:.8">L\'app ha già dei turni. Importando, verranno sostituiti da quelli del browser.</p>' +
        '<button type="button" style="' + PRI + '" data-ok>Sostituisci</button>' +
        '<button type="button" style="' + SEC + '" data-x>Annulla</button>');
      d.querySelector("[data-ok]").onclick = procedi;
      d.querySelector("[data-x]").onclick = function () { d.remove(); };
    }).catch(function () { alert("Link di importazione non valido o incompleto."); });
  }

  function proponi() {
    try { if (haDati() || localStorage.getItem(DISMISS)) return; } catch (e) { return; }
    var d = dialog('<b style="font-size:17px">Usavi già Notturnisti?</b>' +
      '<p style="margin:8px 0 0;opacity:.8">Se avevi l\'app installata dal browser o dal Play Store, i tuoi turni sono rimasti lì. Li recuperiamo con due tocchi, senza passare da nessun server.</p>' +
      '<button type="button" style="' + PRI + '" data-ok>Recupera i miei dati</button>' +
      '<button type="button" style="' + SEC + '" data-x>Inizio da capo</button>');
    d.querySelector("[data-ok]").onclick = function () {
      d.remove();
      // Fuori dal dominio dell'app: Capacitor lo apre nel browser di sistema.
      location.href = SITE;
    };
    d.querySelector("[data-x]").onclick = function () {
      try { localStorage.setItem(DISMISS, "true"); } catch (e) {}
      d.remove();
    };
  }

  function avvia() {
    if (nativo) {
      var App = Cap.Plugins && Cap.Plugins.App;
      if (App) {
        App.addListener("appUrlOpen", function (ev) { if (ev && ev.url) importa(ev.url); });
        // Avvio a freddo dal link: l'URL arriva da getLaunchUrl, non dall'evento.
        App.getLaunchUrl().then(function (r) { if (r && r.url) importa(r.url); else proponi(); }).catch(proponi);
      } else proponi();
    } else if (/[?&]export=app\b/.test(location.search)) {
      try { history.replaceState(null, "", location.pathname + location.hash); } catch (e) {}
      esporta();
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", avvia);
  else avvia();

  window.NTMigrate = { encode: encode, decode: decode };
})();
