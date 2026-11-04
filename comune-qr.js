// Phonelab: funzioni comuni a tester (Mac) e pagina telefono.
// Codifica: JSON -> deflate-raw -> base64url. Nessun server: l'offerta va nel
// link del QR del Mac, la risposta nel QR mostrato dal telefono.
(function () {
  'use strict';
  var PLQR = window.PLQR = {};
  PLQR.ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
  function b64url(buf) {
    var s = '', b = new Uint8Array(buf);
    for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function daB64url(t) {
    t = t.replace(/-/g, '+').replace(/_/g, '/'); while (t.length % 4) t += '=';
    var s = atob(t), b = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return b;
  }
  // SDP ridotto: solo le righe che servono a un canale dati
  function riduciSdp(sdp) {
    return sdp.split(/\r?\n/).filter(function (l) {
      return l && !/^a=(extmap|rtcp-fb|fmtp|rtpmap|ssrc|msid|ice-options:trickle)/.test(l);
    }).join('\r\n') + '\r\n';
  }
  PLQR.codifica = function (obj) {
    if (obj.sdp) obj = Object.assign({}, obj, { sdp: riduciSdp(obj.sdp) });
    var cs = new CompressionStream('deflate-raw');
    return new Response(new Blob([JSON.stringify(obj)]).stream().pipeThrough(cs)).arrayBuffer().then(b64url);
  };
  PLQR.decodifica = function (t) {
    var ds = new DecompressionStream('deflate-raw');
    return new Response(new Blob([daB64url(t)]).stream().pipeThrough(ds)).text().then(JSON.parse);
  };
  // Aspetta la raccolta dei candidati (senza trickle), al massimo ms
  PLQR.aspettaIce = function (pc, ms) {
    return new Promise(function (res) {
      if (pc.iceGatheringState === 'complete') return res();
      var t = setTimeout(res, ms || 2500);
      pc.addEventListener('icegatheringstatechange', function () { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } });
    });
  };
  // QR come SVG (libreria qrcode-generator, MIT)
  PLQR.svgQr = function (testo) {
    var q = qrcode(0, 'L'); q.addData(testo); q.make();
    return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  };
})();
