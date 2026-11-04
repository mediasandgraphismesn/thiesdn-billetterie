import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import { EventItem, TicketTier, UserTicket, TicketSalesAgentJoin } from '../types';
import { LOGO_TIGHT_DATA_URL } from '../assets/logoTightBase64';
import { getSupabaseClient, TICKET_SELECT_WITH_AGENT, fetchTicketWithAgent } from './supabase';

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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PREFETCH_CHUNK_SIZE = 150; // limite la longueur d'URL PostgREST ; 300 billets = 2 requêtes

/**
 * Pré-chargement groupé (batch prefetch) du point de vente de tous les billets du lot.
 * Une requête `in('id', ticketIds)` par tranche de 150 billets au lieu d'une requête par billet.
 * Ne touche qu'aux billets dont la jointure sales_agents n'a pas encore été résolue.
 */
async function prefetchSalesAgents(tickets: UserTicket[]): Promise<UserTicket[]> {
  const client = getSupabaseClient();
  if (!client) return tickets;

  const idsToFetch = tickets
    .filter((t) => t.sales_agents === undefined && UUID_REGEX.test(t.id))
    .map((t) => t.id);
  if (idsToFetch.length === 0) return tickets;

  const agentByTicketId = new Map<string, TicketSalesAgentJoin | null>();
  try {
    for (let i = 0; i < idsToFetch.length; i += PREFETCH_CHUNK_SIZE) {
      const chunk = idsToFetch.slice(i, i + PREFETCH_CHUNK_SIZE);
      const { data, error } = await client
        .from('tickets')
        .select(TICKET_SELECT_WITH_AGENT)
        .in('id', chunk);
      if (error) {
        console.warn('Prefetch point de vente (sales_agents) indisponible:', error.message);
        return tickets;
      }
      const rows = (data || []) as unknown as Array<{
        id: string;
        sales_agents: TicketSalesAgentJoin | null;
      }>;
      rows.forEach((row) => agentByTicketId.set(row.id, row.sales_agents ?? null));
    }
  } catch (err) {
    console.warn('Prefetch point de vente échoué:', err);
    return tickets;
  }

  return tickets.map((t) =>
    agentByTicketId.has(t.id) ? { ...t, sales_agents: agentByTicketId.get(t.id) ?? null } : t
  );
}

/**
 * Résout le libellé « POINT DE VENTE » d'un billet :
 * 1. Nom joint depuis sales_agents (ex : "DJ CRAZY")
 * 2. Nom miroir agentName (agent_name / guichet saisi)
 * 3. "Vente en Ligne" pour un billet web sans agent_id
 * 4. "Point de Vente" en dernier recours (billet physique sans nom)
 */
export function resolvePointDeVenteLabel(ticket: UserTicket): string {
  const fromJoin = sanitizeForPdf(ticket.sales_agents?.point_de_vente);
  if (fromJoin) return fromJoin;
  const fromMirror = sanitizeForPdf(ticket.agentName);
  if (fromMirror) return fromMirror;
  if (!ticket.agentId && !ticket.isPhysical) return 'Vente en Ligne';
  return 'Point de Vente';
}

/**
 * Recadre une image en mode "object-fit: cover" au ratio exact du billet (190mm x 52mm, ratio 3.6538:1).
 * Produit un DataURL JPEG haute résolution (1900 x 520 px) garantissant zéro bande blanche et zéro anamorphose.
 */
async function cropImageToCoverDataUrl(
  imageSource: string,
  targetWidth = 1900,
  targetHeight = 520
): Promise<string> {
  if (typeof document === 'undefined') {
    return imageSource;
  }

  return new Promise<string>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(imageSource);
          return;
        }

        const targetRatio = targetWidth / targetHeight; // 1900 / 520 = 3.6538
        const imgRatio = img.width / img.height;

        let sx = 0;
        let sy = 0;
        let sWidth = img.width;
        let sHeight = img.height;

        if (imgRatio > targetRatio) {
          // L'image est plus panoramique que le billet -> on coupe les côtés
          sWidth = img.height * targetRatio;
          sx = (img.width - sWidth) / 2;
        } else {
          // L'image est plus verticale (affiche standard) -> on coupe le haut/bas
          // Cadrage à 25% depuis le haut pour préserver le visuel central
          sHeight = img.width / targetRatio;
          sy = Math.max(0, (img.height - sHeight) * 0.25);
        }

        ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      } catch (e) {
        console.warn('Fallback crop canvas:', e);
        resolve(imageSource);
      }
    };
    img.onerror = () => resolve(imageSource);
    img.src = imageSource;
  });
}

