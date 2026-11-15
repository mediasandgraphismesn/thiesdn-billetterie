import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { SafeImage } from './SafeImage';
import {
  X,
  MapPin,
  Download,
  Share2,
  ShieldCheck,
  CheckCircle,
  Ticket,
  QrCode,
  FileText,
  Clock,
  Copy,
  Check,
  MessageCircle,
  Phone,
  Store,
} from 'lucide-react';
import QRCode from 'qrcode';
import { UserTicket } from '../types';
import { AddToCalendarButton } from './AddToCalendarButton';
import { LOGO_TIGHT_DATA_URL } from '../assets/logoTightBase64';
import { getOptimizedImageUrl } from '../utils/imageOptimizer';

export interface TicketDetailModalProps {
  ticket: UserTicket | null;
  isOpen: boolean;
  onClose: () => void;
  mode?: 'client' | 'admin';
}

function getTicketStatusLabel(status: UserTicket['status']): { label: string; badgeClass: string } {
  if (status === 'used' || status === 'scanned') {
    return {
      label: 'Scanné / Utilisé',
      badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    };
  }
  if (status === 'cancelled') {
    return {
      label: 'Annulé / Désactivé',
      badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    };
  }
  if (status === 'pending' || status === 'payment_signaled') {
    return {
      label: 'Paiement en vérification',
      badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    };
  }
  if (status === 'printed_not_sold' || status === 'physical_printed' || status === 'physical_allocated') {
    return {
      label: 'En stock (Non activé)',
      badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    };
  }
  return {
    label: 'Valide',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  };
}

