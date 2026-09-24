/**
 * Script di tracciamento pubblico: `<script async src="https://<host>/t.js"
 * data-key="<trackingKey>"></script>`.
 *
 * Il proxy (src/proxy.ts) esclude i file `.js` dal matcher, quindi questa
 * rotta non passa mai da clerkMiddleware/auth.protect(): e' raggiungibile
 * senza sessione, come deve essere per uno script installato su siti di
 * terzi. `RESERVED_SLUGS` in src/lib/company.ts riserva gia' "t.js" cosi'
 * un'azienda non puo' avere uno slug che lo ombreggi.
 *
 * Vanilla JS, ES2017, nessuna dipendenza, tenuto volutamente piccolo: viene
 * scaricato da ogni pagina di ogni sito che lo installa.
 *
 * Rispetto di Do Not Track / Global Privacy Control: se attivo, lo script non
 * genera ne' legge alcun identificativo persistente (niente cookie, niente
 * localStorage) e non invia alcuna richiesta di rete. `window.myb` resta
 * disponibile ma inerte (vid null, track() no-op), cosi' il resto della
 * pagina (es. l'auto-decorazione degli iframe /f/) non si rompe.
 */
export const dynamic = "force-static";

const SCRIPT = `(function () {
  "use strict";
  var doc = document;
  var win = window;
  var nav = navigator;
  var script = doc.currentScript;
  var KEY = script && script.getAttribute("data-key");
  if (!KEY) return;

  var APP_ORIGIN = (function () {
    var src = (script && script.src) || "";
    var i = src.indexOf("/t.js");
    return i > -1 ? src.slice(0, i) : "";
  })();
  var TRACK_URL = APP_ORIGIN + "/api/public/track";

  function dnt() {
    return (
      win.doNotTrack === "1" ||
      nav.doNotTrack === "1" ||
      nav.doNotTrack === "yes" ||
      nav.globalPrivacyControl === true
    );
  }

  function genId() {
    return "v" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  function readCookie(name) {
    var m = doc.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : null;
  }
  function writeCookie(name, value) {
    var oneYear = 365 * 24 * 60 * 60;
    doc.cookie = name + "=" + encodeURIComponent(value) + "; Max-Age=" + oneYear + "; Path=/; SameSite=Lax";
  }

  var respectingDnt = dnt();
  var vid = null;
  if (!respectingDnt) {
    vid = readCookie("myb_vid");
    if (!vid) {
      try { vid = win.localStorage.getItem("myb_vid"); } catch (e) {}
    }
    if (!vid) vid = genId();
    writeCookie("myb_vid", vid);
    try { win.localStorage.setItem("myb_vid", vid); } catch (e) {}
  }

  function currentUtm() {
    var out = {};
    try {
      var params = new URLSearchParams(win.location.search);
      ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid"].forEach(function (k) {
        var v = params.get(k);
        if (v) out[k] = v;
      });
    } catch (e) {}
    return out;
  }

  var lastSentUrl = null;
  function send() {
    if (respectingDnt || !vid) return;
    var url = win.location.href;
    if (url === lastSentUrl) return;
    lastSentUrl = url;
    var body = JSON.stringify({
      key: KEY,
      vid: vid,
      url: url,
      path: win.location.pathname,
      title: doc.title,
      referrer: doc.referrer || undefined,
      utm: currentUtm(),
    });
    try {
      if (nav.sendBeacon) {
        var blob = new Blob([body], { type: "application/json" });
        if (nav.sendBeacon(TRACK_URL, blob)) return;
      }
    } catch (e) {}
    try {
      fetch(TRACK_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: body, keepalive: true, mode: "cors" });
    } catch (e) {}
  }

  function patchHistory(type) {
    var orig = history[type];
    if (!orig) return;
    history[type] = function () {
      var ret = orig.apply(this, arguments);
      setTimeout(send, 0);
      return ret;
    };
  }
  patchHistory("pushState");
  patchHistory("replaceState");
  win.addEventListener("popstate", send);

  // Iframe e link verso form (/f/) e prenotazioni (/book/) dell'app: ricevono
  // vid + UTM nell'URL, perche' quelle pagine stanno sul dominio dell'app e non
  // possono leggere il cookie first-party di questo sito. Solo URL dell'origin
  // da cui e' stato caricato t.js: un "/book/" del sito ospite non si tocca.
  function decorateIframes() {
    var utm = currentUtm();
    var els = doc.querySelectorAll('iframe[src*="/f/"], iframe[src*="/book/"], a[href*="/f/"], a[href*="/book/"]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.getAttribute("data-myb-decorated") === "1") continue;
      var attr = el.tagName === "A" ? "href" : "src";
      try {
        var u = new URL(el.getAttribute(attr), win.location.href);
        if (APP_ORIGIN && u.origin !== new URL(APP_ORIGIN, win.location.href).origin) continue;
        if (u.pathname.indexOf("/f/") !== 0 && u.pathname.indexOf("/book/") !== 0) continue;
        if (vid && !u.searchParams.get("vid")) u.searchParams.set("vid", vid);
        Object.keys(utm).forEach(function (k) {
          if (!u.searchParams.get(k)) u.searchParams.set(k, utm[k]);
        });
        el.setAttribute(attr, u.toString());
        el.setAttribute("data-myb-decorated", "1");
      } catch (e) {}
    }
  }

  // Auto-resize per gli iframe /f/ incorporati in questa pagina (ridondante
  // e innocuo se il sito usa gia' il piccolo script dedicato dello snippet
  // "Condividi": entrambi si limitano a impostare la stessa altezza).
  win.addEventListener("message", function (ev) {
    if (!ev.data || ev.data.source !== "myb-form" || !ev.data.height) return;
    var iframes = doc.querySelectorAll('iframe[src*="/f/"]');
    for (var i = 0; i < iframes.length; i++) {
      if (iframes[i].contentWindow === ev.source) {
        iframes[i].style.height = ev.data.height + "px";
      }
    }
  });

  win.myb = {
    vid: vid,
    track: function () { send(); },
  };

  function init() {
    decorateIframes();
    send();
  }
  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
`;

export async function GET() {
  return new Response(SCRIPT, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
