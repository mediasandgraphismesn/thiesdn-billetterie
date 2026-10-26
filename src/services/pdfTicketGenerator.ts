import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import { EventItem, TicketTier, UserTicket } from '../types';
import { LOGO_TIGHT_DATA_URL } from '../assets/logoTightBase64';

export interface GeneratePdfOptions {
  batchName?: string;
  onProgress?: (current: number, total: number) => void;
}

/**
 * Nettoie les textes pour jsPDF :
 * jsPDF avec les polices de base (Helvetica/Courier) ne supporte pas les emojis ni l'UTF-8 étendu.
 * Cette fonction remplace les accents par leur équivalent ASCII propre et supprime tout emoji ou caractère corrompu.
 */
export function sanitizeForPdf(input: string | null | undefined): string {
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
    // Supprime catégoriquement tout caractère hors ASCII imprimable standard (dont emojis 📍, ⭐, 👤, etc.)
    .replace(/[^\x20-\x7E]/g, '')
    .trim();
}

/**
 * Génère un QR Code fusionné en haute résolution avec le logo officiel Thièsdn au centre.
 */
async function generateQrWithLogoDataUrl(text: string): Promise<string> {
  const qrSize = 320;

  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = qrSize;
    canvas.height = qrSize;

    await QRCode.toCanvas(canvas, text, {
      width: qrSize,
      margin: 1,
      errorCorrectionLevel: 'H',
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    const ctx = canvas.getContext('2d');
    if (ctx) {
      const logoImg = new Image();
      logoImg.crossOrigin = 'anonymous';

      await new Promise<void>((resolve) => {
        logoImg.onload = () => resolve();
        logoImg.onerror = () => resolve();
        logoImg.src = LOGO_TIGHT_DATA_URL;
      });

      // Logo au centre (~24% de la largeur du QR)
      const logoW = Math.floor(qrSize * 0.24);
      const aspectRatio = 357 / 716;
      const logoH = Math.floor(logoW * aspectRatio);

      const padX = 7;
      const padY = 5;
      const badgeW = logoW + padX * 2;
      const badgeH = logoH + padY * 2;
      const badgeX = (qrSize - badgeW) / 2;
      const badgeY = (qrSize - badgeH) / 2;

      ctx.save();
      // Badge blanc protecteur avec ombre douce
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;

      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6);
      } else {
        ctx.rect(badgeX, badgeY, badgeW, badgeH);
      }
      ctx.fill();

      // Liseré or officiel Thièsdn (#E9C349)
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = '#E9C349';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Dessin de l'image officielle du logo
      ctx.drawImage(logoImg, badgeX + padX, badgeY + padY, logoW, logoH);
      ctx.restore();
    }

    return canvas.toDataURL('image/png');
  }

  // Fallback si environnement sans DOM
  return QRCode.toDataURL(text, {
    width: qrSize,
    margin: 1,
    errorCorrectionLevel: 'H',
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
  });
}

/**
 * Génère un code-barres 1D (Code 128) via JsBarcode.
 */
function generateBarcode1DDataUrl(text: string): string {
  if (typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, text, {
        format: 'CODE128',
        width: 2,
        height: 45,
        displayValue: false, // Valeur écrite vectoriellement par jsPDF en dessous
        background: '#FFFFFF',
        lineColor: '#000000',
        margin: 2,
      });
      return canvas.toDataURL('image/png');
    } catch (e) {
      console.warn('Erreur génération code-barres 1D:', e);
    }
  }
  return '';
}

/**
 * Génère une planche de billets physiques imprimables au format A4 (4 billets par page)
 * Chaque billet dispose d'une souche de contrôle d'accès avec QR Code officiel (logo centré),
 * code-barres 1D (Code 128 pour douchette laser), corps de l'événement et encart vendeur détachable.
 */
