const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const { chromium } = require('playwright');

// Données DataURL du dégradé PNG 500x1 px ultra-lisse (noir 92% à gauche -> transparent à droite)
const GRADIENT_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAfQAAAABCAYAAAAo/lyUAAAA70lEQVR4AVXBoXUDARBEMZkapP8yXUByP2DAPkuv9/vng5ycfMvJycnJycnJt5ycnJycnJycnJycnJycnJycnJycnJycnJxMTk5OTk5OTiYnJycnJ5OTk5PJycnJ5OTkZHJyMjk5mZycTE5OJieTk5PJyeRkcjI5mZxMTiYnk5PJyWRyMpmcTE4mk5PJZHIymZxMJpOTyWQymZxMJpPJZHIymUwmk8lkMplMJpPJZEImk8lkMpmQyWQyIZPJhEwmZDIhkwmZkAmZTMiEkAmZkAkhE0ImhJAJIWRCCCGEEEIIIYQQwoMQHoQHD8Iffv8BIjXnJKz++JQAAAAASUVORK5CYII=';

async function generateProofForEvent(options) {
  const {
    eventTitle,
    categoryName,
    dateStr,
    timeStr,
    venueStr,
    cityStr,
    quartierStr,
    promoterStr,
    priceVal,
    posterFileName,
    pdfOutputName,
    pngOutputName,
    ticketsPrefix,
    badgeColor,
    badgeTextColor,
  } = options;

  console.log(`\n======================================================`);
  console.log(`[TEST V4] Génération pour l'événement : ${eventTitle}`);
  console.log(`======================================================`);

  const logoPath = path.join(__dirname, 'public', 'logo-tight.png');
  const logoBuffer = fs.readFileSync(logoPath);
  const logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;

  const posterPath = path.join(__dirname, 'public', posterFileName);
  const posterBuffer = fs.readFileSync(posterPath);
  const posterBase64 = `data:image/jpeg;base64,${posterBuffer.toString('base64')}`;

  const jspdfPath = path.join(__dirname, 'node_modules', 'jspdf', 'dist', 'jspdf.umd.min.js');
  const jspdfCode = fs.readFileSync(jspdfPath, 'utf8');

  const jsbarcodePath = path.join(__dirname, 'node_modules', 'jsbarcode', 'dist', 'JsBarcode.all.min.js');
  const jsbarcodeCode = fs.readFileSync(jsbarcodePath, 'utf8');

  const tickets = [
    { qrCode: `${ticketsPrefix}-1001`, serialNumber: 1, agentName: 'Guichet Central 1' },
    { qrCode: `${ticketsPrefix}-1002`, serialNumber: 2, agentName: 'Agence Partenaire' },
    { qrCode: `${ticketsPrefix}-1003`, serialNumber: 3, agentName: 'Guichet Entree VIP' },
    { qrCode: `${ticketsPrefix}-1004`, serialNumber: 4, agentName: 'Reseau Billetterie' },
    { qrCode: `${ticketsPrefix}-1005`, serialNumber: 5, agentName: 'Point de Vente Express' },
  ];

  const rawQrs = {};
  for (const t of tickets) {
    rawQrs[t.qrCode] = await QRCode.toDataURL(t.qrCode, {
      margin: 1,
      width: 320,
      errorCorrectionLevel: 'H',
      color: { dark: '#000000', light: '#FFFFFF' },
    });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1800 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8"/>
        <script>${jspdfCode}</script>
        <script>${jsbarcodeCode}</script>
        <style>
          body {
            background-color: #07060b;
            margin: 0;
            padding: 30px;
            display: flex;
            justify-content: center;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          }
          #previewContainer {
            width: 860px;
            background: #ffffff;
            padding: 24px;
            border-radius: 20px;
            box-shadow: 0 30px 80px rgba(0,0,0,0.9);
          }
          .ticket-header {
            font-size: 14px;
            font-weight: 800;
            color: #121118;
            margin-bottom: 16px;
            border-bottom: 2px solid #E9C349;
            padding-bottom: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .canvas-card {
            margin-bottom: 12px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            border-radius: 8px;
            overflow: hidden;
          }
        </style>
      </head>
      <body>
        <div id="previewContainer">
          <div class="ticket-header">
            <div>
              <span style="color: #8A2BE2; font-weight: 900;">THIESDN BILLETTERIE</span>
              <span> — PLANCHE A4 PRINT VECTORIEL (5 BILLETS / PAGE)</span>
            </div>
            <span style="background: ${badgeColor}; color: ${badgeTextColor}; font-size: 11px; font-weight: 900; padding: 4px 10px; border-radius: 6px; text-transform: uppercase;">
              ${categoryName}
            </span>
          </div>
          <div id="ticketsHost"></div>
        </div>
      </body>
    </html>
  `);

  const pdfBase64 = await page.evaluate(
    async ({
      logoUri,
      posterUri,
      gradientUri,
      ticketsList,
      rawQrsMap,
      eventMeta,
    }) => {
      const { jsPDF } = window.jspdf;

      function sanitizeForPdf(input) {
        if (!input) return '';
        return String(input)
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^\x20-\x7E]/g, '')
          .trim();
      }

      function drawCropMark(doc, x, y) {
        const arm = 2.0;
        doc.setDrawColor(180, 180, 185);
        doc.setLineWidth(0.2);
        doc.line(x - arm, y, x + arm, y);
        doc.line(x, y - arm, x, y + arm);
      }

      async function getQrWithLogo(qrRawUri) {
        const canvas = document.createElement('canvas');
        const size = 320;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        const qrImg = new Image();
        await new Promise((res) => {
          qrImg.onload = res;
          qrImg.src = qrRawUri;
        });
        ctx.drawImage(qrImg, 0, 0, size, size);

        const logoImg = new Image();
        await new Promise((res) => {
          logoImg.onload = res;
          logoImg.src = logoUri;
        });

        const logoW = Math.floor(size * 0.24);
        const aspectRatio = 357 / 716;
        const logoH = Math.floor(logoW * aspectRatio);
        const padX = 7;
        const padY = 5;
        const badgeW = logoW + padX * 2;
        const badgeH = logoH + padY * 2;
        const badgeX = (size - badgeW) / 2;
        const badgeY = (size - badgeH) / 2;

        ctx.save();
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6);
        } else {
          ctx.rect(badgeX, badgeY, badgeW, badgeH);
        }
        ctx.fill();

        ctx.strokeStyle = '#E9C349';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.drawImage(logoImg, badgeX + padX, badgeY + padY, logoW, logoH);
        ctx.restore();

        return canvas.toDataURL('image/png');
      }

      function getBarcode1D(text) {
        const canvas = document.createElement('canvas');
        window.JsBarcode(canvas, text, {
          format: 'CODE128',
          width: 2,
          height: 48,
          displayValue: false,
          background: '#FFFFFF',
          lineColor: '#000000',
          margin: 2,
        });
        return canvas.toDataURL('image/png');
      }

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = 210;
      const marginX = 10;
      const ticketWidth = pageWidth - marginX * 2; // 190 mm
      const ticketHeight = 52; // 52 mm
      const ticketSpacing = 3; // 3 mm
      const marginTop = 12.5; // (297 - (5*52 + 4*3)) / 2 = 12.5 mm

      for (let i = 0; i < ticketsList.length; i++) {
        const t = ticketsList[i];
        const startY = marginTop + i * (ticketHeight + ticketSpacing);

        const qrDataUrl = await getQrWithLogo(rawQrsMap[t.qrCode]);
        const barcodeDataUrl = getBarcode1D(t.qrCode);

        // Repères de coupe (+) aux 4 coins
        drawCropMark(doc, marginX, startY);
        drawCropMark(doc, marginX + ticketWidth, startY);
        drawCropMark(doc, marginX, startY + ticketHeight);
        drawCropMark(doc, marginX + ticketWidth, startY + ticketHeight);

        // 1. Fond sombre de base
        doc.setFillColor(14, 14, 18);
        doc.rect(marginX, startY, ticketWidth, ticketHeight, 'F');

        // 2. Affiche officielle en plein fond du billet
        if (posterUri) {
          try {
            doc.addImage(posterUri, 'JPEG', marginX, startY, ticketWidth, ticketHeight);
          } catch (e) {
            console.error('Erreur insertion affiche:', e);
          }
        }

        // 3. Dégradé PNG horizontal étiré par-dessus l'affiche (zéro banding, lisibilité absolue)
        if (gradientUri) {
          try {
            doc.addImage(gradientUri, 'PNG', marginX, startY, ticketWidth, ticketHeight);
          } catch (e) {
            console.error('Erreur insertion dégradé PNG:', e);
          }
        }

        // 4. Liseré extérieur Or prestige (#E9C349)
        doc.setDrawColor(233, 195, 73);
        doc.setLineWidth(0.5);
        doc.rect(marginX, startY, ticketWidth, ticketHeight, 'D');

        // 5. En-tête : Logo Thièsdn + THIESDN BILLETTERIE + Badge Catégorie Or
        try {
          doc.addImage(logoUri, 'PNG', marginX + 3, startY + 1.2, 10, 5);
        } catch (e) {}

        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.text('THIESDN BILLETTERIE', marginX + 14.5, startY + 4.8);

        doc.setFontSize(5.5);
        doc.setTextColor(233, 195, 73);
        doc.text('OFFICIEL', marginX + 54, startY + 4.8);

        // Badge Catégorie Or à droite
        const badgeCategoryWidth = 36;
        const badgeCategoryHeight = 5.0;
        const badgeCategoryX = marginX + ticketWidth - badgeCategoryWidth - 3;
        const badgeCategoryY = startY + 1.2;

        doc.setFillColor(233, 195, 73);
        doc.roundedRect(badgeCategoryX, badgeCategoryY, badgeCategoryWidth, badgeCategoryHeight, 1.2, 1.2, 'F');

        doc.setTextColor(18, 18, 20);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.text(sanitizeForPdf(eventMeta.categoryName), badgeCategoryX + badgeCategoryWidth / 2, badgeCategoryY + 3.6, {
          align: 'center',
        });

        // Ligne de séparation dorée sous l'en-tête
        doc.setDrawColor(233, 195, 73);
        doc.setLineWidth(0.35);
        doc.line(marginX + 2, startY + 7.2, marginX + ticketWidth - 2, startY + 7.2);

        // 6. Zone Gauche : Contrôle d'accès (QR Code + Code-barres 1D sur fond blanc immaculé)
        const stubWidth = 48;
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(233, 195, 73);
        doc.setLineWidth(0.3);
        doc.roundedRect(marginX + 2.5, startY + 8.5, stubWidth - 3.5, 37, 1.5, 1.5, 'FD');

        const qrSize = 24;
        const qrX = marginX + 2.5 + (stubWidth - 3.5 - qrSize) / 2;
        const qrY = startY + 9.5;
        doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

        const barcodeW = 40;
        const barcodeH = 6;
        const barcodeX = marginX + 2.5 + (stubWidth - 3.5 - barcodeW) / 2;
        const barcodeY = startY + 34.2;
        doc.addImage(barcodeDataUrl, 'PNG', barcodeX, barcodeY, barcodeW, barcodeH);

        doc.setTextColor(20, 20, 20);
        doc.setFont('courier', 'bold');
        doc.setFontSize(5.2);
        doc.text(sanitizeForPdf(t.qrCode), marginX + 2.5 + (stubWidth - 3.5) / 2, startY + 42.2, {
          align: 'center',
        });

        doc.setTextColor(110, 110, 115);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(4.0);
        doc.text('SCAN QR OU DOUCHETTE LASER 1D', marginX + 2.5 + (stubWidth - 3.5) / 2, startY + 44.5, {
          align: 'center',
        });

        // Ligne pointillée séparatrice gauche
        doc.setDrawColor(180, 180, 180);
        doc.setLineDashPattern([1.5, 1.5], 0);
        doc.setLineWidth(0.25);
        doc.line(marginX + stubWidth + 1, startY + 7.5, marginX + stubWidth + 1, startY + 46.5);
        doc.setLineDashPattern([], 0);

        // 7. Zone Centrale : Métadonnées Événement 100% Dynamiques
        const bodyStartX = marginX + stubWidth + 4;
        const bodyWidth = 98;

        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        const cleanTitle = sanitizeForPdf(eventMeta.eventTitle).toUpperCase();
        doc.text(cleanTitle, bodyStartX, startY + 12);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.8);
        doc.setTextColor(233, 195, 73);
        doc.text(`DATE : ${sanitizeForPdf(eventMeta.dateStr)}  -  HEURE : ${sanitizeForPdf(eventMeta.timeStr)}`, bodyStartX, startY + 18.5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.2);
        doc.setTextColor(225, 225, 230);
        const loc = eventMeta.quartierStr ? `${eventMeta.venueStr} (${eventMeta.quartierStr}), ${eventMeta.cityStr}` : `${eventMeta.venueStr}, ${eventMeta.cityStr}`;
        doc.text(`LIEU : ${sanitizeForPdf(loc)}`, bodyStartX, startY + 24);

        doc.setFont('helvetica', 'italic');
        doc.setFontSize(6.2);
        doc.setTextColor(170, 170, 175);
        doc.text(`Organise par : ${sanitizeForPdf(eventMeta.promoterStr)}`, bodyStartX, startY + 29.5);

        doc.setFillColor(32, 26, 45);
        doc.setDrawColor(138, 43, 226);
        doc.setLineWidth(0.25);
        doc.roundedRect(bodyStartX, startY + 34, 55, 5, 1, 1, 'FD');

        doc.setTextColor(220, 184, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.2);
        doc.text(`CATEGORIE : ${sanitizeForPdf(eventMeta.categoryName).toUpperCase()}`, bodyStartX + 2.5, startY + 37.5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.0);
        doc.setTextColor(140, 140, 145);
        doc.text(
          'Pass officiel infalsifiable - Billet a usage unique avec controle instantane.',
          bodyStartX,
          startY + 44.5
        );

        // Ligne pointillée séparatrice droite
        doc.setDrawColor(180, 180, 180);
        doc.setLineDashPattern([1.5, 1.5], 0);
        doc.setLineWidth(0.25);
        doc.line(marginX + ticketWidth - 36, startY + 7.5, marginX + ticketWidth - 36, startY + 46.5);
        doc.setLineDashPattern([], 0);

        // 8. Zone Droite : Souche Guichet & Tarif Public 100% Dynamiques
        const rightStartX = marginX + ticketWidth - 34;
        doc.setFillColor(25, 22, 17);
        doc.setDrawColor(233, 195, 73);
        doc.setLineWidth(0.35);
        doc.roundedRect(rightStartX, startY + 8.5, 31.5, 37, 1.5, 1.5, 'FD');

        doc.setTextColor(233, 195, 73);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.0);
        doc.text(`PASS #${String(i + 1).padStart(3, '0')}`, rightStartX + 15.75, startY + 12.5, { align: 'center' });

        doc.setTextColor(180, 180, 185);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5.5);
        doc.text('TARIF PUBLIC', rightStartX + 15.75, startY + 17, { align: 'center' });

        doc.setTextColor(233, 195, 73);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.text(`${eventMeta.priceVal.toLocaleString('fr-FR')} F`, rightStartX + 15.75, startY + 23, {
          align: 'center',
        });

        doc.setTextColor(200, 200, 200);
        doc.setFontSize(5.5);
        doc.text('FCFA TTC', rightStartX + 15.75, startY + 26.5, { align: 'center' });

        doc.setFillColor(15, 15, 18);
        doc.roundedRect(rightStartX + 1.8, startY + 29, 28, 15, 1, 1, 'F');

        doc.setTextColor(150, 150, 155);
        doc.setFontSize(4.8);
        doc.text('POINT DE VENTE :', rightStartX + 3.2, startY + 32.5);

        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5.0);
        doc.text(t.agentName, rightStartX + 3.2, startY + 36.5);

        doc.setTextColor(138, 43, 226);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(4.8);
        doc.text('THIESDN BILLETTERIE', rightStartX + 15.75, startY + 41.5, { align: 'center' });

        // 9. Pied de page
        doc.setDrawColor(233, 195, 73);
        doc.setLineWidth(0.3);
        doc.line(marginX + 2, startY + 46.8, marginX + ticketWidth - 2, startY + 46.8);

        doc.setTextColor(150, 150, 155);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.0);
        doc.text(
          "Presentation obligatoire a l'entree. Billet strictement nominatif et infalsifiable.",
          marginX + 3.5,
          startY + 50.2
        );

        doc.setTextColor(233, 195, 73);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5.0);
        doc.text(
          'Thiesdn Officiel - DAW Digital Arts Work by MG',
          marginX + ticketWidth - 3.5,
          startY + 50.2,
          { align: 'right' }
        );
      }

      // Rendu HTML DOM en miroir pour capture d'écran
      const host = document.getElementById('ticketsHost');
      for (let i = 0; i < ticketsList.length; i++) {
        const t = ticketsList[i];
        const qrUrl = await getQrWithLogo(rawQrsMap[t.qrCode]);
        const barcodeUrl = getBarcode1D(t.qrCode);

        const card = document.createElement('div');
        card.className = 'canvas-card';
        card.style.position = 'relative';
        card.style.height = '145px';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.border = '1.5px solid #E9C349';
        card.style.background = '#0e0e12';
        card.style.color = '#ffffff';

        const locHtml = eventMeta.quartierStr
          ? `${eventMeta.venueStr} (${eventMeta.quartierStr}), ${eventMeta.cityStr}`
          : `${eventMeta.venueStr}, ${eventMeta.cityStr}`;

        const innerContent = [
          // Affiche en fond
          '<img src="' + posterUri + '" style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0.95; pointer-events: none;"/>',
          // Dégradé PNG lisse par-dessus l'affiche (noir 92% à gauche -> transparent à droite)
          '<img src="' + gradientUri + '" style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: fill; pointer-events: none; mix-blend-mode: normal;"/>',
          // En-tête
          '<div style="position: relative; z-index: 2; height: 26px; border-bottom: 1px solid rgba(233, 195, 73, 0.4); padding: 0 12px; display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.6);">',
          '  <div style="display: flex; align-items: center; gap: 8px;">',
          '    <img src="' + logoUri + '" style="height: 16px; object-fit: contain;"/>',
          '    <span style="font-size: 11px; font-weight: 900; letter-spacing: 0.5px;">THIESDN BILLETTERIE</span>',
          '    <span style="color: #E9C349; font-size: 9px; font-weight: 800;">OFFICIEL</span>',
          '  </div>',
          '  <div style="background: ' + eventMeta.badgeColor + '; color: ' + eventMeta.badgeTextColor + '; font-size: 9px; font-weight: 900; padding: 2px 10px; border-radius: 4px; text-transform: uppercase;">',
          '    ' + eventMeta.categoryName,
          '  </div>',
          '</div>',
          // Corps central
          '<div style="position: relative; z-index: 2; flex: 1; display: flex; padding: 6px 10px; gap: 10px;">',
          '  <div style="width: 140px; background: #ffffff; border-radius: 6px; border: 1px solid #E9C349; padding: 4px; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.4);">',
          '    <img src="' + qrUrl + '" style="width: 68px; height: 68px;"/>',
          '    <img src="' + barcodeUrl + '" style="width: 124px; height: 18px; margin-top: 2px;"/>',
          '    <span style="font-family: monospace; font-size: 8px; font-weight: bold; color: #121212; margin-top: 1px;">' + t.qrCode + '</span>',
          '  </div>',
          '  <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; padding-left: 6px;">',
          '    <div style="font-size: 14px; font-weight: 900; color: #ffffff; letter-spacing: 0.3px; text-shadow: 0 1px 3px rgba(0,0,0,0.8);">' + eventMeta.eventTitle.toUpperCase() + '</div>',
          '    <div style="color: #E9C349; font-size: 10px; font-weight: bold; margin-top: 3px; text-shadow: 0 1px 2px rgba(0,0,0,0.8);">DATE : ' + eventMeta.dateStr + '  -  HEURE : ' + eventMeta.timeStr + '</div>',
          '    <div style="color: #E5E7EB; font-size: 9px; margin-top: 2px; text-shadow: 0 1px 2px rgba(0,0,0,0.8);">LIEU : ' + locHtml + '</div>',
          '    <div style="color: #D1D5DB; font-size: 8px; font-style: italic; margin-top: 2px;">Organisé par : ' + eventMeta.promoterStr + '</div>',
          '    <div style="margin-top: 5px; display: flex; align-items: center; gap: 6px;">',
          '      <span style="background: rgba(138, 43, 226, 0.4); border: 1px solid #8A2BE2; color: #DCB8FF; font-size: 8px; font-weight: 800; padding: 1px 6px; border-radius: 4px;">CATÉGORIE : ' + eventMeta.categoryName.toUpperCase() + '</span>',
          '      <span style="color: #D1D5DB; font-size: 7.5px;">Pass infalsifiable - Billet nominatif</span>',
          '    </div>',
          '  </div>',
          '  <div style="width: 110px; background: rgba(25, 22, 17, 0.95); border: 1px solid #E9C349; border-radius: 6px; padding: 4px; display: flex; flex-direction: column; align-items: center; justify-content: space-between; box-shadow: 0 4px 10px rgba(0,0,0,0.4);">',
          '    <span style="color: #E9C349; font-size: 8px; font-weight: 800;">PASS #00' + (i + 1) + '</span>',
          '    <span style="color: #D1D5DB; font-size: 7.5px; font-weight: bold;">TARIF PUBLIC</span>',
          '    <div style="text-align: center;">',
          '      <span style="color: #E9C349; font-size: 13px; font-weight: 900;">' + eventMeta.priceVal.toLocaleString('fr-FR') + ' F</span>',
          '      <span style="color: #D1D5DB; font-size: 7px; display: block;">FCFA TTC</span>',
          '    </div>',
          '    <div style="background: rgba(0,0,0,0.6); padding: 2px 4px; border-radius: 4px; width: 90%; text-align: center;">',
          '      <span style="color: #9CA3AF; font-size: 6.5px; display: block;">POINT DE VENTE</span>',
          '      <span style="color: #ffffff; font-size: 7px; font-weight: bold; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + t.agentName + '</span>',
          '    </div>',
          '  </div>',
          '</div>',
          // Pied de page
          '<div style="position: relative; z-index: 2; height: 18px; border-top: 1px solid rgba(233, 195, 73, 0.3); padding: 0 10px; display: flex; align-items: center; justify-content: space-between; font-size: 7.5px; background: rgba(0,0,0,0.7);">',
          '  <span style="color: #D1D5DB;">Présentation obligatoire à l\'entrée. Billet strictement nominatif et infalsifiable.</span>',
          '  <span style="color: #E9C349; font-weight: bold;">Thièsdn Officiel — DAW Digital Arts Work by MG</span>',
          '</div>'
        ].join('\n');

        card.innerHTML = innerContent;
        host.appendChild(card);
      }

      return doc.output('datauristring');
    },
    {
      logoUri: logoBase64,
      posterUri: posterBase64,
      gradientUri: GRADIENT_PNG_DATA_URL,
      ticketsList: tickets,
      rawQrsMap: rawQrs,
      eventMeta: {
        eventTitle,
        categoryName,
        dateStr,
        timeStr,
        venueStr,
        cityStr,
        quartierStr,
        promoterStr,
        priceVal,
        badgeColor,
        badgeTextColor,
      },
    }
  );

  // 1. Sauvegarder le fichier PDF officiel
  const pdfBuffer = Buffer.from(pdfBase64.split(',')[1], 'base64');
  const pdfPath = path.join(__dirname, 'test-results', pdfOutputName);
  fs.writeFileSync(pdfPath, pdfBuffer);
  const pdfSizeKo = (pdfBuffer.length / 1024).toFixed(1);
  console.log(`[TEST V4] PDF sauvegardé : ${pdfPath} (${pdfSizeKo} Ko)`);

  // 2. Capture d'écran visuelle haute définition
  await page.waitForTimeout(600);
  const container = await page.$('#previewContainer');
  const screenshotPath = path.join(__dirname, 'test-results', pngOutputName);
  await container.screenshot({ path: screenshotPath });
  console.log(`[TEST V4] Capture visuelle sauvegardée : ${screenshotPath}`);

  await browser.close();
}

