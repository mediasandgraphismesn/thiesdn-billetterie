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
 * Transforme les accents en ASCII pur (é -> e, à -> a, etc.) via décomposition canonique NFD
 * et supprime les caractères non ASCII pour éviter tout caractère corrompu ou crash jsPDF.
 */
export function sanitizeForPdf(input: string | null | undefined): string {
  if (!input) return '';
  return String(input)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
    .trim();
}

/**
 * Dessine un repère de coupe en croix (+) aux coins d'un billet pour faciliter le massicotage.
 */
function drawCropMark(doc: jsPDF, x: number, y: number): void {
  const arm = 2.0;
  doc.setDrawColor(180, 180, 185);
  doc.setLineWidth(0.2);
  doc.line(x - arm, y, x + arm, y);
  doc.line(x, y - arm, x, y + arm);
}

// DataURL d'un PNG 500x1 pixels pré-généré avec un dégradé linéaire horizontal ultra-lisse (296 octets décodés)
// 0% -> rgba(10, 10, 14, 0.92) | 45% -> rgba(10, 10, 14, 0.85) | 70% -> rgba(10, 10, 14, 0.40) | 100% -> rgba(10, 10, 14, 0.0)
const DEFAULT_GRADIENT_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAfQAAAABCAYAAAAo/lyUAAAA70lEQVR4AVXBoXUDARBEMZkapP8yXUByP2DAPkuv9/vng5ycfMvJycnJycnJt5ycnJycnJycnJycnJycnJycnJycnJycnJxMTk5OTk5OTiYnJycnJ5OTk5PJycnJ5OTkZHJyMjk5mZycTE5OJieTk5PJyeRkcjI5mZxMTiYnk5PJyWRyMpmcTE4mk5PJZHIymZxMJpOTyWQymZxMJpPJZHIymUwmk8lkMplMJpPJZEImk8lkMpmQyWQyIZPJhEwmZDIhkwmZkAmZTMiEkAmZkAkhE0ImhJAJIWRCCCGEEEIIIYQQwoMQHoQHD8Iffv8BIjXnJKz++JQAAAAASUVORK5CYII=';

/**
 * Génère ou récupère le dégradé PNG horizontal 500x1 pixels garantissant zéro banding.
 */
function getLinearGradientOverlayDataUrl(): string {
  if (typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 500;
      canvas.height = 1;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const grad = ctx.createLinearGradient(0, 0, 500, 0);
        grad.addColorStop(0, 'rgba(10, 10, 14, 0.92)');
        grad.addColorStop(0.35, 'rgba(10, 10, 14, 0.86)');
        grad.addColorStop(0.65, 'rgba(10, 10, 14, 0.45)');
        grad.addColorStop(0.85, 'rgba(10, 10, 14, 0.15)');
        grad.addColorStop(1, 'rgba(10, 10, 14, 0.0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 500, 1);
        return canvas.toDataURL('image/png');
      }
    } catch (e) {
      console.warn('Fallback dégradé canvas:', e);
    }
  }
  return DEFAULT_GRADIENT_PNG_DATA_URL;
}

// Cache global d'affiches en mémoire (Map) pour éviter tout re-téléchargement au sein d'un même lot
const posterCache = new Map<string, string>();

/**
 * Charge l'affiche officielle de l'événement et la convertit en DataURL optimisée.
 * Dispose d'une mise en cache mémoire (Map) et d'un triple fallback anti-CORS (weserv.nl -> allorigins.win -> direct).
 */