// Cache global d'affiches en mémoire (Map) pour éviter tout re-téléchargement au sein d'un même lot
const posterCache = new Map<string, string>();

/**
 * Charge l'affiche officielle de l'événement, la recadre en mode COVER plein format (190x52mm)
 * et la convertit en DataURL optimisée.
 * Dispose d'une mise en cache mémoire (Map), d'un triple fallback anti-CORS et support Node.js.
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
    const cropped = await cropImageToCoverDataUrl(rawUrl);
    posterCache.set(rawUrl, cropped);
    return cropped;
  }

  // 3. Environnement Navigateur Web (Triple Fallback Anti-CORS + Crop Cover)
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
          `https://images.weserv.nl/?url=${encodeURIComponent(rawUrl)}&w=1200&q=85&output=jpg`
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

        const rawDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        if (rawDataUrl && rawDataUrl.startsWith('data:image/')) {
          const croppedDataUrl = await cropImageToCoverDataUrl(rawDataUrl);
          posterCache.set(rawUrl, croppedDataUrl);
          return croppedDataUrl;
        }
      } catch (err) {
        // Poursuivre vers le candidat suivant
      }
    }
  }

  // 4. Environnement Node.js (Tests automatisés Playwright / ts-node / tsx)
  if (typeof window === 'undefined') {
    try {
      const fs = await import('fs');
      const path = await import('path');

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
          `https://images.weserv.nl/?url=${encodeURIComponent(rawUrl)}&w=1200&q=85&output=jpg`,
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
    } catch (err) {
      console.warn('Fallback affiche Node.js non chargée:', err);
    }
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
  inputTickets: UserTicket[],
  options: GeneratePdfOptions = {}
): Promise<Blob> => {
  // 0. Pré-chargement groupé du point de vente (jointure sales_agents) pour tout le lot
  const tickets = await prefetchSalesAgents(inputTickets);

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

  // 1. Chargement de l'affiche officielle (recadrée cover plein format 190x52mm)
  const posterDataUrl = await loadEventPosterDataUrl(event);

  // 2. Préparation des textes dynamiques nettoyés pour jsPDF
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
    // CALQUE 1 : FOND NOIR UNIFIÉ (100% du rectangle : 190 x 52 mm)
    // =================================================================
    doc.setFillColor(10, 10, 14);
    doc.rect(marginX, startY, ticketWidth, ticketHeight, 'F');

    // =================================================================
    // CALQUE 2 : IMAGE DE L'AFFICHE OFFICIELLE (COVER PLEIN FORMAT 190 x 52 mm)
    // =================================================================
    if (posterDataUrl) {
      try {
        const imageFormat = posterDataUrl.includes('image/png') ? 'PNG' : 'JPEG';
        doc.addImage(posterDataUrl, imageFormat, marginX, startY, ticketWidth, ticketHeight);
      } catch (imgErr) {
        console.warn("Impossible d'insérer l'affiche dans le PDF:", imgErr);
      }
    }

    // =================================================================
    // CALQUE 3 : VOILE SOMBRE SEMI-TRANSPARENT (OPACITÉ 0.75 UNIFORME)
    // =================================================================
    try {
      type GStateArg = Parameters<jsPDF['setGState']>[0];
      const GStateCtor = (doc as unknown as { GState: new (opts: { opacity: number }) => GStateArg }).GState;
      doc.setFillColor(10, 10, 10);
      doc.setGState(new GStateCtor({ opacity: 0.75 }));
      doc.rect(marginX, startY, ticketWidth, ticketHeight, 'F');
      doc.setGState(new GStateCtor({ opacity: 1.0 }));
    } catch {
      doc.setFillColor(10, 10, 10);
      doc.rect(marginX, startY, ticketWidth, ticketHeight, 'F');
    }

    // =================================================================
    // CALQUE 4 : BANDEAU D'EN-TÊTE SÉCURISÉ SUR FOND NOIR UNI (100% OPAQUE)
    // =================================================================
    // Fond noir uni 100% opaque sous le logo Thièsdn et "OFFICIEL" pour garantir zéro brouillage
    doc.setFillColor(10, 10, 14);
    doc.rect(marginX, startY, ticketWidth, 7.2, 'F');

    // =================================================================
    // CALQUE 5 : TEXTES, LOGOS, QR CODE ET SOUCHES (COUCHE SUPÉRIEURE)
    // =================================================================

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
    const agentDisplay = resolvePointDeVenteLabel(ticket);

    // Police adaptative selon la longueur du nom (aucune troncature fixe)
    let agentFontSize = 5.0;
    if (agentDisplay.length > 18) {
      agentFontSize = 4.2;
    } else if (agentDisplay.length > 13) {
      agentFontSize = 4.6;
    }
    doc.setFontSize(agentFontSize);

    // Garde-fou : le nom doit tenir dans le cartouche (28 mm - marges = 25 mm utiles)
    const agentMaxWidth = 25;
    while (doc.getTextWidth(agentDisplay) > agentMaxWidth && agentFontSize > 3.4) {
      agentFontSize -= 0.2;
      doc.setFontSize(agentFontSize);
    }
    doc.text(agentDisplay, rightStartX + 3.2, startY + 36.5, { maxWidth: agentMaxWidth });

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

    // Liseré extérieur doré prestige (#E9C349) encadrant le billet au-dessus de tous les calques
    doc.setDrawColor(233, 195, 73);
    doc.setLineWidth(0.5);
    doc.rect(marginX, startY, ticketWidth, ticketHeight, 'D');
  }

  return doc.output('blob');
};

/**
 * Génère le PDF d'un billet unique depuis son identifiant Supabase (usage admin).
 * Le point de vente est lu via la jointure sales_agents:agent_id.
 */
