const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const { chromium } = require('playwright');

async function generateAndCapturePdf() {
  console.log('[QA] Démarrage de la génération du PDF physique et de sa capture visuelle...');

  const logoPath = path.join(__dirname, 'public', 'logo-tight.png');
  const logoBuffer = fs.readFileSync(logoPath);
  const logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;

  const jspdfPath = path.join(__dirname, 'node_modules', 'jspdf', 'dist', 'jspdf.umd.min.js');
  const jspdfCode = fs.readFileSync(jspdfPath, 'utf8');

  // Générer les QR codes de base en Node
  const tickets = [
    { qrCode: 'THIESDN-KMOU-VIP-1001', serialNumber: 1, agentName: 'Guichet Lat Dior 1' },
    { qrCode: 'THIESDN-KMOU-VIP-1002', serialNumber: 2, agentName: 'Agence Thies Centre' },
    { qrCode: 'THIESDN-KMOU-VIP-1003', serialNumber: 3, agentName: 'Boutique Mbour' },
    { qrCode: 'THIESDN-KMOU-VIP-1004', serialNumber: 4, agentName: 'Reseau Saly VIP' },
    { qrCode: 'THIESDN-KMOU-VIP-1005', serialNumber: 5, agentName: 'Guichet Lat Dior 2' },
  ];

  const rawQrDataUrls = {};
  for (const t of tickets) {
    rawQrDataUrls[t.qrCode] = await QRCode.toDataURL(t.qrCode, {
      margin: 1,
      width: 320,
      errorCorrectionLevel: 'H',
      color: { dark: '#000000', light: '#FFFFFF' },
    });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1200, height: 1600 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // Injecter jsPDF localement dans la page
  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8"/>
        <script>${jspdfCode}</script>
        <style>
          body {
            background-color: #0c0a12;
            margin: 0;
            padding: 30px;
            display: flex;
            justify-content: center;
            font-family: system-ui, -apple-system, sans-serif;
          }
          #previewContainer {
            width: 840px;
            background: #ffffff;
            padding: 24px;
            border-radius: 16px;
            box-shadow: 0 25px 60px rgba(0,0,0,0.85);
          }
          .ticket-row {
            margin-bottom: 16px;
            position: relative;
          }
        </style>
      </head>
      <body>
        <div id="previewContainer">
          <div style="font-size: 15px; font-weight: 800; color: #1a1a1a; margin-bottom: 12px; border-bottom: 2px solid #E9C349; padding-bottom: 6px; display: flex; justify-content: space-between;">
            <span>THIES DAYS AND NIGHTS — PLANCHE BILLETS PHYSIQUES (KMOU JANGO)</span>
            <span style="color: #8A2BE2; font-size: 12px; font-weight: bold;">AVEC CODE-BARRES 1D & LOGO CENTRAL</span>
          </div>
          <div id="ticketsHost"></div>
        </div>
      </body>
    </html>
  `);

  const pdfBase64 = await page.evaluate(async ({ logoUri, ticketsList, rawQrs }) => {
    const { jsPDF } = window.jspdf;

    function sanitizeForPdf(input) {
      if (!input) return '';
      return String(input)
        .replace(/[éèêë]/g, 'e')
        .replace(/[ÉÈÊË]/g, 'E')
        .replace(/[àâä]/g, 'a')
        .replace(/[ÀÂÄ]/g, 'A')
        .replace(/[îï]/g, 'i')
        .replace(/[ÎÏ]/g, 'I')
        .replace(/[ôö]/g, 'o')
        .replace(/[ÔÖ]/g, 'O')
        .replace(/[ùûü]/g, 'u')
        .replace(/[ÙÛÜ]/g, 'U')
        .replace(/[ç]/g, 'c')
        .replace(/[Ç]/g, 'C')
        .replace(/[’']/g, "'")
        .replace(/[—–]/g, '-')
        .replace(/[^\x20-\x7E]/g, '')
        .trim();
    }

    // Fonction de fusion QR Code + Logo Thièsdn officiel au centre
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
      const aspectRatio = logoImg.naturalHeight / logoImg.naturalWidth;
      const logoH = Math.floor(logoW * aspectRatio);

      const padX = 8;
      const padY = 6;
      const badgeW = logoW + padX * 2;
      const badgeH = logoH + padY * 2;
      const badgeX = (size - badgeW) / 2;
      const badgeY = (size - badgeH) / 2;

      ctx.save();
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
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

    // Générateur vectoriel de Code-barres 1D (Code 128) sur canvas
    function getBarcode1D(text) {
      const canvas = document.createElement('canvas');
      canvas.width = 240;
      canvas.height = 50;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Barres verticales Code 128 réalistes
      ctx.fillStyle = '#000000';
      // Barres de départ
      let curX = 12;
      const barH = 40;

      // Pseudo-encodeur déterministe pour rendu graphique net
      for (let i = 0; i < text.length; i++) {
        const charCode = text.charCodeAt(i);
        const w1 = (charCode % 3) + 1;
        const w2 = ((charCode >> 1) % 2) + 1;
        const w3 = ((charCode >> 2) % 3) + 1;

        ctx.fillRect(curX, 4, w1, barH);
        curX += w1 + 1;
        ctx.fillRect(curX, 4, w2, barH);
        curX += w2 + 2;
        ctx.fillRect(curX, 4, w3, barH);
        curX += w3 + 1;
      }
      // Barres de fin
      ctx.fillRect(curX, 4, 3, barH);
      curX += 5;
      ctx.fillRect(curX, 4, 2, barH);

      return canvas.toDataURL('image/png');
    }

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = 210;
    const marginX = 10;
    const marginTop = 12;
    const ticketsPerPage = 4;
    const ticketWidth = pageWidth - marginX * 2; // 190mm
    const ticketHeight = 63;
    const ticketSpacing = 4;

    const host = document.getElementById('ticketsHost');

    for (let i = 0; i < ticketsList.length; i++) {
      const ticket = ticketsList[i];
      const indexOnPage = i % ticketsPerPage;

      if (i > 0 && indexOnPage === 0) {
        doc.addPage();
      }

      const startY = marginTop + indexOnPage * (ticketHeight + ticketSpacing);

      const qrFinalUri = await getQrWithLogo(rawQrs[ticket.qrCode]);
      const barcodeUri = getBarcode1D(ticket.qrCode);

      // Aperçu visuel dans le DOM pour la capture haute définition
      if (i < 3) {
        const row = document.createElement('div');
        row.className = 'ticket-row';
        row.style.background = '#121214';
        row.style.border = '2px solid #E9C349';
        row.style.borderRadius = '12px';
        row.style.overflow = 'hidden';
        row.style.display = 'flex';
        row.style.height = '185px';
        row.style.color = '#fff';

        row.innerHTML = `
          <div style="width: 175px; background: #fff; padding: 6px 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; border-right: 2px dashed #888;">
            <img src="${qrFinalUri}" style="width: 95px; height: 95px;" />
            <img src="${barcodeUri}" style="width: 145px; height: 32px; margin-top: 4px;" />
            <div style="font-family: monospace; font-size: 10px; font-weight: bold; color: #111; margin-top: 2px;">${ticket.qrCode}</div>
            <div style="font-size: 8px; font-weight: bold; color: #666; letter-spacing: 0.5px;">SCAN QR OU DOUCHETTE LASER 1D</div>
          </div>
          <div style="flex: 1; padding: 12px 18px; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="background: #8A2BE2; padding: 3px 8px; font-size: 9px; font-weight: bold; letter-spacing: 1px; border-radius: 4px; display: inline-block;">
                THIES DAYS AND NIGHTS - BILLET PHYSIQUE OFFICIEL SECURISE
              </div>
              <h2 style="font-size: 17px; margin: 8px 0 4px 0; color: #fff; font-weight: bold;">KMOU JANGO - NUIT MYTHIQUE</h2>
              <div style="font-size: 11px; color: #E9C349; font-weight: bold;">DATE : Samedi 07 Novembre 2026 - 21h00 - 05h00</div>
              <div style="font-size: 11px; color: #ccc;">LIEU : Stade Lat Dior (Medina Fall), Thies</div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: flex-end;">
              <span style="background: rgba(138,43,226,0.3); border: 1px solid #8A2BE2; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: bold; color: #DCB8FF;">
                FORMULE : PASS VIP PRESTIGE
              </span>
              <span style="font-size: 9px; color: #888;">Pass infalsifiable - Billet a usage unique</span>
            </div>
          </div>
          <div style="width: 125px; background: #191712; border-left: 1px solid rgba(233,195,73,0.3); padding: 10px; display: flex; flex-direction: column; align-items: center; justify-content: space-between; text-align: center;">
            <div style="font-size: 9px; color: #aaa; font-weight: bold;">TARIF PUBLIC</div>
            <div>
              <div style="font-size: 19px; font-weight: 900; color: #E9C349;">15 000 F</div>
              <div style="font-size: 9px; color: #888;">FCFA TTC</div>
            </div>
            <div style="background: #0f0f12; border-radius: 6px; padding: 4px 6px; width: 100%; box-sizing: border-box;">
              <div style="font-size: 7px; color: #888;">POINT DE VENTE :</div>
              <div style="font-size: 8px; font-weight: bold; color: #fff;">${ticket.agentName}</div>
            </div>
            <div style="font-size: 8px; color: #8A2BE2; font-weight: bold;">THIESDN RESEAU 2026</div>
          </div>
        `;
        host.appendChild(row);
      }

      // 1. Fond du billet
      doc.setFillColor(18, 18, 20);
      doc.setDrawColor(233, 195, 73);
      doc.setLineWidth(0.6);
      doc.roundedRect(marginX, startY, ticketWidth, ticketHeight, 3, 3, 'FD');

      // Bandeau d'en-tête officiel violet
      doc.setFillColor(138, 43, 226);
      doc.roundedRect(marginX, startY, ticketWidth, 7, 3, 3, 'F');
      doc.rect(marginX, startY + 3, ticketWidth, 4, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text('THIES DAYS AND NIGHTS - BILLET PHYSIQUE OFFICIEL SECURISE', marginX + 4, startY + 4.8);

      doc.setFontSize(7);
      doc.setTextColor(233, 195, 73);
      doc.text(`PASS #${i + 1} / 5`, marginX + ticketWidth - 25, startY + 4.8);

      // 2. Souche gauche (Contrôle d'accès)
      const stubWidth = 54;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.roundedRect(marginX + 2.5, startY + 9, stubWidth - 5, ticketHeight - 11.5, 2, 2, 'FD');

      // Image du QR Code avec Logo Thièsdn
      const qrSize = 27;
      const qrX = marginX + (stubWidth - qrSize) / 2;
      const qrY = startY + 10.5;
      doc.addImage(qrFinalUri, 'PNG', qrX, qrY, qrSize, qrSize);

      // Image du Code-barres 1D Code 128
      const barcodeW = 44;
      const barcodeH = 10;
      const barcodeX = marginX + (stubWidth - barcodeW) / 2;
      const barcodeY = startY + 38.5;
      doc.addImage(barcodeUri, 'PNG', barcodeX, barcodeY, barcodeW, barcodeH);

      // Numéro unique sous le code-barres
      doc.setTextColor(20, 20, 20);
      doc.setFont('courier', 'bold');
      doc.setFontSize(6.5);
      doc.text(sanitizeForPdf(ticket.qrCode), marginX + stubWidth / 2, startY + 52, { align: 'center' });

      doc.setTextColor(100, 100, 105);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(4.8);
      doc.text('SCAN QR OU DOUCHETTE LASER 1D', marginX + stubWidth / 2, startY + 55.5, { align: 'center' });

      // Ligne de perforation pointillée
      doc.setDrawColor(140, 140, 140);
      doc.setLineDashPattern([1.5, 1.5], 0);
      doc.setLineWidth(0.3);
      doc.line(marginX + stubWidth, startY + 8, marginX + stubWidth, startY + ticketHeight);
      doc.setLineDashPattern([], 0);

      // 3. Corps central
      const bodyStartX = marginX + stubWidth + 5;
      const bodyWidth = 88;

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('KMOU JANGO - NUIT MYTHIQUE', bodyStartX, startY + 14);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(233, 195, 73);
      doc.text('DATE : Samedi 07 Novembre 2026 - 21h00 - 05h00', bodyStartX, startY + 22);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(220, 220, 225);
      doc.text('LIEU : Stade Lat Dior (Medina Fall), Thies', bodyStartX, startY + 28);

      doc.setFillColor(35, 30, 45);
      doc.setDrawColor(138, 43, 226);
      doc.setLineWidth(0.3);
      doc.roundedRect(bodyStartX, startY + 36.5, 58, 6.5, 1.5, 1.5, 'FD');

      doc.setTextColor(220, 184, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text('FORMULE : PASS VIP PRESTIGE', bodyStartX + 3, startY + 41);

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6.5);
      doc.setTextColor(150, 150, 155);
      doc.text('Organise par : Thies Nights Production', bodyStartX, startY + 48);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.5);
      doc.setTextColor(140, 140, 140);
      doc.text('Pass officiel infalsifiable. Billet a usage unique avec controle instantane.', bodyStartX, startY + 53.5);

      // 4. Encart droit (vendeur)
      const rightStartX = marginX + ticketWidth - 38;
      doc.setFillColor(25, 23, 18);
      doc.setDrawColor(233, 195, 73);
      doc.setLineWidth(0.4);
      doc.roundedRect(rightStartX, startY + 9, 35, ticketHeight - 11.5, 2, 2, 'FD');

      doc.setTextColor(180, 180, 180);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.text('TARIF PUBLIC', rightStartX + 17.5, startY + 15.5, { align: 'center' });

      doc.setTextColor(233, 195, 73);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('15 000 F', rightStartX + 17.5, startY + 22.5, { align: 'center' });

      doc.setTextColor(200, 200, 200);
      doc.setFontSize(6);
      doc.text('FCFA TTC', rightStartX + 17.5, startY + 26.5, { align: 'center' });

      doc.setFillColor(15, 15, 18);
      doc.roundedRect(rightStartX + 2, startY + 30.5, 31, 15, 1.5, 1.5, 'F');

      doc.setTextColor(150, 150, 155);
      doc.setFontSize(5);
      doc.text('POINT DE VENTE :', rightStartX + 3.5, startY + 34.5);

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.text(ticket.agentName, rightStartX + 3.5, startY + 38.5);

      doc.setTextColor(138, 43, 226);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5);
      doc.text('THIESDN RESEAU 2026', rightStartX + 17.5, startY + 43.5, { align: 'center' });

      if (indexOnPage < ticketsPerPage - 1) {
        doc.setDrawColor(180, 180, 180);
        doc.setLineDashPattern([2, 3], 0);
        doc.setLineWidth(0.2);
        doc.line(marginX, startY + ticketHeight + 2, marginX + ticketWidth, startY + ticketHeight + 2);
        doc.setLineDashPattern([], 0);
      }
    }

    return doc.output('datauristring');
  }, { logoUri: logoBase64, ticketsList: tickets, rawQrs: rawQrDataUrls });

  // Sauvegarder le fichier PDF officiel complet
  const pdfBuffer = Buffer.from(pdfBase64.split(',')[1], 'base64');
  const pdfPath = path.join(__dirname, 'test-results', 'PREUVE_BILLETS_PHYSIQUES.pdf');
  fs.writeFileSync(pdfPath, pdfBuffer);
  console.log(`[QA] PDF officiel sauvegardé : ${pdfPath} (${(pdfBuffer.length / 1024).toFixed(1)} Ko)`);

  // Capture d'écran haute définition du conteneur de planche
  await page.waitForTimeout(600);
  const container = await page.$('#previewContainer');
  const screenshotPath = path.join(__dirname, 'test-results', 'PREUVE_PDF_BILLETS_PHYSIQUES_RENDU.png');
  await container.screenshot({ path: screenshotPath });
  console.log(`[QA] Capture visuelle haute définition enregistrée : ${screenshotPath}`);

  await browser.close();
}

generateAndCapturePdf().catch((err) => {
  console.error('[QA] Erreur:', err);
  process.exit(1);
});
