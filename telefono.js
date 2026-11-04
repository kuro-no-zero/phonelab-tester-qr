/* Phonelab · pagina di test aperta sul telefono dal QR del tester.
   Si collega al Mac con WebRTC (canale dati diretto, nessun server) e manda
   gli esiti in diretta. Non legge e non salva dati personali. */
(function () {
  'use strict';
  var app = document.getElementById('app');
  var pc = null, dc = null, collegato = false, intestazione = '';
  var esiti = {};      // test -> { esito, nota }
  var aperto = null;   // pulizia dello schermo di test aperto

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(s, r) { return (r || document).querySelector(s); }
  function invia(o) { if (dc && dc.readyState === 'open') dc.send(JSON.stringify(o)); }
  function segna(test, esito, nota) {
    esiti[test] = { esito: esito, nota: nota || '' };
    invia({ tipo: 'esito', test: test, esito: esito, nota: nota || '' });
  }

  var TEST = [
    { id: 'touch', nome: 'Touch a griglia', fai: testTouch },
    { id: 'multitouch', nome: 'Multitouch', fai: testMulti },
    { id: 'colori', nome: 'Pixel e colori', fai: testColori },
    { id: 'altoparlante', nome: 'Altoparlante', fai: testAltoparlante },
    { id: 'microfono', nome: 'Microfono', fai: testMicrofono },
    { id: 'fotocamere', nome: 'Fotocamere e torcia', fai: testFotocamere, sotto: ['cam-post', 'cam-front', 'torcia'] },
    { id: 'sensori', nome: 'Accelerometro, giroscopio, bussola', fai: testSensori, sotto: ['sensori', 'bussola'] },
    { id: 'vibrazione', nome: 'Vibrazione', fai: testVibrazione },
    { id: 'gps', nome: 'GPS', fai: testGps }
  ];

  // ---------- collegamento ----------
  function avvio() {
    var m = /[#&]o=([\w-]+)/.exec(location.hash);
    if (!m) { app.innerHTML = '<div class="carta"><h1>Phonelab</h1><p>Apri questa pagina inquadrando il QR che mostra il Phonelab Tester sul Mac.</p></div>'; return; }
    if (!window.RTCPeerConnection || !window.CompressionStream) { app.innerHTML = '<div class="carta"><h1>Phonelab</h1><p>Questo browser è troppo vecchio per il collegamento. Aggiorna il sistema o usa Chrome / Safari recenti.</p></div>'; return; }
    app.innerHTML = '<div class="carta"><h1>Phonelab</h1><p class="tenue">Preparo il collegamento…</p></div>';
    PLQR.decodifica(m[1]).then(function (off) {
      intestazione = off.rif || '';
      pc = new RTCPeerConnection(PLQR.ICE);
      pc.ondatachannel = function (ev) { dc = ev.channel; collegaCanale(); };
      pc.onconnectionstatechange = function () {
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected' || pc.connectionState === 'closed') { collegato = false; home(); }
      };
      return pc.setRemoteDescription({ type: 'offer', sdp: off.sdp })
        .then(function () { return pc.createAnswer(); })
        .then(function (a) { return pc.setLocalDescription(a); })
        .then(function () { return PLQR.aspettaIce(pc, 3000); })
        .then(function () { return PLQR.codifica({ sdp: pc.localDescription.sdp }); })
        .then(function (cod) {
          if (collegato) return;
          app.innerHTML = '<div class="carta"><h1>Phonelab</h1>' + (intestazione ? '<p class="tenue">' + esc(intestazione) + '</p>' : '') +
            '<p>Sul Mac premi <b>Leggi la risposta</b> e inquadra questo codice.</p><div class="qr">' + PLQR.svgQr('PLR1:' + cod) + '</div>' +
            '<p class="tenue">Tieni lo schermo acceso e la luminosità alta. Telefono e Mac meglio sulla stessa Wi-Fi.</p></div>';
        });
    }).catch(function (e) { app.innerHTML = '<div class="carta"><h1>Phonelab</h1><p>QR non valido o scaduto: rigeneralo dal tester. (' + esc(e.message) + ')</p></div>'; });
  }
  function collegaCanale() {
    dc.onopen = function () { collegato = true; inviaInfo(); home(); };
    dc.onclose = function () { collegato = false; home(); };
    dc.onmessage = function (ev) {
      var o = {}; try { o = JSON.parse(ev.data); } catch (e) { return; }
      if (o.tipo === 'ciao') { intestazione = o.titolo || intestazione; if (!aperto) home(); }
    };
  }
  function inviaInfo() {
    var ua = navigator.userAgent, info = { ua: ua, schermo: screen.width + '×' + screen.height + ' @' + (window.devicePixelRatio || 1) + 'x' };
    var ios = /(iPhone|iPad|iPod).*? OS (\d+)[_.](\d+)/.exec(ua), and = /Android (\d+(?:\.\d+)?)/.exec(ua);
    if (ios) info.sistema = 'iOS ' + ios[2] + '.' + ios[3];
    else if (and) info.sistema = 'Android ' + and[1];
    var fine = [];
    if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
      fine.push(navigator.userAgentData.getHighEntropyValues(['model', 'platformVersion']).then(function (h) {
        if (h.model) info.modello = h.model;
        if (h.platformVersion && /Android/.test(ua)) info.sistema = 'Android ' + h.platformVersion.split('.')[0];
      }).catch(function () {}));
    }
    if (navigator.getBattery) {
      fine.push(navigator.getBattery().then(function (b) { info.batteria = Math.round(b.level * 100) + '%' + (b.charging ? ' in carica' : ''); }).catch(function () {}));
    }
    Promise.all(fine).then(function () { invia({ tipo: 'info', info: info }); });
  }

  // ---------- elenco ----------
  function statoTest(t) {
    var ids = t.sotto || [t.id], v = ids.map(function (i) { return esiti[i] && esiti[i].esito; }).filter(Boolean);
    if (!v.length) return '<span class="stato">da fare</span>';
    if (v.indexOf('ko') >= 0) return '<span class="stato ko">KO</span>';
    return '<span class="stato ok">' + (v.length < ids.length ? 'in parte' : 'OK') + '</span>';
  }
  function home() {
    if (aperto) { aperto(); aperto = null; }
    if (!pc) return;
    app.innerHTML = '<div class="carta"><h1>Phonelab</h1>' + (intestazione ? '<div class="tenue">' + esc(intestazione) + '</div>' : '') +
      (collegato ? '<div class="collegato">Collegato al Mac: gli esiti arrivano nel tester</div>' : '<div class="scollegato">Non collegato: rigenera il QR dal tester</div>') + '</div>' +
      '<div class="lista">' + TEST.map(function (t, i) { return '<button data-t="' + i + '"><span>' + esc(t.nome) + '</span>' + statoTest(t) + '</button>'; }).join('') + '</div>' +
      '<p class="tenue">Face ID / impronta: da provare a mano (da browser si potrebbe solo creando una passkey sul telefono del cliente). Capsula: il browser usa solo l\'altoparlante.</p>';
    Array.prototype.forEach.call(app.querySelectorAll('[data-t]'), function (b) {
      b.addEventListener('click', function () { TEST[+b.dataset.t].fai(); });
    });
  }
  function schermo(titolo, html) {
    app.innerHTML = '<div class="carta"><h2>' + esc(titolo) + '</h2>' + html + '</div><button data-indietro style="width:100%">Indietro</button>';
    $('[data-indietro]').addEventListener('click', home);
  }
  function pulsantiEsito(test, dopo) {
    var d = document.createElement('div'); d.className = 'riga';
    d.innerHTML = '<button class="ok">OK</button><button class="ko">KO</button>';
    d.querySelector('.ok').onclick = function () { segna(test, 'ok'); (dopo || home)(); };
    d.querySelector('.ko').onclick = function () { segna(test, 'ko'); (dopo || home)(); };
    return d;
  }

  // ---------- test ----------
  function testTouch() {
    var C = 6, R = 12, n = C * R, fatti = 0;
    var g = document.createElement('div'); g.className = 'pieno griglia';
    g.style.gridTemplateRows = 'repeat(' + R + ', 1fr)';
    for (var i = 0; i < n; i++) g.appendChild(document.createElement('div'));
    var barra = document.createElement('div'); barra.className = 'barra-pieno';
    barra.innerHTML = '<button data-ko>KO: zone che non rispondono</button><button data-esci>Esci</button>';
    document.body.appendChild(g); document.body.appendChild(barra);
    function tocca(x, y) {
      var el = document.elementFromPoint(x, y);
      if (el && el.parentNode === g && !el.classList.contains('fatto')) {
        el.classList.add('fatto'); fatti++;
        if (fatti === n) { segna('touch', 'ok'); chiudi(); home(); }
      }
    }
    function mosso(e) { e.preventDefault(); Array.prototype.forEach.call(e.touches || [e], function (t) { tocca(t.clientX, t.clientY); }); }
    g.addEventListener('touchstart', mosso, { passive: false }); g.addEventListener('touchmove', mosso, { passive: false });
    g.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'touch') tocca(e.clientX, e.clientY); });
    g.addEventListener('pointermove', function (e) { if (e.pointerType !== 'touch' && e.buttons) tocca(e.clientX, e.clientY); });
    function chiudi() { g.remove(); barra.remove(); }
    barra.querySelector('[data-ko]').onclick = function () { segna('touch', 'ko', (n - fatti) + ' riquadri su ' + n + ' non toccati'); chiudi(); home(); };
    barra.querySelector('[data-esci]').onclick = function () { chiudi(); home(); };
    aperto = chiudi;
  }
  function testMulti() {
    var a = document.createElement('div'); a.className = 'pieno'; a.style.background = '#fff';
    a.innerHTML = '<div class="centro" data-c>Appoggia più dita insieme</div>';
    var barra = document.createElement('div'); barra.className = 'barra-pieno';
    barra.innerHTML = '<button class="ok" data-ok>OK</button><button class="ko" data-ko>KO</button><button data-esci>Esci</button>';
    document.body.appendChild(a); document.body.appendChild(barra);
    var max = 0, punti = [];
    function disegna(e) {
      e.preventDefault();
      punti.forEach(function (p) { p.remove(); }); punti = [];
      Array.prototype.forEach.call(e.touches, function (t) { var p = document.createElement('div'); p.className = 'punto'; p.style.left = t.clientX + 'px'; p.style.top = t.clientY + 'px'; document.body.appendChild(p); punti.push(p); });
      max = Math.max(max, e.touches.length);
      a.querySelector('[data-c]').textContent = e.touches.length + ' dita · massimo ' + max;
    }
    ['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach(function (t) { a.addEventListener(t, disegna, { passive: false }); });
    function chiudi() { punti.forEach(function (p) { p.remove(); }); a.remove(); barra.remove(); }
    barra.querySelector('[data-ok]').onclick = function () { segna('multitouch', 'ok', 'massimo ' + max + ' dita'); chiudi(); home(); };
    barra.querySelector('[data-ko]').onclick = function () { segna('multitouch', 'ko', 'massimo ' + max + ' dita'); chiudi(); home(); };
    barra.querySelector('[data-esci]').onclick = function () { chiudi(); home(); };
    aperto = chiudi;
  }
  function testColori() {
    var colori = ['#ffffff', '#000000', '#ff0000', '#00ff00', '#0000ff', '#808080'], i = 0;
    var a = document.createElement('div'); a.className = 'pieno';
    a.innerHTML = '<div class="centro" data-c style="color:#888">Tocca per il colore successivo</div>';
    document.body.appendChild(a);
    function mostra() { a.style.background = colori[i]; }
    mostra();
    setTimeout(function () { var c = a.querySelector('[data-c]'); if (c) c.remove(); }, 1500);
    a.addEventListener('click', function () {
      i++;
      if (i < colori.length) return mostra();
      chiudi();
      schermo('Pixel e colori', '<p>Hai visto pixel morti, macchie, linee, ombre o immagini residue?</p>');
      var r = pulsantiEsito('colori'); r.querySelector('.ok').textContent = 'Tutto pulito: OK'; r.querySelector('.ko').textContent = 'Difetti: KO';
      app.querySelector('.carta').appendChild(r);
    });
    function chiudi() { a.remove(); }
    aperto = chiudi;
  }
  function testAltoparlante() {
    schermo('Altoparlante', '<p>Alza il volume e premi Riproduci: tre toni, basso, medio e acuto.</p><button class="primario" data-play style="width:100%">Riproduci</button>');
    var ctx = null;
    $('[data-play]').onclick = function () {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      [330, 880, 2500].forEach(function (f, k) {
        var o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + k * 0.6;
        o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.6, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
        o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.55);
      });
    };
    app.querySelector('.carta').appendChild(pulsantiEsito('altoparlante'));
    aperto = function () { if (ctx) ctx.close(); };
  }
  function testMicrofono() {
    schermo('Microfono', '<p>Parla o soffia vicino al microfono in basso.</p><div class="metro"><div data-m></div></div><p class="tenue" data-s>Chiedo il permesso del microfono…</p>');
    var flusso = null, ctx = null, raf = 0, sopra = 0, fatto = false;
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (st) {
      flusso = st; ctx = new (window.AudioContext || window.webkitAudioContext)();
      var an = ctx.createAnalyser(); an.fftSize = 1024; ctx.createMediaStreamSource(st).connect(an);
      var buf = new Uint8Array(an.fftSize); $('[data-s]').textContent = 'In ascolto…';
      (function giro() {
        an.getByteTimeDomainData(buf);
        var picco = 0; for (var i = 0; i < buf.length; i++) picco = Math.max(picco, Math.abs(buf[i] - 128));
        var liv = Math.min(100, picco / 128 * 140); var m = $('[data-m]'); if (m) m.style.width = liv + '%';
        sopra = liv > 35 ? sopra + 1 : 0;
        if (!fatto && sopra > 12) { fatto = true; segna('microfono', 'ok'); var s = $('[data-s]'); if (s) s.textContent = 'Sentito: OK inviato al tester.'; }
        raf = requestAnimationFrame(giro);
      })();
    }).catch(function (e) { var s = $('[data-s]'); if (s) s.textContent = 'Microfono non disponibile: ' + e.message; });
    app.querySelector('.carta').appendChild(pulsantiEsito('microfono'));
    aperto = function () { cancelAnimationFrame(raf); if (flusso) flusso.getTracks().forEach(function (t) { t.stop(); }); if (ctx) ctx.close(); };
  }
  function testFotocamere() {
    schermo('Fotocamere e torcia', '<video data-v autoplay playsinline muted></video><p class="tenue" data-s></p>' +
      '<div class="riga"><button data-lato="environment">Posteriore</button><button data-lato="user">Frontale</button><button data-torcia hidden>Torcia</button></div>' +
      '<div data-esiti></div>');
    var flusso = null, lato = 'environment', torcia = false;
    function ferma() { if (flusso) flusso.getTracks().forEach(function (t) { t.stop(); }); flusso = null; }
    function apri(l) {
      ferma(); lato = l;
      navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: l } }, audio: false }).then(function (st) {
        flusso = st; $('[data-v]').srcObject = st;
        var tr = st.getVideoTracks()[0], cap = tr.getCapabilities ? tr.getCapabilities() : {};
        $('[data-torcia]').hidden = !(l === 'environment' && cap.torch);
        $('[data-s]').textContent = (l === 'environment' ? 'Posteriore' : 'Frontale') + (tr.getSettings ? ' · ' + (tr.getSettings().width || '?') + '×' + (tr.getSettings().height || '?') : '') + '. Inquadra vicino e lontano.';
        disegnaEsiti();
      }).catch(function (e) { $('[data-s]').textContent = 'Fotocamera non disponibile: ' + e.message; });
    }
    function disegnaEsiti() {
      var test = lato === 'environment' ? 'cam-post' : 'cam-front', box = $('[data-esiti]');
      box.innerHTML = '';
      var r = pulsantiEsito(test, function () { disegnaEsiti(); });
      r.querySelector('.ok').textContent = (lato === 'environment' ? 'Posteriore' : 'Frontale') + ' OK';
      r.querySelector('.ko').textContent = (lato === 'environment' ? 'Posteriore' : 'Frontale') + ' KO';
      box.appendChild(r);
      if (!$('[data-torcia]').hidden) {
        var t = pulsantiEsito('torcia', function () { disegnaEsiti(); });
        t.querySelector('.ok').textContent = 'Torcia OK'; t.querySelector('.ko').textContent = 'Torcia KO';
        box.appendChild(t);
      }
    }
    Array.prototype.forEach.call(app.querySelectorAll('[data-lato]'), function (b) { b.onclick = function () { apri(b.dataset.lato); }; });
    $('[data-torcia]').onclick = function () {
      var tr = flusso && flusso.getVideoTracks()[0]; if (!tr) return;
      torcia = !torcia; tr.applyConstraints({ advanced: [{ torch: torcia }] }).catch(function () {});
    };
    apri('environment');
    aperto = ferma;
  }
  function testSensori() {
    schermo('Accelerometro, giroscopio, bussola', '<p>Ruota e inclina il telefono in tutte le direzioni, poi giralo su sé stesso in piano.</p>' +
      '<button class="primario" data-via style="width:100%">Avvia</button><p class="valori" data-val></p><p class="tenue" data-s></p>');
    var acc = null, varAcc = 0, giro = 0, rotta = null, minR = 999, maxR = -999, ok1 = false, ok2 = false;
    function onMotion(e) {
      var a = e.accelerationIncludingGravity || {}, r = e.rotationRate || {};
      if (a.x != null) { if (acc) varAcc += Math.abs(a.x - acc.x) + Math.abs(a.y - acc.y) + Math.abs(a.z - acc.z); acc = { x: a.x, y: a.y, z: a.z }; }
      giro += Math.abs(r.alpha || 0) + Math.abs(r.beta || 0) + Math.abs(r.gamma || 0);
      aggiorna();
    }
    function onOrient(e) {
      var h = e.webkitCompassHeading != null ? e.webkitCompassHeading : (e.absolute || e.type === 'deviceorientationabsolute') && e.alpha != null ? 360 - e.alpha : null;
      if (h != null) { rotta = Math.round(h); minR = Math.min(minR, h); maxR = Math.max(maxR, h); }
      aggiorna();
    }
    function aggiorna() {
      var v = $('[data-val]'); if (!v) return;
      v.textContent = 'accelerometro ' + (acc ? acc.x.toFixed(1) + ' ' + acc.y.toFixed(1) + ' ' + acc.z.toFixed(1) : '—') + ' · giroscopio ' + Math.round(giro) + ' · bussola ' + (rotta != null ? rotta + '°' : '—');
      if (!ok1 && varAcc > 60 && giro > 3000) { ok1 = true; segna('sensori', 'ok'); }
      if (!ok2 && rotta != null && maxR - minR > 120) { ok2 = true; segna('bussola', 'ok'); }
      $('[data-s]').textContent = (ok1 ? 'Accelerometro e giroscopio OK. ' : '') + (ok2 ? 'Bussola OK.' : '');
    }
    function avvia() {
      window.addEventListener('devicemotion', onMotion);
      window.addEventListener('deviceorientationabsolute', onOrient);
      window.addEventListener('deviceorientation', onOrient);
      $('[data-via]').hidden = true;
    }
    $('[data-via]').onclick = function () {
      var rich = [];
      if (window.DeviceMotionEvent && DeviceMotionEvent.requestPermission) rich.push(DeviceMotionEvent.requestPermission());
      if (window.DeviceOrientationEvent && DeviceOrientationEvent.requestPermission) rich.push(DeviceOrientationEvent.requestPermission());
      Promise.all(rich).then(avvia).catch(function (e) { $('[data-s]').textContent = 'Permesso negato: ' + e.message; });
    };
    var box = document.createElement('div');
    box.innerHTML = '<div class="riga"><button class="ko" data-k1>Accel./giro KO</button><button class="ko" data-k2>Bussola KO</button></div>';
    box.querySelector('[data-k1]').onclick = function () { segna('sensori', 'ko'); home(); };
    box.querySelector('[data-k2]').onclick = function () { segna('bussola', 'ko'); home(); };
    app.querySelector('.carta').appendChild(box);
    aperto = function () { window.removeEventListener('devicemotion', onMotion); window.removeEventListener('deviceorientationabsolute', onOrient); window.removeEventListener('deviceorientation', onOrient); };
  }
  function testVibrazione() {
    if (!navigator.vibrate) { schermo('Vibrazione', '<p>Questo browser non può far vibrare il telefono (succede su iPhone). Provala a mano.</p>'); return; }
    schermo('Vibrazione', '<p>Premi e senti se vibra.</p><button class="primario" data-v style="width:100%">Vibra</button>');
    $('[data-v]').onclick = function () { navigator.vibrate([400, 200, 400]); };
    app.querySelector('.carta').appendChild(pulsantiEsito('vibrazione'));
  }
  function testGps() {
    schermo('GPS', '<p class="tenue" data-s>Cerco la posizione (meglio vicino a una finestra)…</p>');
    if (!navigator.geolocation) { $('[data-s]').textContent = 'Posizione non disponibile in questo browser.'; return; }
    navigator.geolocation.getCurrentPosition(function (p) {
      var s = $('[data-s]'); if (!s) return;
      s.textContent = 'Posizione trovata, precisione ' + Math.round(p.coords.accuracy) + ' m. OK inviato al tester.';
      segna('gps', 'ok', 'precisione ' + Math.round(p.coords.accuracy) + ' m');
    }, function (e) { var s = $('[data-s]'); if (s) s.textContent = 'Nessuna posizione: ' + e.message + '. Se i servizi di localizzazione sono attivi, segna KO.'; },
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
    var r = pulsantiEsito('gps'); app.querySelector('.carta').appendChild(r);
  }

  avvio();
})();
