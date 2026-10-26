const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

async function captureScratchOfficialLogo() {
  console.log('[QA] Capture d\'écran du Scratch Card AVANT GRATTAGE avec le Logo Officiel...');

  const logoPath = path.join(__dirname, 'public', 'logo-tight.png');
  const logoBuffer = fs.readFileSync(logoPath);
  const logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1000, height: 1100 },
    deviceScaleFactor: 2, // Haute définition Retina
  });
  const page = await context.newPage();

  await page.setContent(`
    <!DOCTYPE html>
    <html lang="fr">
      <head>
        <meta charset="utf-8"/>
        <style>
          body {
            background-color: #0A090E;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            margin: 0;
            padding: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            color: #FFFFFF;
          }
          .ticket-card {
            width: 400px;
            background: linear-gradient(180deg, #221F28 0%, #171717 50%, #121212 100%);
            border: 1px solid rgba(138, 43, 226, 0.4);
            border-radius: 28px;
            overflow: hidden;
            box-shadow: 0 30px 60px rgba(0, 0, 0, 0.85);
          }
          .top-bar {
            padding: 14px 18px;
            background: rgba(0, 0, 0, 0.4);
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .logo-badge {
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .logo-thumb {
            height: 20px;
            padding: 3px 8px;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 8px;
            display: flex;
            align-items: center;
          }
          .logo-thumb img {
            height: 14px;
            width: auto;
          }
          .pass-tag {
            font-size: 11px;
            font-weight: 800;
            color: #E9C349;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .card-body {
            padding: 20px;
          }
          .event-meta {
            background: #1C1B20;
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 18px;
            padding: 14px;
            margin-bottom: 18px;
          }
          .meta-title {
            font-size: 16px;
            font-weight: 800;
            color: #FFFFFF;
          }
          .meta-sub {
            font-size: 12px;
            color: #E9C349;
            font-weight: 600;
            margin-top: 4px;
          }
          .qr-container {
            background: #FFFFFF;
            border-radius: 20px;
            padding: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            position: relative;
            box-shadow: 0 15px 35px rgba(0,0,0,0.5);
          }
          .scratch-header {
            margin-bottom: 10px;
          }
          .scratch-pill {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 12px;
            background: rgba(138, 43, 226, 0.1);
            border: 1px solid rgba(138, 43, 226, 0.3);
            border-radius: 20px;
            font-size: 11px;
            font-weight: 800;
            color: #8A2BE2;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .canvas-wrapper {
            position: relative;
            width: 260px;
            height: 260px;
            border-radius: 14px;
            overflow: hidden;
            margin-bottom: 10px;
          }
          #scratchCanvas {
            width: 260px;
            height: 260px;
            display: block;
            border-radius: 14px;
          }
          .qr-code-label {
            font-family: monospace;
            font-size: 13px;
            font-weight: 800;
            color: #241A00;
            letter-spacing: 1.5px;
            margin-top: 4px;
          }
          .certif-text {
            font-size: 10px;
            color: #059669;
            font-weight: 600;
            margin-top: 4px;
          }
        </style>
      </head>
      <body>
        <div class="ticket-card" id="ticketCard">
          <div class="top-bar">
            <div class="logo-badge">
              <div class="logo-thumb">
                <img src="${logoBase64}" alt="Thièsdn Logo" />
              </div>
              <span class="pass-tag">Pass Billet Officiel</span>
            </div>
            <span style="font-size: 11px; color: #8A2BE2; font-weight: bold;">KMOU JANGO 2026</span>
          </div>

          <div class="card-body">
            <div class="event-meta">
              <div class="meta-title">KMOU JANGO — Nuit Mythique</div>
              <div class="meta-sub">Pass VIP Prestige • 15 000 FCFA</div>
            </div>

            <div class="qr-container">
              <div class="scratch-header">
                <div class="scratch-pill">
                  ✨ Frottez pour révéler votre billet
                </div>
              </div>

              <div class="canvas-wrapper">
                <canvas id="scratchCanvas" width="260" height="260"></canvas>
              </div>

              <div class="qr-code-label">THIESDN-KMOU-VIP-1001</div>
              <div class="certif-text">✓ QR Code certifié avec signature visuelle Thièsdn</div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `);

  await page.evaluate(({ logoDataUri }) => {
    const sc = document.getElementById('scratchCanvas');
    const ctx = sc.getContext('2d');
    const width = 260;
    const height = 260;

    // 1. Fond métallisé nocturne protecteur
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#221F28');
    grad.addColorStop(0.5, '#35323D');
    grad.addColorStop(1, '#18161D');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // 2. Liseré or de sécurité prestige (#E9C349)
    ctx.strokeStyle = '#E9C349';
    ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, width - 8, height - 8);

    // 3. Charger et dessiner le Logo Officiel Thièsdn au centre sur son badge blanc
    const logoImg = new Image();
    logoImg.onload = () => {
      const logoTargetW = Math.floor(width * 0.28); // ~72px
      const aspectRatio = logoImg.naturalHeight / logoImg.naturalWidth;
      const logoTargetH = Math.floor(logoTargetW * aspectRatio);

      const padX = 8;
      const padY = 6;
      const badgeW = logoTargetW + padX * 2;
      const badgeH = logoTargetH + padY * 2;
      const badgeX = (width - badgeW) / 2;
      const badgeY = (height - badgeH) / 2;

      ctx.save();
      // Carré blanc protecteur pour lisibilité optimale du logo
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;

      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6);
      } else {
        ctx.rect(badgeX, badgeY, badgeW, badgeH);
      }
      ctx.fill();

      // Liseré or officiel (#E9C349)
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = '#E9C349';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Dessin du logo officiel au centre
      ctx.drawImage(logoImg, badgeX + padX, badgeY + padY, logoTargetW, logoTargetH);
      ctx.restore();

      // Consignes tactiles sobres
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.fillStyle = '#E9C349';
      ctx.textAlign = 'center';
      ctx.fillText('PASS OFFICIEL SÉCURISÉ', width / 2, badgeY - 14);

      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.fillStyle = '#DCB8FF';
      ctx.fillText('✨ Frottez ici pour scanner ✨', width / 2, badgeY + badgeH + 22);

      ctx.font = '9px system-ui, sans-serif';
      ctx.fillStyle = '#8E8E93';
      ctx.fillText('(Protection anti-capture)', width / 2, badgeY + badgeH + 36);
    };
    logoImg.src = logoDataUri;
  }, { logoDataUri: logoBase64 });

  // Attendre le rendu de l'image
  await page.waitForTimeout(600);

  const card = await page.$('#ticketCard');
  const outputPath = path.join(__dirname, 'test-results', 'PREUVE_SCRATCH_CARD_LOGO_OFFICIEL.png');
  const wow4Path = path.join(__dirname, 'test-results', 'WOW_4_SCRATCH.png');
  await card.screenshot({ path: outputPath });
  await card.screenshot({ path: wow4Path });

  console.log(`[QA] SUCCÈS : Capture Scratch Card avec logo officiel sauvegardée sous :`);
  console.log(`   -> ${outputPath}`);

  await browser.close();
}

captureScratchOfficialLogo().catch((err) => {
  console.error('[QA] Erreur capture Scratch Card logo:', err);
  process.exit(1);
});