export const TicketDetailModal: React.FC<TicketDetailModalProps> = ({
  ticket,
  isOpen,
  onClose,
  mode = 'client',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scratchCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isScratchingRef = useRef(false);
  const scratchMovesRef = useRef(0);

  const isAdminMode = mode === 'admin';

  const [isQrReady, setIsQrReady] = useState(false);
  const [isRevealed, setIsRevealed] = useState(isAdminMode);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const isPendingPayment =
    ticket?.status === 'pending' || ticket?.status === 'payment_signaled';

  // Confettis festifs uniquement côté client pour un billet confirmé
  useEffect(() => {
    if (!isOpen || !ticket) return;
    setIsRevealed(isAdminMode);
    scratchMovesRef.current = 0;

    if (!isAdminMode && !isPendingPayment) {
      confetti({
        particleCount: 90,
        spread: 75,
        origin: { y: 0.6 },
        colors: ['#8A2BE2', '#E9C349', '#DCB8FF', '#FFFFFF'],
      });
    }
  }, [isOpen, ticket, isAdminMode, isPendingPayment]);

  // Initialisation du canvas de grattage (Scratch Card) côté Client uniquement
  const initScratchCanvas = useCallback(() => {
    const sc = scratchCanvasRef.current;
    if (!sc) return;
    const ctx = sc.getContext('2d');
    if (!ctx) return;

    sc.width = 260;
    sc.height = 260;

    const grad = ctx.createLinearGradient(0, 0, sc.width, sc.height);
    grad.addColorStop(0, '#221F28');
    grad.addColorStop(0.5, '#35323D');
    grad.addColorStop(1, '#18161D');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, sc.width, sc.height);

    ctx.strokeStyle = '#E9C349';
    ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, sc.width - 8, sc.height - 8);

    const logoImg = new Image();
    logoImg.crossOrigin = 'anonymous';
    logoImg.onload = () => {
      const logoTargetW = Math.floor(sc.width * 0.28);
      const aspectRatio = logoImg.naturalHeight / (logoImg.naturalWidth || 1);
      const logoTargetH = Math.floor(logoTargetW * aspectRatio);

      const padX = 8;
      const padY = 6;
      const badgeW = logoTargetW + padX * 2;
      const badgeH = logoTargetH + padY * 2;
      const badgeX = (sc.width - badgeW) / 2;
      const badgeY = (sc.height - badgeH) / 2;

      ctx.save();
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

      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = '#E9C349';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      ctx.drawImage(logoImg, badgeX + padX, badgeY + padY, logoTargetW, logoTargetH);
      ctx.restore();

      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.fillStyle = '#E9C349';
      ctx.textAlign = 'center';
      ctx.fillText('PASS OFFICIEL SÉCURISÉ', sc.width / 2, badgeY - 14);

      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.fillStyle = '#DCB8FF';
      ctx.fillText('🎟️ Frottez ici pour scanner 🎟️', sc.width / 2, badgeY + badgeH + 22);

      ctx.font = '9px system-ui, sans-serif';
      ctx.fillStyle = '#8E8E93';
      ctx.fillText('(Protection anti-capture)', sc.width / 2, badgeY + badgeH + 36);
    };

    logoImg.src = LOGO_TIGHT_DATA_URL;
  }, []);

  const handleScratchMove = (clientX: number, clientY: number) => {
    if (!isScratchingRef.current || isRevealed) return;
    const sc = scratchCanvasRef.current;
    if (!sc) return;
    const ctx = sc.getContext('2d');
    if (!ctx) return;

    const rect = sc.getBoundingClientRect();
    const scaleX = sc.width / rect.width;
    const scaleY = sc.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, 24, 0, Math.PI * 2);
    ctx.fill();

    scratchMovesRef.current += 1;

    if (scratchMovesRef.current % 8 === 0) {
      try {
        const imgData = ctx.getImageData(0, 0, sc.width, sc.height);
        let transparent = 0;
        const total = imgData.data.length / 16;
        for (let i = 3; i < imgData.data.length; i += 16) {
          if (imgData.data[i] === 0) transparent++;
        }
        if (transparent / total > 0.4) {
          setIsRevealed(true);
        }
      } catch {
        // Ignore si lecture imageData indisponible
      }
    }
  };

  useEffect(() => {
    if (!isAdminMode && isQrReady && !isRevealed) {
      initScratchCanvas();
    }
  }, [isAdminMode, isQrReady, isRevealed, initScratchCanvas]);

  // Génération du QR Code à la demande uniquement à l'ouverture de la modale
  useEffect(() => {
    if (!isOpen || !ticket || !canvasRef.current || isPendingPayment) return;

    let isCancelled = false;
    setIsQrReady(false);

    const canvas = canvasRef.current;
    const qrText = ticket.qrCode || `THIESDN-TKT-${ticket.id}`;
    const qrSize = 260;

    const logo = new Image();
    logo.crossOrigin = 'anonymous';

    const loadLogoPromise = new Promise<HTMLImageElement>((resolve) => {
      logo.onload = () => resolve(logo);
      logo.onerror = () => {
        const fallback = new Image();
        fallback.onload = () => resolve(fallback);
        fallback.src = LOGO_TIGHT_DATA_URL;
      };
      logo.src = LOGO_TIGHT_DATA_URL;
    });

    loadLogoPromise
      .then((loadedLogo) => {
        if (isCancelled) return null;
        return QRCode.toCanvas(canvas, qrText, {
          width: qrSize,
          margin: 2,
          errorCorrectionLevel: 'H',
          color: {
            dark: '#0A0A0A',
            light: '#FFFFFF',
          },
        }).then(() => loadedLogo);
      })
      .then((loadedLogo) => {
        if (isCancelled || !loadedLogo) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const logoTargetW = Math.floor(qrSize * 0.24);
        const aspectRatio = loadedLogo.naturalHeight / (loadedLogo.naturalWidth || 1);
        const logoTargetH = Math.floor(logoTargetW * aspectRatio);

        const padX = 6;
        const padY = 5;
        const badgeW = logoTargetW + padX * 2;
        const badgeH = logoTargetH + padY * 2;
        const badgeX = (qrSize - badgeW) / 2;
        const badgeY = (qrSize - badgeH) / 2;

        ctx.save();
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
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
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.drawImage(loadedLogo, badgeX + padX, badgeY + padY, logoTargetW, logoTargetH);
        ctx.restore();
        setIsQrReady(true);
      })
      .catch(() => {
        QRCode.toCanvas(canvas, qrText, {
          width: qrSize,
          margin: 2,
          errorCorrectionLevel: 'H',
          color: {
            dark: '#0A0A0A',
            light: '#FFFFFF',
          },
        })
          .then(() => {
            if (!isCancelled) setIsQrReady(true);
          })
          .catch((e) => console.error('Erreur génération QR:', e));
      });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, ticket, isPendingPayment]);

  const showToast = (msg: string) => {
    setDownloadSuccess(msg);
    setTimeout(() => setDownloadSuccess(null), 3000);
  };

  // Téléchargement reçu PDF (paiement en attente)
  const handleDownloadReceipt = async () => {
    if (!ticket) return;
    try {
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      doc.setFillColor(23, 23, 23);
      doc.rect(0, 0, 210, 40, 'F');

      doc.setTextColor(233, 195, 73);
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('THIÈSDN BILLETTERIE', 20, 24);

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('REÇU PROVISOIRE DE COMMANDE', 135, 24);

      doc.setDrawColor(233, 195, 73);
      doc.setLineWidth(0.8);
      doc.line(20, 46, 190, 46);

      doc.setTextColor(40, 40, 40);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Statut de la commande :', 20, 60);
      doc.setTextColor(217, 119, 6);
      doc.text('EN ATTENTE DE VÉRIFICATION PAIEMENT WAVE', 75, 60);

      doc.setTextColor(40, 40, 40);
      doc.setFont('helvetica', 'bold');
      doc.text('Référence de commande :', 20, 72);
      doc.setFont('helvetica', 'normal');
      doc.text(ticket.qrCode || `CMD-${ticket.id}`, 75, 72);

      doc.setFont('helvetica', 'bold');
      doc.text("Date d'émission :", 20, 84);
      doc.setFont('helvetica', 'normal');
      doc.text(
        new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
        75,
        84
      );

      doc.setFont('helvetica', 'bold');
      doc.text('Bénéficiaire / Client :', 20, 96);
      doc.setFont('helvetica', 'normal');
      doc.text(ticket.holderName, 75, 96);

      doc.setFillColor(245, 245, 248);
      doc.roundedRect(20, 108, 170, 52, 3, 3, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(20, 20, 20);
      doc.setFontSize(12);
      doc.text('Détails de la réservation', 26, 119);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10.5);
      doc.text(`Événement : ${ticket.eventTitle}`, 26, 129);
      doc.text(`Date & Heure : ${ticket.eventDate} à ${ticket.eventTime}`, 26, 137);
      doc.text(`Lieu : ${ticket.eventVenue}`, 26, 145);
      doc.text(`Formule : ${ticket.tierName}`, 26, 153);

      doc.setFillColor(23, 23, 23);
      doc.roundedRect(20, 170, 170, 22, 3, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Total Réglé (Wave) :', 28, 184);
      doc.setTextColor(233, 195, 73);
      doc.setFontSize(13);
      doc.text(`${ticket.price.toLocaleString('fr-FR')} FCFA`, 140, 184);

      doc.setTextColor(110, 110, 110);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'italic');
      doc.text(
        "Ce reçu officiel certifie l'enregistrement de votre réservation sur Thièsdn Billetterie.",
        20,
        208
      );
      doc.text(
        'Votre Pass Officiel définitif avec QR Code de scan sera activé dès rapprochement Wave.',
        20,
        214
      );
      doc.text('Support & Renseignements : contact@thiesdn.site', 20, 220);

      doc.save(`Recu-Commande-${ticket.qrCode || ticket.id}.pdf`);
      showToast('Reçu PDF téléchargé avec succès !');
    } catch (pdfErr) {
      console.error('Erreur génération reçu PDF:', pdfErr);
    }
  };

  // Export PDF officiel complet (avec QR code HD) pour tout billet (Admin / Promoteur / Client)
  const handleDownloadTicketPdf = async () => {
    if (!ticket || !canvasRef.current) return;
    try {
      const { default: jsPDF } = await import('jspdf');
      const qrDataUrl = canvasRef.current.toDataURL('image/png');
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      doc.setFillColor(12, 11, 16);
      doc.rect(0, 0, 210, 44, 'F');

      doc.setTextColor(233, 195, 73);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.text('THIÈSDN BILLETTERIE', 20, 22);

      doc.setTextColor(220, 184, 255);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('E-BILLET OFFICIEL CERTIFIÉ', 20, 31);

      doc.setDrawColor(138, 43, 226);
      doc.setLineWidth(1);
      doc.line(20, 44, 190, 44);

      // Bloc événement
      doc.setTextColor(20, 20, 20);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.text(ticket.eventTitle, 20, 58);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(70, 70, 80);
      doc.text(`Date : ${ticket.eventDate} • ${ticket.eventTime}`, 20, 67);
      doc.text(`Lieu : ${ticket.eventVenue}`, 20, 74);

      // Encadré titulaire + formule
      doc.setFillColor(246, 245, 250);
      doc.roundedRect(20, 84, 170, 42, 4, 4, 'F');
      doc.setTextColor(25, 25, 30);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(`Titulaire : ${ticket.holderName}`, 26, 95);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10.5);
      doc.text(`Formule : ${ticket.tierName} (${ticket.seatNumber || 'Accès Standard'})`, 26, 104);
      doc.text(`Montant : ${Number(ticket.price).toLocaleString('fr-FR')} FCFA`, 26, 112);
      if (ticket.holderPhone) {
        doc.text(`Téléphone : ${ticket.holderPhone}`, 26, 120);
      }

      // QR Code HD centré
      doc.addImage(qrDataUrl, 'PNG', 65, 138, 80, 80);
      doc.setFont('courier', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(36, 26, 0);
      doc.text(ticket.qrCode || `THIESDN-TKT-${ticket.id}`, 105, 226, { align: 'center' });

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(120, 120, 120);
      doc.text(
        "Présentez ce QR Code à l'entrée pour validation unique. Toute reproduction est invalidée au premier scan.",
        105,
        242,
        { align: 'center' }
      );

      const safeName = (ticket.holderName || 'client').replace(/[^a-zA-Z0-9_-]/g, '_');
      doc.save(`Pass-Thiesdn-${safeName}-${ticket.id.slice(0, 8)}.pdf`);
      showToast('Billet PDF A4 téléchargé !');
    } catch (err) {
      console.error('Erreur génération PDF billet:', err);
    }
  };

  // Téléchargement image QR PNG HD (avec marge blanche pour impression / envoi)
  const handleDownloadPassPng = () => {
    if (!canvasRef.current || !ticket) return;
    try {
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = 440;
      exportCanvas.height = 440;
      const ctx = exportCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, 440, 440);
        ctx.drawImage(canvasRef.current, 20, 20, 400, 400);
      }
      const dataUrl = exportCanvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      const cleanTitle = (ticket.eventTitle || 'Evenement').replace(/[^a-zA-Z0-9]/g, '_');
      downloadLink.download = `Billet-Thiesdn-${cleanTitle}-${ticket.qrCode}.png`;
      downloadLink.href = dataUrl;
      downloadLink.click();
      showToast('QR Code PNG téléchargé avec succès !');
    } catch {
      console.warn('Impossible de télécharger le PNG QR.');
    }
  };

  const handleCopyDirectLink = () => {
    if (!ticket) return;
    const url = `${window.location.origin}/ticket/${ticket.id}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleWhatsAppShare = () => {
    if (!ticket) return;
    const phone = (ticket.holderPhone || '').replace(/\D/g, '');
    const validPhone = phone.startsWith('221') ? phone : `221${phone}`;
    const url = `${window.location.origin}/ticket/${ticket.id}`;
    const msg = encodeURIComponent(
      `Bonjour ${ticket.holderName} ! 👋\nVoici votre billet officiel pour *${ticket.eventTitle}* :\n🎫 Formule : ${ticket.tierName}\n🔗 Accès au pass : ${url}\n\nPrésentez ce QR Code à l'entrée de l'événement.`
    );
    window.open(`https://wa.me/${validPhone}?text=${msg}`, '_blank');
  };

  if (!isOpen || !ticket) return null;

  const statusMeta = getTicketStatusLabel(ticket.status);
  const posPointLabel =
    ticket.sales_agents?.point_de_vente || ticket.agentName || undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm sm:max-w-md bg-gradient-to-b from-[#1C1824] via-[#0A0A0A] to-[#121118] border border-[#8A2BE2]/40 rounded-3xl overflow-hidden shadow-2xl my-4 sm:my-6"
      >
        {/* TOP BAR AVEC LOGO OFFICIEL THIÈSDN */}
        <div className="p-3.5 sm:p-4 flex items-center justify-between border-b border-white/10 bg-black/50">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 px-2 py-0.5 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center shrink-0">
              <img
                src="/logo-tight.png"
                alt="Thièsdn Logo"
                loading="lazy"
                decoding="async"
                className="h-5 w-auto object-contain"
              />
            </div>
            <span className="font-heading font-extrabold text-xs text-[#E9C349] flex items-center gap-1.5 uppercase tracking-wider truncate">
              <ShieldCheck className="w-3.5 h-3.5 text-[#E9C349] shrink-0" />
              {isAdminMode ? 'Contrôle & Détail Billet' : 'Pass Billet Officiel'}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le pass"
            className="w-10 h-10 min-h-[40px] min-w-[40px] rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps Visuel du Billet */}
        <div className="p-4 sm:p-5 space-y-4">
          {/* Bannière de l'affiche */}
          <div className="relative h-32 rounded-2xl overflow-hidden border border-white/10">
            <SafeImage
              src={getOptimizedImageUrl(ticket.eventPoster, 600)}
              rawSrc={ticket.eventPoster}
              alt={ticket.eventTitle}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/35 to-transparent" />
            <div className="absolute top-2.5 right-2.5">
              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border backdrop-blur-md uppercase tracking-wider ${statusMeta.badgeClass}`}
              >
                {statusMeta.label}
              </span>
            </div>
            <div className="absolute bottom-3 inset-x-3 min-w-0">
              <span className="bg-[#E9C349] text-[#241A00] text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full mb-1 inline-block">
                {ticket.tierName}
              </span>
              <h3 className="font-heading text-base sm:text-lg font-bold text-white leading-tight truncate">
                {ticket.eventTitle}
              </h3>
            </div>
          </div>

          {/* Métadonnées du Billet */}
          <div className="grid grid-cols-2 gap-3 bg-[#1F1F1F] p-3.5 rounded-2xl border border-white/5 text-xs">
            <div className="min-w-0">
              <p className="text-[10px] uppercase text-gray-400 font-bold">Titulaire</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {(ticket.holderAvatar || ticket.assignedToAvatar) && (
                  <img
                    src={ticket.holderAvatar || ticket.assignedToAvatar}
                    alt={ticket.holderName}
                    loading="lazy"
                    decoding="async"
                    className="w-5 h-5 rounded-full object-cover border border-[#E9C349]"
                  />
                )}
                <p className="font-bold text-white truncate">{ticket.holderName}</p>
              </div>
              {isAdminMode && ticket.holderPhone && (
                <p className="text-[11px] font-mono text-gray-400 flex items-center gap-1 mt-0.5 truncate">
                  <Phone className="w-3 h-3 text-[#E9C349] shrink-0" />
                  <span>{ticket.holderPhone}</span>
                </p>
              )}
            </div>

            <div className="min-w-0">
              <p className="text-[10px] uppercase text-gray-400 font-bold">
                {isAdminMode ? 'Canal & Placement' : 'Placement'}
              </p>
              <p className="font-bold text-[#DCB8FF] truncate">
                {ticket.seatNumber || 'Accès Officiel'}
              </p>
              {isAdminMode && (
                <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5 truncate">
                  <Store className="w-3 h-3 text-[#8A2BE2] shrink-0" />
                  <span>
                    {ticket.isPhysical
                      ? `Guichet${posPointLabel ? ` : ${posPointLabel}` : ' POS'}`
                      : 'Vente En Ligne'}
                  </span>
                </p>
              )}
            </div>

            <div>
              <p className="text-[10px] uppercase text-gray-400 font-bold">Date & Heure</p>
              <p className="font-semibold text-white">{ticket.eventDate}</p>
              <p className="text-gray-400">{ticket.eventTime}</p>
            </div>

            <div>
              <p className="text-[10px] uppercase text-gray-400 font-bold">Tarif Réglé</p>
              <p className="font-bold text-[#E9C349] tabular-nums">
                {Number(ticket.price).toLocaleString('fr-FR')} FCFA
              </p>
            </div>
          </div>

          {/* Lieu */}
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/5 text-xs text-gray-300">
            <MapPin className="w-4 h-4 text-[#8A2BE2] flex-shrink-0" />
            <span className="truncate">{ticket.eventVenue}</span>
          </div>

          {/* SECTION QR CODE OU ATTESTATION EN COURS DE VÉRIFICATION */}
          {isPendingPayment ? (
            <div className="p-6 rounded-2xl bg-[#1C1B1B] text-white flex flex-col items-center justify-center text-center shadow-xl border-2 border-amber-500/40 space-y-3">
              <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center animate-pulse">
                <Clock className="w-7 h-7" />
              </div>
              <h4 className="font-heading font-extrabold text-base text-[#E9C349]">
                Paiement en cours de vérification
              </h4>
              <p className="text-xs text-gray-300 max-w-xs leading-relaxed">
                Votre pass QR sera généré et activé dès confirmation de la transaction Wave/OM.
              </p>
              <div className="bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
                <span className="text-[11px] font-mono font-bold text-gray-300">
                  Réf. commande : <strong className="text-[#1DC3F4]">{ticket.qrCode}</strong>
                </span>
              </div>
            </div>
          ) : (
            <div className="p-4 sm:p-5 rounded-2xl bg-white text-black flex flex-col items-center justify-center text-center shadow-2xl relative">
              {!isAdminMode && (
                <>
                  {!isRevealed ? (
                    <div className="mb-2.5 flex flex-col items-center gap-1">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#8A2BE2]/10 border border-[#8A2BE2]/30 text-[#8A2BE2] text-xs font-heading font-extrabold tracking-wide uppercase animate-pulse">
                        <Ticket className="w-3.5 h-3.5 text-[#E9C349]" />
                        <span>Frottez pour révéler votre billet</span>
                      </span>
                      <p className="text-[10px] text-gray-500 font-medium">
                        Glissez votre doigt ou la souris sur la surface dorée
                      </p>
                    </div>
                  ) : (
                    <div className="mb-2 flex items-center gap-1.5 text-emerald-600 text-xs font-bold animate-in fade-in">
                      <CheckCircle className="w-4 h-4" />
                      <span>Billet révélé et prêt pour le scan d'entrée</span>
                    </div>
                  )}
                </>
              )}

              {/* Canvas QR Code généré uniquement à l'ouverture */}
              <div className="relative p-2 rounded-xl bg-gray-50 border border-gray-200 mb-2 flex items-center justify-center overflow-hidden touch-none select-none">
                <canvas
                  ref={canvasRef}
                  className={`w-48 h-48 sm:w-52 sm:h-52 transition-opacity duration-300 ${
                    isQrReady ? 'opacity-100' : 'opacity-20'
                  }`}
                />

                {!isAdminMode && !isRevealed && isQrReady && (
                  <canvas
                    ref={scratchCanvasRef}
                    onMouseDown={() => {
                      isScratchingRef.current = true;
                    }}
                    onMouseMove={(e) => handleScratchMove(e.clientX, e.clientY)}
                    onMouseUp={() => {
                      isScratchingRef.current = false;
                    }}
                    onMouseLeave={() => {
                      isScratchingRef.current = false;
                    }}
                    onTouchStart={() => {
                      isScratchingRef.current = true;
                    }}
                    onTouchMove={(e) => {
                      if (e.touches[0]) {
                        handleScratchMove(e.touches[0].clientX, e.touches[0].clientY);
                      }
                    }}
                    onTouchEnd={() => {
                      isScratchingRef.current = false;
                    }}
                    className="absolute inset-0 w-full h-full cursor-crosshair z-20 rounded-xl shadow-inner transition-opacity duration-300"
                    style={{ touchAction: 'none' }}
                  />
                )}
              </div>

              {!isAdminMode && !isRevealed && isQrReady && (
                <button
                  type="button"
                  onClick={() => setIsRevealed(true)}
                  className="mt-1 text-[11px] font-bold text-[#8A2BE2] hover:text-[#7822c9] underline transition-colors cursor-pointer"
                >
                  Passer le grattage et afficher directement
                </button>
              )}

              <div className="flex items-center gap-1.5 justify-center mt-2">
                <QrCode className="w-3.5 h-3.5 text-[#8A2BE2]" />
                <p className="font-mono text-xs font-bold tracking-widest text-[#241A00]">
                  {ticket.qrCode}
                </p>
              </div>

              <p className="text-[10px] text-gray-500 mt-1 flex items-center gap-1 font-sans">
                <CheckCircle className="w-3 h-3 text-emerald-600" />
                QR Code certifié avec signature visuelle Thièsdn
              </p>
            </div>
          )}

          {downloadSuccess && (
            <div className="p-2.5 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-xs text-center font-bold animate-in fade-in">
              {downloadSuccess}
            </div>
          )}

          {/* Ajout calendrier pour le client */}
          {!isAdminMode && (
            <div className="pt-0.5">
              <AddToCalendarButton
                eventData={{
                  title: ticket.eventTitle,
                  dateStr: ticket.eventDate,
                  timeStr: ticket.eventTime,
                  venue: ticket.eventVenue,
                  city: 'Thiès / Petite Côte',
                  tierName: ticket.tierName,
                  qrCode: ticket.qrCode,
                  holderName: ticket.holderName,
                  ticketUrl:
                    typeof window !== 'undefined'
                      ? window.location.href
                      : 'https://billetterie.thiesdn.site/',
                }}
                variant="secondary"
                className="w-full flex justify-center"
              />
            </div>
          )}

          {/* Boutons d'Action */}
          {isPendingPayment ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDownloadReceipt}
                className="flex-1 h-11 min-h-[44px] px-4 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-heading font-extrabold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-amber-600/30 cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>Télécharger mon reçu PDF</span>
              </button>
            </div>
          ) : isAdminMode ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleDownloadPassPng}
                  disabled={!isQrReady}
                  className="h-11 min-h-[44px] px-3 rounded-xl bg-[#8A2BE2] hover:bg-[#7822c9] disabled:opacity-50 text-white font-heading font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-[#8A2BE2]/30 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-[#E9C349]" />
                  <span>QR PNG HD</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadTicketPdf}
                  disabled={!isQrReady}
                  className="h-11 min-h-[44px] px-3 rounded-xl bg-[#E9C349] hover:bg-[#d8b33c] disabled:opacity-50 text-[#241A00] font-heading font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  <span>Billet PDF A4</span>
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCopyDirectLink}
                  className="flex-1 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  {copiedLink ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-[#DCB8FF]" />
                  )}
                  <span>{copiedLink ? 'Lien copié !' : 'Copier lien du pass'}</span>
                </button>

                {ticket.holderPhone && (
                  <button
                    type="button"
                    onClick={handleWhatsAppShare}
                    className="flex-1 h-10 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/35 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Envoyer WhatsApp</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDownloadPassPng}
                disabled={!isQrReady}
                className="flex-1 h-11 min-h-[44px] px-4 rounded-xl bg-[#8A2BE2] hover:bg-[#7822c9] disabled:opacity-50 text-white font-heading font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-[#8A2BE2]/30 active:scale-95 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Télécharger Pass (PNG)</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadTicketPdf}
                disabled={!isQrReady}
                title="Télécharger en PDF A4"
                aria-label="Télécharger le billet en PDF"
                className="w-11 h-11 min-h-[44px] min-w-[44px] rounded-xl bg-[#E9C349]/15 hover:bg-[#E9C349]/25 text-[#E9C349] border border-[#E9C349]/40 flex items-center justify-center transition-all cursor-pointer shrink-0 disabled:opacity-50"
              >
                <FileText className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (navigator.share) {
                    navigator
                      .share({
                        title: ticket.eventTitle,
                        text: `Mon pass officiel pour ${ticket.eventTitle} sur Thièsdn Billetterie : ${ticket.qrCode}`,
                      })
                      .catch(() => {});
                  } else {
                    navigator.clipboard.writeText(ticket.qrCode);
                    showToast('Code du pass copié dans le presse-papier !');
                  }
                }}
                aria-label="Partager le billet"
                className="w-11 h-11 min-h-[44px] min-w-[44px] rounded-xl bg-[#1F1F1F] hover:bg-[#2A2A2A] text-[#DCB8FF] border border-white/10 font-heading font-bold text-xs flex items-center justify-center transition-all cursor-pointer shrink-0"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
