const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const { chromium } = require('playwright');

async function generateQrWithLogo() {
  console.log('[TÂCHE 1] Démarrage génération QR Code avec Logo Thièsdn...');
  
  const logoPath = path.join(__dirname, 'public', 'logo-tight.png');
  const logoBuffer = fs.readFileSync(logoPath);
  const logoDataUri = `data:image/png;base64,${logoBuffer.toString('base64')}`;

  const qrText = 'THIESDN-KMOU-JANGO-VIP-2026';
  const qrSize = 400;

  // 1. Génération du QR Code de base en haute résolution avec correction d'erreur 'H' (30%)
  const qrDataUri = await QRCode.toDataURL(qrText, {
    width: qrSize,
    margin: 2,
    errorCorrectionLevel: 'H',
    color: {
      dark: '#0A0A0A',
      light: '#FFFFFF',
    },
  });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8"/>
        <style>
          body {
            background-color: #0A0A0A;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            font-family: system-ui, sans-serif;
          }
          #ticket-qr-container {
            padding: 24px;
            background: #FFFFFF;
            border-radius: 24px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.5);
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          canvas {
            display: block;
            border-radius: 12px;
          }
          .label {
            margin-top: 14px;
            font-size: 14px;
            font-weight: 800;
            color: #241A00;
            font-family: monospace;
            letter-spacing: 2px;
          }
          .subtitle {
            margin-top: 4px;
            font-size: 11px;
            font-weight: 600;
            color: #059669;
            display: flex;
            align-items: center;
            gap: 6px;
          }
        </style>
      </head>
      <body>
        <div id="ticket-qr-container">
          <canvas id="finalCanvas" width="${qrSize}" height="${qrSize}"></canvas>
          <div class="label">${qrText}</div>
          <div class="subtitle">✓ QR CODE OFFICIEL THIÈSDN AVEC LOGO CENTRAL</div>
        </div>
      </body>
    </html>
  `);

  await page.evaluate(async ({ qrUri, logoUri, size }) => {
    const canvas = document.getElementById('finalCanvas');
    const ctx = canvas.getContext('2d');

    // Charger l'image QR
    const qrImg = new Image();
    await new Promise((res, rej) => {
      qrImg.onload = res;
      qrImg.onerror = rej;
      qrImg.src = qrUri;
    });

    // Dessiner le QR Code sur le canvas
    ctx.drawImage(qrImg, 0, 0, size, size);

    // Charger le logo Thièsdn
    const logoImg = new Image();
    await new Promise((res, rej) => {
      logoImg.onload = res;
      logoImg.onerror = rej;
      logoImg.src = logoUri;
    });

    // Calcul de la taille du logo au centre (~24% de la largeur du QR)
    const logoTargetW = Math.floor(size * 0.24);
    const aspectRatio = logoImg.naturalHeight / logoImg.naturalWidth;
    const logoTargetH = Math.floor(logoTargetW * aspectRatio);

    // Marge protectrice blanche (padding)
    const padX = 8;
    const padY = 6;
    const badgeW = logoTargetW + padX * 2;
    const badgeH = logoTargetH + padY * 2;
    const badgeX = (size - badgeW) / 2;
    const badgeY = (size - badgeH) / 2;

    ctx.save();
    // Badge blanc protecteur avec ombre douce
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;

    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 8);
    } else {
      ctx.rect(badgeX, badgeY, badgeW, badgeH);
    }
    ctx.fill();

    // Liseré or de sécurité prestige (#E9C349)
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#E9C349';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Dessin du logo officiel au centre exact
    ctx.drawImage(logoImg, badgeX + padX, badgeY + padY, logoTargetW, logoTargetH);
    ctx.restore();
  }, { qrUri: qrDataUri, logoUri: logoDataUri, size: qrSize });

  const container = await page.$('#ticket-qr-container');
  const outputPath = path.join(__dirname, 'test-results', 'PREUVE_QR_CODE_LOGO.png');
  await container.screenshot({ path: outputPath });
  console.log(`[TÂCHE 1] SUCCÈS : Preuve enregistrée sous : ${outputPath}`);

  await browser.close();
}

generateQrWithLogo().catch((err) => {
  console.error('[TÂCHE 1] Erreur génération QR Code:', err);
  process.exit(1);
});
