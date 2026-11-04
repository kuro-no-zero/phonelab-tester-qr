# phonelab-tester-qr

Pagina di test che il telefono apre dal QR del Phonelab Tester (sul Mac).
Il telefono e il Mac si collegano direttamente (WebRTC): gli esiti vanno solo al tester, nessun dato passa da qui o viene salvato.

- `index.html`, `telefono.js`, `telefono.css`: la pagina di test.
- `comune-qr.js`: codifica del collegamento (uguale a `lib/comune-qr.js` nel tester).
- `lib/qrcode.js`: qrcode-generator di Kazuhiko Arase, licenza MIT.

Pubblicata con GitHub Pages: Settings > Pages > Deploy from a branch > main / (root).