export const generatePhysicalTicketsPdf = async (
  event: EventItem,
  tier: TicketTier,
  tickets: UserTicket[],
  options: GeneratePdfOptions = {}
): Promise<Blob> => {
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
  const ticketHeight = 63; // 63mm x 4 = 252mm + spacing = 270mm (sur 297mm A4)
  const ticketSpacing = 4;

  const total = tickets.length;

  for (let i = 0; i < total; i++) {
    const ticket = tickets[i];
    const indexOnPage = i % ticketsPerPage;

    if (i > 0 && indexOnPage === 0) {
      doc.addPage();
    }

    if (options.onProgress) {
      options.onProgress(i + 1, total);
    }

    const startY = marginTop + indexOnPage * (ticketHeight + ticketSpacing);

    // 1. Génération du QR Code officiel avec logo Thièsdn au centre
    const qrDataUrl = await generateQrWithLogoDataUrl(ticket.qrCode);

    // 2. Génération du code-barres 1D Code 128
    const barcodeDataUrl = generateBarcode1DDataUrl(ticket.qrCode);

    // =================================================================
    // DESSIN DU BILLET (Cadre Nocturnal Elegance Imprimable)
    // =================================================================

    // Fond du billet principal (Gris anthracite très sombre)
    doc.setFillColor(18, 18, 20);
    doc.setDrawColor(233, 195, 73); // Liseré Or chaud
    doc.setLineWidth(0.6);
    doc.roundedRect(marginX, startY, ticketWidth, ticketHeight, 3, 3, 'FD');

    // Bandeau d'en-tête officiel
    doc.setFillColor(138, 43, 226); // Violet Thièsdn
    doc.roundedRect(marginX, startY, ticketWidth, 7, 3, 3, 'F');
    // Correction des coins bas du bandeau
    doc.rect(marginX, startY + 3, ticketWidth, 4, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(
      'THIES DAYS AND NIGHTS - BILLET PHYSIQUE OFFICIEL SECURISE',
      marginX + 4,
      startY + 4.8
    );

    doc.setFontSize(7);
    doc.setTextColor(233, 195, 73);
    const serialStr = ticket.serialNumber
      ? `N ${String(ticket.serialNumber).padStart(4, '0')} / ${String(total).padStart(4, '0')}`
      : `PASS #${i + 1}`;
    doc.text(serialStr, marginX + ticketWidth - 32, startY + 4.8);

    // =================================================================
    // 1. SOUCHE GAUCHE : CONTRÔLE D'ACCÈS (QR CODE + CODE-BARRES 1D)
    // =================================================================
    const stubWidth = 54;
    // Fond blanc pour garantir le contraste du scan optique et laser
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.roundedRect(marginX + 2.5, startY + 9, stubWidth - 5, ticketHeight - 11.5, 2, 2, 'FD');

    // A. Image du QR Code officiel avec Logo Thièsdn (27 mm x 27 mm)
    const qrSize = 27;
    const qrX = marginX + (stubWidth - qrSize) / 2;
    const qrY = startY + 10.5;
    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

    // Si pas de DOM (Node), dessiner le badge blanc et le logo de secours
    if (typeof document === 'undefined') {
      const logoW = qrSize * 0.24;
      const logoH = logoW * (357 / 716);
      const padX = 0.9;
      const padY = 0.7;
      const badgeW = logoW + padX * 2;
      const badgeH = logoH + padY * 2;
      const badgeX = qrX + (qrSize - badgeW) / 2;
      const badgeY = qrY + (qrSize - badgeH) / 2;

      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(233, 195, 73);
      doc.setLineWidth(0.2);
      doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 0.5, 0.5, 'FD');
      doc.addImage(LOGO_TIGHT_DATA_URL, 'PNG', badgeX + padX, badgeY + padY, logoW, logoH);
    }

    // B. Code-barres 1D Code 128 (Largeur 44mm, Hauteur 10mm)
    const barcodeW = 44;
    const barcodeH = 10;
    const barcodeX = marginX + (stubWidth - barcodeW) / 2;
    const barcodeY = startY + 38.5;

    if (barcodeDataUrl) {
      doc.addImage(barcodeDataUrl, 'PNG', barcodeX, barcodeY, barcodeW, barcodeH);
    } else {
      // Cadre de secours pour le code-barres
      doc.setFillColor(245, 245, 245);
      doc.rect(barcodeX, barcodeY, barcodeW, barcodeH, 'F');
    }

    // Texte sous le code-barres (Identifiant unique du billet)
    doc.setTextColor(20, 20, 20);
    doc.setFont('courier', 'bold');
    doc.setFontSize(6.5);
    doc.text(sanitizeForPdf(ticket.qrCode), marginX + stubWidth / 2, startY + 52, {
      align: 'center',
    });

    doc.setTextColor(100, 100, 105);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(4.8);
    doc.text('SCAN QR OU DOUCHETTE LASER 1D', marginX + stubWidth / 2, startY + 55.5, {
      align: 'center',
    });

    // Ligne de découpe pointillée entre la souche et le corps
    doc.setDrawColor(140, 140, 140);
    doc.setLineDashPattern([1.5, 1.5], 0);
    doc.setLineWidth(0.3);
    doc.line(marginX + stubWidth, startY + 8, marginX + stubWidth, startY + ticketHeight);
    doc.setLineDashPattern([], 0); // Réinitialiser le style de ligne

    // =================================================================
    // 2. CORPS CENTRAL : DÉTAILS DE L'ÉVÉNEMENT
    // =================================================================
    const bodyStartX = marginX + stubWidth + 5;
    const bodyWidth = 88;

    // Titre de l'événement (sans emojis ni caractères corrompus)
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    const cleanTitle = sanitizeForPdf(event.title).toUpperCase();
    const titleLines = doc.splitTextToSize(cleanTitle, bodyWidth);
    doc.text(titleLines.slice(0, 2), bodyStartX, startY + 14);

    const titleOffset = titleLines.length > 1 ? 4 : 0;

    // Date & Heure (propre sans emojis)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(233, 195, 73); // Or
    const cleanDate = sanitizeForPdf(event.date);
    const cleanTime = sanitizeForPdf(event.time);
    doc.text(`DATE : ${cleanDate} - ${cleanTime}`, bodyStartX, startY + 22 + titleOffset);

    // Lieu & Ville (propre sans emojis)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(220, 220, 225);
    const cleanVenue = sanitizeForPdf(event.venue);
    const cleanQuartier = event.quartier ? ` (${sanitizeForPdf(event.quartier)})` : '';
    const cleanCity = sanitizeForPdf(event.city);
    const locationStr = `LIEU : ${cleanVenue}${cleanQuartier}, ${cleanCity}`;
    const locationLines = doc.splitTextToSize(locationStr, bodyWidth);
    doc.text(locationLines.slice(0, 2), bodyStartX, startY + 28 + titleOffset);

    // Catégorie / Formule
    doc.setFillColor(35, 30, 45);
    doc.setDrawColor(138, 43, 226);
    doc.setLineWidth(0.3);
    doc.roundedRect(bodyStartX, startY + 36.5 + titleOffset, 58, 6.5, 1.5, 1.5, 'FD');

    doc.setTextColor(220, 184, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    const cleanTierName = sanitizeForPdf(tier.name).toUpperCase();
    doc.text(`FORMULE : ${cleanTierName}`, bodyStartX + 3, startY + 41 + titleOffset);

    // Organisateur officiel
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.setTextColor(150, 150, 155);
    const cleanPromoter = sanitizeForPdf(event.promoter.name);
    doc.text(`Organise par : ${cleanPromoter}`, bodyStartX, startY + 48 + titleOffset);

    // Consigne de sécurité
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(140, 140, 140);
    doc.text(
      'Pass officiel infalsifiable. Billet a usage unique avec controle instantane.',
      bodyStartX,
      startY + 53.5
    );

    // =================================================================
    // 3. ENCART DROIT : SOUCHE GUICHET & TARIF PUBLIC
    // =================================================================
    const rightStartX = marginX + ticketWidth - 38;
    doc.setFillColor(25, 23, 18);
    doc.setDrawColor(233, 195, 73);
    doc.setLineWidth(0.4);
    doc.roundedRect(rightStartX, startY + 9, 35, ticketHeight - 11.5, 2, 2, 'FD');

    doc.setTextColor(180, 180, 180);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text('TARIF PUBLIC', rightStartX + 17.5, startY + 15.5, { align: 'center' });

    // Prix en grand
    doc.setTextColor(233, 195, 73);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`${tier.price.toLocaleString('fr-FR')} F`, rightStartX + 17.5, startY + 22.5, {
      align: 'center',
    });

    doc.setTextColor(200, 200, 200);
    doc.setFontSize(6);
    doc.text('FCFA TTC', rightStartX + 17.5, startY + 26.5, { align: 'center' });

    // Zone attribution collaborateur
    doc.setFillColor(15, 15, 18);
    doc.roundedRect(rightStartX + 2, startY + 30.5, 31, 15, 1.5, 1.5, 'F');

    doc.setTextColor(150, 150, 155);
    doc.setFontSize(5);
    doc.text('POINT DE VENTE :', rightStartX + 3.5, startY + 34.5);

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    const agentDisplay = sanitizeForPdf(ticket.agentName) || 'Reseau Partenaire';
    doc.text(agentDisplay.slice(0, 16), rightStartX + 3.5, startY + 38.5);

    doc.setTextColor(138, 43, 226);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5);
    doc.text('THIESDN RESEAU 2026', rightStartX + 17.5, startY + 43.5, { align: 'center' });

    // Découpe extérieure en pointillés pour faciliter la coupe aux ciseaux
    if (indexOnPage < ticketsPerPage - 1) {
      doc.setDrawColor(180, 180, 180);
      doc.setLineDashPattern([2, 3], 0);
      doc.setLineWidth(0.2);
      doc.line(marginX, startY + ticketHeight + 2, marginX + ticketWidth, startY + ticketHeight + 2);
      doc.setLineDashPattern([], 0);
    }
  }

  return doc.output('blob');
};