async function loadEventPosterDataUrl(event: EventItem): Promise<string | null> {
  const rawUrl = (event as any).affiche_url || (event as any).poster_url || event.posterUrl;
  if (!rawUrl) return null;

  // 1. Vérification du cache en mémoire
  if (posterCache.has(rawUrl)) {
    return posterCache.get(rawUrl)!;
  }

  // 2. Si c'est déjà un DataURL
  if (rawUrl.startsWith('data:image/')) {
    posterCache.set(rawUrl, rawUrl);
    return rawUrl;
  }

  // 3. Environnement Navigateur Web (Triple Fallback Anti-CORS)
  if (typeof window !== 'undefined') {
    const candidateUrls: string[] = [];
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
      // Priorité 0 : Si Imgur, utiliser le suffixe 'h' (1024px) ou 'l' (640px) ou direct (weserv renvoie 429)
      const imgurMatch = rawUrl.match(/^https?:\/\/(?:i\.)?imgur\.com\/([a-zA-Z0-9]+)(\.[a-zA-Z0-9]+)?$/i);
      if (imgurMatch) {
        const rawId = imgurMatch[1];
        const ext = imgurMatch[2] || '.jpg';
        const baseId = rawId.length === 8 && /[smlhtb]$/i.test(rawId) ? rawId.slice(0, 7) : rawId;
        candidateUrls.push(`https://i.imgur.com/${baseId}h${ext}`);
        candidateUrls.push(rawUrl);
      } else {
        // Priorité 1 : Proxy CDN weserv.nl avec compression et redimensionnement
        candidateUrls.push(
          `https://images.weserv.nl/?url=${encodeURIComponent(rawUrl)}&w=900&q=82&output=jpg`
        );
        // Priorité 2 : Proxy universel secondaire allorigins.win
        candidateUrls.push(`https://api.allorigins.win/raw?url=${encodeURIComponent(rawUrl)}`);
        // Priorité 3 : Téléchargement direct
        candidateUrls.push(rawUrl);
      }
    } else {
      candidateUrls.push(rawUrl);
    }

    for (const targetUrl of candidateUrls) {
      try {
        const res = await fetch(targetUrl, { mode: 'cors' });
        if (!res.ok) continue;
        const blob = await res.blob();

        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        if (dataUrl && dataUrl.startsWith('data:image/')) {
          posterCache.set(rawUrl, dataUrl);
          return dataUrl;
        }
      } catch (err) {
        // Poursuivre vers le candidat suivant
      }
    }
  }

  // 4. Environnement Node.js (Tests automatisés Playwright / ts-node)
  try {
    const req = typeof window === 'undefined' ? (Function('return require')() as any) : null;
    if (req) {
      const fs = req('fs');
      const path = req('path');

      let localPath = rawUrl;
      if (rawUrl.startsWith('/')) {
        localPath = path.join(process.cwd(), 'public', rawUrl.replace(/^\//, ''));
      }

      if (fs.existsSync(localPath)) {
        const fileBuffer = fs.readFileSync(localPath);
        const ext = path.extname(localPath).toLowerCase().replace('.', '') || 'jpeg';
        const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
        const dataUrl = `data:${mime};base64,${fileBuffer.toString('base64')}`;
        posterCache.set(rawUrl, dataUrl);
        return dataUrl;
      }

      if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
        const candidateUrls = [
          `https://images.weserv.nl/?url=${encodeURIComponent(rawUrl)}&w=900&q=82&output=jpg`,
          `https://api.allorigins.win/raw?url=${encodeURIComponent(rawUrl)}`,
          rawUrl,
        ];
        for (const targetUrl of candidateUrls) {
          try {
            const res = await fetch(targetUrl);
            if (res.ok) {
              const arrayBuf = await res.arrayBuffer();
              const base64 = Buffer.from(arrayBuf).toString('base64');
              const dataUrl = `data:image/jpeg;base64,${base64}`;
              posterCache.set(rawUrl, dataUrl);
              return dataUrl;
            }
          } catch (e) {}
        }
      }
    }
  } catch (err) {
    console.warn('Fallback affiche non chargée:', err);
  }

  return null;
}

/**
 * Génère un QR Code haute résolution (320px) avec le logo officiel Thièsdn centré sur badge protecteur.
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

      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = '#E9C349';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.drawImage(logoImg, badgeX + padX, badgeY + padY, logoW, logoH);
      ctx.restore();
    }

    return canvas.toDataURL('image/png');
  }

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
 * Génère un code-barres 1D (Code 128) via JsBarcode pour douchette laser optique.
 */
