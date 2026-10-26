import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { EventItem, TicketTier, UserTicket } from '../types';
import { LOGO_TIGHT_DATA_URL } from '../assets/logoTightBase64';

export interface GeneratePdfOptions {
  batchName?: string;
  onProgress?: (current: number, total: number) => void;
}

/**
 * Génère une planche de billets physiques imprimables au format A4 (4 billets par page)
 * Chaque billet dispose d'une souche de contrôle détachable, d'un QR code haute définition certifié,
 * du titre, de la date, du lieu, de la catégorie et du prix en FCFA.
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
  const pageHeight = 297;
  const marginX = 10;
  const marginTop = 12;
  const ticketsPerPage = 4;
  const ticketWidth = pageWidth - marginX * 2; // 190mm
  const ticketHeight = 63; // 63mm x 4 = 252mm + spacing = 270mm (parfait sur 297mm)
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

    // 1. Génération du QR Code DataURL pour ce billet
    const qrDataUrl = await QRCode.toDataURL(ticket.qrCode, {
      margin: 1,
      width: 250,
      errorCorrectionLevel: 'H',
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

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
    // Rectangle pour corriger les coins bas du bandeau
    doc.rect(marginX, startY + 3, ticketWidth, 4, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('THIÈSDN BILLETTERIE 🇸🇳 • BILLET PHYSIQUE OFFICIEL SÉCURISÉ', marginX + 4, startY + 4.8);

    doc.setFontSize(7);
    doc.setTextColor(233, 195, 73);
    const serialStr = ticket.serialNumber
      ? `N° ${String(ticket.serialNumber).padStart(4, '0')} / ${String(total).padStart(4, '0')}`
      : `PASS #${i + 1}`;
    doc.text(serialStr, marginX + ticketWidth - 32, startY + 4.8);

    // =================================================================
    // 1. SOUCHE GAUCHE : QR CODE D'ACCÈS
    // =================================================================
    const stubWidth = 52;
    // Fond blanc pour garantir le contraste du scan optique
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.roundedRect(marginX + 3, startY + 10, stubWidth - 6, ticketHeight - 13, 2, 2, 'FD');

    // Image du QR Code haute définition
    const qrX = marginX + 6.5;
    const qrY = startY + 11.5;
    const qrSize = 33;
    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

    // Dessin du badge blanc protecteur et du logo officiel Thièsdn au centre exact (~24% de largeur)
    const logoW = qrSize * 0.24; // ~7.9 mm
    const aspectRatio = 357 / 716; // ratio exact de logo-tight.png (716x357)
    const logoH = logoW * aspectRatio; // ~3.9 mm

    const padX = 1.0;
    const padY = 0.8;
    const badgeW = logoW + padX * 2;
    const badgeH = logoH + padY * 2;
    const badgeX = qrX + (qrSize - badgeW) / 2;
    const badgeY = qrY + (qrSize - badgeH) / 2;

    // Carré blanc protecteur pour lisibilité optimale du QR code
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(233, 195, 73); // Liseré or officiel Thièsdn
    doc.setLineWidth(0.25);
    doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 0.6, 0.6, 'FD');

    // Logo officiel Thièsdn (/logo-tight.png)
    doc.addImage(LOGO_TIGHT_DATA_URL, 'PNG', badgeX + padX, badgeY + padY, logoW, logoH);

    // Texte sous le QR code
    doc.setTextColor(20, 20, 20);
    doc.setFont('courier', 'bold');
    doc.setFontSize(6.5);
    doc.text(ticket.qrCode, marginX + stubWidth / 2, startY + 47.5, { align: 'center' });

    doc.setTextColor(110, 110, 110);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.text('SCANNER À L’ENTRÉE', marginX + stubWidth / 2, startY + 51, { align: 'center' });

    // Ligne de perforation / découpe pointillée entre la souche et le corps
    doc.setDrawColor(120, 120, 120);
    doc.setLineDashPattern([1.5, 1.5], 0);
    doc.setLineWidth(0.3);
    doc.line(marginX + stubWidth, startY + 8, marginX + stubWidth, startY + ticketHeight);
    doc.setLineDashPattern([], 0); // Réinitialiser le style de ligne

    // =================================================================
    // 2. CORPS CENTRAL : DÉTAILS DE L'ÉVÉNEMENT
    // =================================================================
    const bodyStartX = marginX + stubWidth + 5;
    const bodyWidth = 92;

    // Titre de l'événement
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    const titleLines = doc.splitTextToSize(event.title.toUpperCase(), bodyWidth);
    doc.text(titleLines.slice(0, 2), bodyStartX, startY + 14);

    const titleOffset = titleLines.length > 1 ? 4 : 0;

    // Date & Heure
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(233, 195, 73); // Or
    doc.text(`📅 ${event.date} à ${event.time}`, bodyStartX, startY + 22 + titleOffset);

    // Lieu & Quartier
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(220, 220, 225);
    const locationStr = `📍 ${event.venue}${event.quartier ? ` (${event.quartier})` : ''}, ${event.city}`;
    const locationLines = doc.splitTextToSize(locationStr, bodyWidth);
    doc.text(locationLines.slice(0, 2), bodyStartX, startY + 28 + titleOffset);

    // Catégorie / Formule
    doc.setFillColor(35, 30, 45);
    doc.setDrawColor(138, 43, 226);
    doc.setLineWidth(0.3);
    doc.roundedRect(bodyStartX, startY + 37 + titleOffset, 55, 7, 1.5, 1.5, 'FD');

    doc.setTextColor(220, 184, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(`🎟️ ${tier.name.toUpperCase()}`, bodyStartX + 3, startY + 41.8 + titleOffset);

    // Organisateur officiel
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.setTextColor(150, 150, 155);
    doc.text(`Organisé par : ${event.promoter.name}`, bodyStartX, startY + 49 + titleOffset);

    // Consigne de sécurité
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(140, 140, 140);
    doc.text('Pass officiel infalsifiable. Billet à usage unique avec contrôle d’accès instantané.', bodyStartX, startY + 54);

    // =================================================================
    // 3. ENCART DROIT : TARIF & CONTRÔLE VENDEUR
    // =================================================================
    const rightStartX = marginX + ticketWidth - 40;
    doc.setFillColor(25, 23, 18);
    doc.setDrawColor(233, 195, 73);
    doc.setLineWidth(0.4);
    doc.roundedRect(rightStartX, startY + 10, 37, ticketHeight - 13, 2, 2, 'FD');

    doc.setTextColor(180, 180, 180);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text('TARIF PUBLIC', rightStartX + 18.5, startY + 16, { align: 'center' });

    // Prix en grand
    doc.setTextColor(233, 195, 73);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`${tier.price.toLocaleString('fr-FR')} F`, rightStartX + 18.5, startY + 23, { align: 'center' });

    doc.setTextColor(200, 200, 200);
    doc.setFontSize(6);
    doc.text('FCFA TTC', rightStartX + 18.5, startY + 27, { align: 'center' });

    // Zone attribution collaborateur
    doc.setFillColor(15, 15, 18);
    doc.roundedRect(rightStartX + 2, startY + 31, 33, 15, 1.5, 1.5, 'F');

    doc.setTextColor(150, 150, 155);
    doc.setFontSize(5);
    doc.text('POINT DE VENTE :', rightStartX + 3.5, startY + 35);

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    const agentDisplay = ticket.agentName || 'Réseau Partenaire';
    doc.text(agentDisplay.slice(0, 16), rightStartX + 3.5, startY + 39);

    doc.setTextColor(138, 43, 226);
    doc.setFontSize(5);
    doc.text('THIESDN RÉSEAU 2027', rightStartX + 18.5, startY + 44, { align: 'center' });

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