async function main() {
  // Test 1 : KMOU JANGO (Affiche claire et festive)
  await generateProofForEvent({
    eventTitle: 'KMOU JANGO — Nuit Mythique',
    categoryName: 'VIP PRESTIGE',
    dateStr: 'Samedi 07 Novembre 2026',
    timeStr: '21h00 - 05h00',
    venueStr: 'Stade Lat Dior & Complexe',
    cityStr: 'Thiès',
    quartierStr: 'Médina Fall',
    promoterStr: 'Thiès Nights Production',
    priceVal: 10000,
    posterFileName: 'poster-kmou-jango.jpg',
    pdfOutputName: 'PREUVE_BILLETS_KMOU_V4.pdf',
    pngOutputName: 'PREUVE_BILLETS_KMOU_V4.png',
    ticketsPrefix: 'THIESDN-KMOU-VIP',
    badgeColor: '#E9C349',
    badgeTextColor: '#241A00',
  });

  // Test 2 : SALY JAZZ FESTIVAL (Affiche sombre et feutrée de saxophone/jazz)
  await generateProofForEvent({
    eventTitle: 'SALY JAZZ FESTIVAL 2026',
    categoryName: 'CARRÉ OR PRIVILÈGE',
    dateStr: 'Vendredi 18 Décembre 2026',
    timeStr: '20h30 - 03h00',
    venueStr: 'Lamantin Beach Hôtel & Spa',
    cityStr: 'Saly Portudal',
    quartierStr: 'Front de Mer',
    promoterStr: 'Saly Jazz & Live Production',
    priceVal: 15000,
    posterFileName: 'poster-saly-jazz.jpg',
    pdfOutputName: 'PREUVE_BILLETS_SALY_V4.pdf',
    pngOutputName: 'PREUVE_BILLETS_SALY_V4.png',
    ticketsPrefix: 'THIESDN-SALY-GOLD',
    badgeColor: '#10B981',
    badgeTextColor: '#FFFFFF',
  });

  console.log('\n======================================================');
  console.log('✅ TOUS LES TESTS DYNAMIQUES V4 ONT ÉTÉ EXÉCUTÉS AVEC SUCCÈS !');
  console.log('======================================================');
}

main().catch((err) => {
  console.error('[TEST V4] Erreur globale:', err);
  process.exit(1);
});