function generateBarcode1DDataUrl(text: string): string {
  if (typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, text, {
        format: 'CODE128',
        width: 2,
        height: 48,
        displayValue: false,
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
 * Génère une planche de billets physiques imprimables au format A4 (5 billets par page)
 * Moteur 100% Dynamique & Print Premium :
 * - Lecture stricte de l'affiche de l'événement avec triple fallback anti-CORS (weserv.nl / allorigins.win)
 * - Dégradé PNG horizontal lisse (500x1 px) par-dessus l'affiche pour une lisibilité textuelle absolue sans banding
 * - Zéro texte en dur : titre, date, lieu, catégorie et tarif sont 100% dynamiques
 * - Souche contrôle d'accès avec QR Code (logo officiel centré) + Code-barres 1D Code 128 sur fond blanc
 * - Repères de coupe en croix (+) aux 4 angles de chaque billet
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
  const ticketWidth = pageWidth - marginX * 2; // 190 mm
  const ticketHeight = 52; // 52 mm
  const ticketSpacing = 3; // 3 mm
  const marginTop = 12.5; // (297 - (5 * 52 + 4 * 3)) / 2 = 12.5 mm
  const ticketsPerPage = 5;

  const total = tickets.length;

  // 1. Chargement de l'affiche via le cache mémoire et triple fallback CORS (une seule fois pour tout le lot)
  const posterDataUrl = await loadEventPosterDataUrl(event);

  // 2. Récupération du dégradé PNG horizontal continu (zéro banding)
  const gradientPngDataUrl = getLinearGradientOverlayDataUrl();

  // 3. Préparation des textes dynamiques nettoyés pour jsPDF
  const cleanTitle = sanitizeForPdf(event.title).toUpperCase() || 'EVENEMENT OFFICIEL';
  const cleanDate = sanitizeForPdf(event.date) || 'Date a confirmer';
  const cleanTime = sanitizeForPdf(event.time) || '20:00';
  const cleanVenue = sanitizeForPdf(event.venue) || 'Lieu a confirmer';
  const cleanQuartier = event.quartier ? ` (${sanitizeForPdf(event.quartier)})` : '';
  const cleanCity = sanitizeForPdf(event.city) || 'Thies';
  const cleanPromoter = sanitizeForPdf(event.promoter?.name || 'Organisateur Partenaire');
  const cleanTierName = sanitizeForPdf(tier.name).toUpperCase() || 'PASS STANDARD';

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

    // QR Code officiel avec logo Thièsdn au centre
    const qrDataUrl = await generateQrWithLogoDataUrl(ticket.qrCode);

    // Code-barres 1D Code 128
    const barcodeDataUrl = generateBarcode1DDataUrl(ticket.qrCode);

    // =================================================================
    // REPÈRES DE COUPE EN CROIX (+) AUX 4 COINS
    // =================================================================
    drawCropMark(doc, marginX, startY);
    drawCropMark(doc, marginX + ticketWidth, startY);
    drawCropMark(doc, marginX, startY + ticketHeight);
    drawCropMark(doc, marginX + ticketWidth, startY + ticketHeight);

    // =================================================================
    // FOND DU BILLET : AFFICHE OFFICIELLE + DÉGRADÉ PNG LISSE SANS BANDING
    // =================================================================
    // Fond de base noir anthracite
    doc.setFillColor(14, 14, 18);
    doc.rect(marginX, startY, ticketWidth, ticketHeight, 'F');

    // Insertion de l'affiche officielle en plein fond si disponible
    if (posterDataUrl) {
      try {
        const imageFormat = posterDataUrl.includes('image/png') ? 'PNG' : 'JPEG';
        doc.addImage(posterDataUrl, imageFormat, marginX, startY, ticketWidth, ticketHeight);
      } catch (imgErr) {
        console.warn("Impossible d'insérer l'affiche dans le PDF:", imgErr);
      }
    }

    // Application du dégradé PNG horizontal étiré par-dessus l'affiche (noir 92% à gauche -> transparent à droite)
    try {
      doc.addImage(gradientPngDataUrl, 'PNG', marginX, startY, ticketWidth, ticketHeight);
    } catch (gradErr) {
      // Fallback overlay uni si problème d'insertion du PNG dégradé
      try {
        doc.setFillColor(10, 10, 12);
        doc.setGState(new doc.GState({ opacity: 0.68 }));
        doc.rect(marginX, startY, ticketWidth, ticketHeight, 'F');
        doc.setGState(new doc.GState({ opacity: 1.0 }));
      } catch (e) {
        doc.rect(marginX, startY, ticketWidth, ticketHeight, 'F');
      }
    }

    // Liseré extérieur doré prestige (#E9C349)
    doc.setDrawColor(233, 195, 73);
    doc.setLineWidth(0.5);
    doc.rect(marginX, startY, ticketWidth, ticketHeight, 'D');

    // =================================================================
    // EN-TÊTE : LOGO THIÈSDN, BILLETTERIE & BADGE FORMULE OR DYNAMIQUE
    // =================================================================
    try {
      doc.addImage(LOGO_TIGHT_DATA_URL, 'PNG', marginX + 3, startY + 1.2, 10, 5);
    } catch (e) {}

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('THIESDN BILLETTERIE', marginX + 14.5, startY + 4.8);

    doc.setFontSize(5.5);
    doc.setTextColor(233, 195, 73);
    doc.text('OFFICIEL', marginX + 54, startY + 4.8);

    // Badge de catégorie / formule à droite (Fond Or #E9C349 avec texte noir bold 100% dynamique)
    const badgeCategoryWidth = 36;
    const badgeCategoryHeight = 5.0;
    const badgeCategoryX = marginX + ticketWidth - badgeCategoryWidth - 3;
    const badgeCategoryY = startY + 1.2;

    doc.setFillColor(233, 195, 73);
    doc.roundedRect(badgeCategoryX, badgeCategoryY, badgeCategoryWidth, badgeCategoryHeight, 1.2, 1.2, 'F');

    doc.setTextColor(18, 18, 20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text(cleanTierName, badgeCategoryX + badgeCategoryWidth / 2, badgeCategoryY + 3.6, {
      align: 'center',
    });

    // Ligne de séparation fine dorée sous l'en-tête
    doc.setDrawColor(233, 195, 73);
    doc.setLineWidth(0.35);
    doc.line(marginX + 2, startY + 7.2, marginX + ticketWidth - 2, startY + 7.2);

    // =================================================================
    // 1. SOUCHE GAUCHE : CONTRÔLE D'ACCÈS (QR CODE + CODE-BARRES 1D)
    // =================================================================
    const stubWidth = 48;
    // Fond blanc net garantissant un contraste optique et laser à 100%
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(233, 195, 73);
    doc.setLineWidth(0.3);
    doc.roundedRect(marginX + 2.5, startY + 8.5, stubWidth - 3.5, 37, 1.5, 1.5, 'FD');

    // QR Code officiel avec Logo Thièsdn centré (24 mm x 24 mm)
    const qrSize = 24;
    const qrX = marginX + 2.5 + (stubWidth - 3.5 - qrSize) / 2;
    const qrY = startY + 9.5;
    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

    // Fallback Node.js pour le logo centré
    if (typeof document === 'undefined') {
      const logoW = qrSize * 0.24;
      const logoH = logoW * (357 / 716);
      const padX = 0.8;
      const padY = 0.6;
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

    // Code-barres 1D Code 128 (Largeur 40mm, Hauteur 6mm)
    const barcodeW = 40;
    const barcodeH = 6;
    const barcodeX = marginX + 2.5 + (stubWidth - 3.5 - barcodeW) / 2;
    const barcodeY = startY + 34.2;

    if (barcodeDataUrl) {
      doc.addImage(barcodeDataUrl, 'PNG', barcodeX, barcodeY, barcodeW, barcodeH);
    } else {
      doc.setFillColor(245, 245, 245);
      doc.rect(barcodeX, barcodeY, barcodeW, barcodeH, 'F');
    }

    // Identifiant unique sous le code-barres
    doc.setTextColor(20, 20, 20);
    doc.setFont('courier', 'bold');
    doc.setFontSize(5.2);
    doc.text(sanitizeForPdf(ticket.qrCode), marginX + 2.5 + (stubWidth - 3.5) / 2, startY + 42.2, {
      align: 'center',
    });

    doc.setTextColor(110, 110, 115);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(4.0);
    doc.text('SCAN QR OU DOUCHETTE LASER 1D', marginX + 2.5 + (stubWidth - 3.5) / 2, startY + 44.5, {
      align: 'center',
    });

    // Ligne de découpe pointillée entre la souche et le corps
    doc.setDrawColor(180, 180, 180);
    doc.setLineDashPattern([1.5, 1.5], 0);
    doc.setLineWidth(0.25);
    doc.line(marginX + stubWidth + 1, startY + 7.5, marginX + stubWidth + 1, startY + 46.5);
    doc.setLineDashPattern([], 0);

    // =================================================================
    // 2. CORPS CENTRAL : DÉTAILS DE L'ÉVÉNEMENT (100% DYNAMIQUE)
    // =================================================================
    const bodyStartX = marginX + stubWidth + 4;
    const bodyWidth = 98;

    // Titre de l'événement en grand (helvetica bold)
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    const titleLines = doc.splitTextToSize(cleanTitle, bodyWidth);
    doc.text(titleLines.slice(0, 2), bodyStartX, startY + 12);

    const titleOffset = titleLines.length > 1 ? 4 : 0;

    // Date & Heure
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(233, 195, 73);
    doc.text(`DATE : ${cleanDate}  -  HEURE : ${cleanTime}`, bodyStartX, startY + 18.5 + titleOffset);

    // Lieu, Quartier & Ville
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(225, 225, 230);
    const locationStr = `LIEU : ${cleanVenue}${cleanQuartier}, ${cleanCity}`;
    const locationLines = doc.splitTextToSize(locationStr, bodyWidth);
    doc.text(locationLines.slice(0, 2), bodyStartX, startY + 24 + titleOffset);

    // Organisateur officiel
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.2);
    doc.setTextColor(170, 170, 175);
    doc.text(`Organise par : ${cleanPromoter}`, bodyStartX, startY + 29.5 + titleOffset);

    // Badge catégorie interne
    doc.setFillColor(32, 26, 45);
    doc.setDrawColor(138, 43, 226);
    doc.setLineWidth(0.25);
    doc.roundedRect(bodyStartX, startY + 34 + titleOffset, 55, 5, 1, 1, 'FD');

    doc.setTextColor(220, 184, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.text(`CATEGORIE : ${cleanTierName}`, bodyStartX + 2.5, startY + 37.5 + titleOffset);

    // Consigne de sécurité
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.0);
    doc.setTextColor(140, 140, 145);
    doc.text(
      'Pass officiel infalsifiable - Billet a usage unique avec controle instantane.',
      bodyStartX,
      startY + 44.5
    );

    // Ligne de découpe pointillée entre le corps et la zone droite
    doc.setDrawColor(180, 180, 180);
    doc.setLineDashPattern([1.5, 1.5], 0);
    doc.setLineWidth(0.25);
    doc.line(marginX + ticketWidth - 36, startY + 7.5, marginX + ticketWidth - 36, startY + 46.5);
    doc.setLineDashPattern([], 0);

    // =================================================================
    // 3. ENCART DROIT : SOUCHE GUICHET & TARIF PUBLIC (100% DYNAMIQUE)
    // =================================================================
    const rightStartX = marginX + ticketWidth - 34;
    doc.setFillColor(25, 22, 17);
    doc.setDrawColor(233, 195, 73);
    doc.setLineWidth(0.35);
    doc.roundedRect(rightStartX, startY + 8.5, 31.5, 37, 1.5, 1.5, 'FD');

    // Numéro de pass
    doc.setTextColor(233, 195, 73);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.0);
    const serialStr = ticket.serialNumber
      ? `PASS #${String(ticket.serialNumber).padStart(3, '0')}`
      : `PASS #${String(i + 1).padStart(3, '0')}`;
    doc.text(serialStr, rightStartX + 15.75, startY + 12.5, { align: 'center' });

    doc.setTextColor(180, 180, 185);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.text('TARIF PUBLIC', rightStartX + 15.75, startY + 17, { align: 'center' });

    // Prix en grand
    doc.setTextColor(233, 195, 73);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text(`${tier.price.toLocaleString('fr-FR')} F`, rightStartX + 15.75, startY + 23, {
      align: 'center',
    });

    doc.setTextColor(200, 200, 200);
    doc.setFontSize(5.5);
    doc.text('FCFA TTC', rightStartX + 15.75, startY + 26.5, { align: 'center' });

    // Zone attribution collaborateur / point de vente
    doc.setFillColor(15, 15, 18);
    doc.roundedRect(rightStartX + 1.8, startY + 29, 28, 15, 1, 1, 'F');

    doc.setTextColor(150, 150, 155);
    doc.setFontSize(4.8);
    doc.text('POINT DE VENTE :', rightStartX + 3.2, startY + 32.5);

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.0);
    const agentDisplay = sanitizeForPdf(ticket.agentName) || 'Point de Vente Agree';
    doc.text(agentDisplay.slice(0, 18), rightStartX + 3.2, startY + 36.5);

    // Label billetterie dynamique
    doc.setTextColor(138, 43, 226);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(4.8);
    doc.text('THIESDN BILLETTERIE', rightStartX + 15.75, startY + 41.5, { align: 'center' });

    // =================================================================
    // PIED DE PAGE : MENTIONS LÉGALES & SIGNATURE OFFICIELLE
    // =================================================================
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

  return doc.output('blob');
};