export const generatePhysicalTicketPdfById = async (
  ticketId: string,
  event: EventItem,
  tier: TicketTier
): Promise<Blob> => {
  const { data: ticketData, error } = await fetchTicketWithAgent(ticketId);
  if (error || !ticketData) {
    throw new Error(error || 'Billet introuvable.');
  }

  const str = (value: unknown, fallback = ''): string =>
    typeof value === 'string' && value ? value : fallback;
  const agentId = str(ticketData.agent_id) || undefined;

  const ticket: UserTicket = {
    id: ticketData.id,
    eventId: str(ticketData.event_id, event.id),
    eventTitle: str(ticketData.event_title, event.title),
    eventPoster: str(ticketData.event_poster, event.posterUrl),
    eventDate: str(ticketData.event_date, event.date),
    eventTime: str(ticketData.event_time, event.time),
    eventVenue: str(ticketData.event_venue, event.venue),
    tierName: str(ticketData.tier_name, tier.name),
    price: Number(ticketData.price) || tier.price,
    qrCode: str(ticketData.qr_code, ticketData.id),
    holderName: str(ticketData.holder_name, 'Nom non renseigne'),
    purchasedAt: str(ticketData.created_at, new Date().toISOString()),
    status: str(ticketData.status, 'printed_not_sold') as UserTicket['status'],
    isPhysical: Boolean(ticketData.is_physical),
    agentId,
    agentName: ticketData.sales_agents?.point_de_vente || str(ticketData.agent_name) || undefined,
    sales_agents: ticketData.sales_agents ?? null,
    batchNumber: str(ticketData.batch_number) || undefined,
    serialNumber: Number(ticketData.serial_number) || undefined,
  };

  return generatePhysicalTicketsPdf(event, tier, [ticket]);
};
