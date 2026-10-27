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
} from 'lucide-react';
import QRCode from 'qrcode';
import jsPDF from 'jspdf';
import { UserTicket } from '../types';
import { AddToCalendarButton } from './AddToCalendarButton';
import { CalendarEventData } from '../services/calendar';
import { LOGO_TIGHT_DATA_URL } from '../assets/logoTightBase64';

interface TicketPassModalProps {
  ticket: UserTicket | null;
  isOpen: boolean;
  onClose: () => void;
}

export const TicketPassModal: React.FC<TicketPassModalProps> = ({
  ticket,
  isOpen,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scratchCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isScratchingRef = useRef(false);
  const scratchMovesRef = useRef(0);

  const [isQrReady, setIsQrReady] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Pluie de confettis Violet (#8A2BE2) et Or (#E9C349) à l'ouverture du pass
  useEffect(() => {
    if (isOpen) {
      setIsRevealed(false);
      scratchMovesRef.current = 0;
      confetti({
        particleCount: 90,
        spread: 75,
        origin: { y: 0.6 },
        colors: ['#8A2BE2', '#E9C349', '#DCB8FF', '#FFFFFF'],
      });
    }
  }, [isOpen]);

  // Initialisation du canvas de grattage (Scratch Card) avec Logo Officiel Thièsdn
  const initScratchCanvas = useCallback(() => {
    const sc = scratchCanvasRef.current;
    if (!sc) return;
    const ctx = sc.getContext('2d');
    if (!ctx) return;

    sc.width = 260;
    sc.height = 260;

    // 1. Fond métallisé nocturne protecteur
    const grad = ctx.createLinearGradient(0, 0, sc.width, sc.height);
    grad.addColorStop(0, '#221F28');
    grad.addColorStop(0.5, '#35323D');
    grad.addColorStop(1, '#18161D');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, sc.width, sc.height);

    // 2. Liseré or de sécurité prestige (#E9C349)
    ctx.strokeStyle = '#E9C349';
    ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, sc.width - 8, sc.height - 8);

    // 3. Dessin du Logo Officiel Thièsdn au centre exact (SUR UN CARRÉ BLANC DE SÉCURITÉ)
    const logoImg = new Image();
    logoImg.crossOrigin = 'anonymous';
    logoImg.onload = () => {
      // Taille relative 24% de la largeur du canvas, cohérente avec le QR Code
      const logoTargetW = Math.floor(sc.width * 0.28);
      const aspectRatio = logoImg.naturalHeight / logoImg.naturalWidth;
      const logoTargetH = Math.floor(logoTargetW * aspectRatio);

      const padX = 8;
      const padY = 6;
      const badgeW = logoTargetW + padX * 2;
      const badgeH = logoTargetH + padY * 2;
      const badgeX = (sc.width - badgeW) / 2;
      const badgeY = (sc.height - badgeH) / 2;

      ctx.save();
      // Carré/badge blanc protecteur pour lisibilité optimale du logo
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

      // Liseré or prestige officiel (#E9C349)
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = '#E9C349';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Dessin de l'image officielle du logo au centre exact
      ctx.drawImage(logoImg, badgeX + padX, badgeY + padY, logoTargetW, logoTargetH);
      ctx.restore();

      // Consignes tactiles sobres au-dessus et en-dessous
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

    // Chargement garanti instantané via le base64 officiel
    logoImg.src = LOGO_TIGHT_DATA_URL;
  }, []);

  // Détection du frottement (Touch & Mouse) avec globalCompositeOperation = 'destination-out'
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

    // Vérifier la proportion de surface grattée tous les 8 mouvements
    if (scratchMovesRef.current % 8 === 0) {
      try {
        const imgData = ctx.getImageData(0, 0, sc.width, sc.height);
        let transparent = 0;
        const total = imgData.data.length / 16;
        for (let i = 3; i < imgData.data.length; i += 16) {
          if (imgData.data[i] === 0) transparent++;
        }
        // Si plus de 40% de la pellicule est effacée, déverrouiller complètement le QR code
        if (transparent / total > 0.40) {
          setIsRevealed(true);
        }
      } catch {
        // Fallback transparent
      }
    }
  };

  const onMouseDown = () => {
    isScratchingRef.current = true;
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    handleScratchMove(e.clientX, e.clientY);
  };

  const onMouseUp = () => {
    isScratchingRef.current = false;
  };

  const onTouchStart = () => {
    isScratchingRef.current = true;
  };

  const onTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches[0]) {
      handleScratchMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const onTouchEnd = () => {
    isScratchingRef.current = false;
  };

  useEffect(() => {
    if (isQrReady && !isRevealed) {
      initScratchCanvas();
    }
  }, [isQrReady, isRevealed, initScratchCanvas]);

  useEffect(() => {
    if (!isOpen || !ticket || !canvasRef.current) return;

    let isCancelled = false;
    setIsQrReady(false);

    const canvas = canvasRef.current;
    const qrText = ticket.qrCode || `THIESDN-TKT-${ticket.id}`;
    const qrSize = 260;

    // 1. Charger l'image du logo officiel de Thièsdn
    const logo = new Image();
    logo.crossOrigin = 'anonymous';

    const loadLogoPromise = new Promise<HTMLImageElement>((resolve) => {
      logo.onload = () => resolve(logo);
      logo.onerror = () => {
        // Fallback immédiat et inaltérable sur la chaîne base64 certifiée
        const fallback = new Image();
        fallback.onload = () => resolve(fallback);
        fallback.src = LOGO_TIGHT_DATA_URL;
      };
      logo.src = LOGO_TIGHT_DATA_URL;
    });

    loadLogoPromise
      .then((loadedLogo) => {
        if (isCancelled) return;

        // 2. Générer le QR Code avec un niveau de correction d'erreur High ('H' = 30% récupérable)
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

        // 3. Calcul de la taille du logo au centre (~22% de la largeur du QR Code)
        const logoTargetW = Math.floor(qrSize * 0.24);
        const aspectRatio = loadedLogo.naturalHeight / loadedLogo.naturalWidth;
        const logoTargetH = Math.floor(logoTargetW * aspectRatio);

        // Marge blanche (padding) protectrice autour du logo
        const padX = 6;
        const padY = 5;
        const badgeW = logoTargetW + padX * 2;
        const badgeH = logoTargetH + padY * 2;
        const badgeX = (qrSize - badgeW) / 2;
        const badgeY = (qrSize - badgeH) / 2;

        ctx.save();

        // 4. Dessin du badge blanc protecteur avec ombre douce
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

        // Liseré or de sécurité prestige (#E9C349)
        ctx.shadowColor = 'transparent';
        ctx.strokeStyle = '#E9C349';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 5. Dessin du logo officiel au centre exact
        ctx.drawImage(
          loadedLogo,
          badgeX + padX,
          badgeY + padY,
          logoTargetW,
          logoTargetH
        );

        ctx.restore();
        setIsQrReady(true);
      })
      .catch((err) => {
        console.warn('Fallback QR code standard sans logo overlay:', err);
        QRCode.toCanvas(canvas, qrText, {
          width: qrSize,
          margin: 2,
          errorCorrectionLevel: 'H',
          color: {
            dark: '#0A0A0A',
            light: '#FFFFFF',
          },
        })
          .then(() => setIsQrReady(true))
          .catch((e) => console.error('Erreur génération QR:', e));
      });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, ticket]);

  const isPendingPayment =
    ticket?.status === 'pending' || ticket?.status === 'payment_signaled';

  // Génération d'un reçu PDF propre (sans QR code, format A4 sobre) via jsPDF
  const handleDownloadReceipt = () => {
    if (!ticket) return;
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      // En-tête sobre
      doc.setFillColor(23, 23, 23);
      doc.rect(0, 0, 210, 40, 'F');

      doc.setTextColor(233, 195, 73); // #E9C349
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('THIÈSDN BILLETTERIE', 20, 24);

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('REÇU PROVISOIRE DE COMMANDE', 135, 24);

      // Ligne dorée
      doc.setDrawColor(233, 195, 73);
      doc.setLineWidth(0.8);
      doc.line(20, 46, 190, 46);

      // Statut et Référence
      doc.setTextColor(40, 40, 40);
      doc.setFontSize(11);

      doc.setFont('helvetica', 'bold');
      doc.text('Statut de la commande :', 20, 60);
      doc.setTextColor(217, 119, 6); // Orange foncé
      doc.text('EN ATTENTE DE VÉRIFICATION PAIEMENT WAVE', 75, 60);

      doc.setTextColor(40, 40, 40);
      doc.setFont('helvetica', 'bold');
      doc.text('Référence de commande :', 20, 72);
      doc.setFont('helvetica', 'normal');
      doc.text(ticket.qrCode || `CMD-${ticket.id}`, 75, 72);

      doc.setFont('helvetica', 'bold');
      doc.text('Date d\'émission :', 20, 84);
      doc.setFont('helvetica', 'normal');
      doc.text(new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }), 75, 84);

      doc.setFont('helvetica', 'bold');
      doc.text('Bénéficiaire / Client :', 20, 96);
      doc.setFont('helvetica', 'normal');
      doc.text(ticket.holderName, 75, 96);

      // Bloc Récapitulatif Événement
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

      // Encadré Montant
      doc.setFillColor(23, 23, 23);
      doc.roundedRect(20, 170, 170, 22, 3, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Total Réglé (Wave) :', 28, 184);
      doc.setTextColor(233, 195, 73);
      doc.setFontSize(13);
      doc.text(`${ticket.price.toLocaleString('fr-FR')} FCFA`, 140, 184);

      // Note de bas de page
      doc.setTextColor(110, 110, 110);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'italic');
      doc.text('Ce reçu officiel certifie l\'enregistrement de votre réservation sur Thièsdn Billetterie.', 20, 208);
      doc.text('Votre Pass Officiel définitif avec QR Code de scan sera activé dès rapprochement Wave.', 20, 214);
      doc.text('Support & Renseignements : contact@thiesdn.site | +221 77 123 45 67', 20, 220);

      doc.save(`Recu-Commande-${ticket.qrCode || ticket.id}.pdf`);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (pdfErr) {
      console.error('Erreur génération reçu PDF:', pdfErr);
      alert('Impossible de générer le reçu PDF pour le moment.');
    }
  };

  // Téléchargement réel du pass officiel avec QR Code et Logo
  const handleDownloadPass = () => {
    if (!canvasRef.current || !ticket) return;

    try {
      const dataUrl = canvasRef.current.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      const cleanTitle = ticket.eventTitle.replace(/[^a-zA-Z0-9]/g, '_');
      downloadLink.download = `Billet-Thiesdn-${cleanTitle}-${ticket.qrCode}.png`;
      downloadLink.href = dataUrl;
      downloadLink.click();

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch {
      alert('Téléchargement du pass en cours...');
    }
  };

  if (!isOpen || !ticket) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-sm sm:max-w-md bg-gradient-to-b from-[#1C1824] via-[#0A0A0A] to-[#121118] border border-[#8A2BE2]/40 rounded-3xl overflow-hidden shadow-2xl my-4 sm:my-6"
      >
        
        {/* TOP BAR AVEC LOGO OFFICIEL THIÈSDN */}
        <div className="p-3.5 sm:p-4 flex items-center justify-between border-b border-white/10 bg-black/50">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Logo officiel en haut du billet */}
            <div className="h-8 px-2 py-0.5 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center shrink-0">
              <img
                src="/logo-tight.png"
                alt="Thièsdn Logo"
                className="h-5 w-auto object-contain"
              />
            </div>
            <span className="font-heading font-extrabold text-xs text-[#E9C349] flex items-center gap-1.5 uppercase tracking-wider truncate">
              <ShieldCheck className="w-3.5 h-3.5 text-[#E9C349] shrink-0" /> Pass Billet Officiel
            </span>
          </div>

          <button
            onClick={onClose}
            aria-label="Fermer le pass"
            className="w-11 h-11 min-h-[44px] min-w-[44px] rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps Visuel du Billet */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
          {/* Bannière de l'affiche */}
          <div className="relative h-36 rounded-2xl overflow-hidden border border-white/10">
            <SafeImage
              src={ticket.eventPoster}
              alt={ticket.eventTitle}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
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
          <div className="grid grid-cols-2 gap-3 bg-[#1F1F1F] p-4 rounded-2xl border border-white/5 text-xs">
            <div>
              <p className="text-[10px] uppercase text-gray-400 font-bold">Titulaire</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {(ticket.holderAvatar || ticket.assignedToAvatar) && (
                  <img
                    src={ticket.holderAvatar || ticket.assignedToAvatar}
                    alt={ticket.holderName}
                    className="w-5 h-5 rounded-full object-cover border border-[#E9C349]"
                  />
                )}
                <p className="font-bold text-white truncate">{ticket.holderName}</p>
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase text-gray-400 font-bold">Placement</p>
              <p className="font-bold text-[#DCB8FF]">{ticket.seatNumber || 'VIP Accès'}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-gray-400 font-bold">Date & Heure</p>
              <p className="font-semibold text-white">{ticket.eventDate}</p>
              <p className="text-gray-400">{ticket.eventTime}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-gray-400 font-bold">Tarif Réglé</p>
              <p className="font-bold text-[#E9C349] tabular-nums">
                {ticket.price.toLocaleString('fr-FR')} FCFA
              </p>
            </div>
          </div>

          {/* Lieu */}
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white/5 text-xs text-gray-300">
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
                ⏳ Paiement en cours de vérification. Votre pass sera disponible dès confirmation de la transaction Wave.
              </p>
              <div className="bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
                <span className="text-[11px] font-mono font-bold text-gray-300">
                  Réf. commande : <strong className="text-[#1DC3F4]">{ticket.qrCode}</strong>
                </span>
              </div>
            </div>
          ) : (
            <div className="p-5 rounded-2xl bg-white text-black flex flex-col items-center justify-center text-center shadow-2xl relative">
              {/* Texte et indicateur Scratch Card */}
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

              {/* Conteneur Superposé QR Code + Scratch Canvas */}
              <div className="relative p-2 rounded-xl bg-gray-50 border border-gray-200 mb-2 flex items-center justify-center overflow-hidden touch-none select-none">
                {/* Canvas du QR Code certifié */}
                <canvas
                  ref={canvasRef}
                  className={`w-52 h-52 sm:w-56 sm:h-56 transition-opacity duration-300 ${
                    isQrReady ? 'opacity-100' : 'opacity-20'
                  }`}
                />

                {/* Canvas à gratter (Scratch Card) superposé */}
                {!isRevealed && isQrReady && (
                  <canvas
                    ref={scratchCanvasRef}
                    onMouseDown={onMouseDown}
                    onMouseMove={onMouseMove}
                    onMouseUp={onMouseUp}
                    onMouseLeave={onMouseUp}
                    onTouchStart={onTouchStart}
                    onTouchMove={onTouchMove}
                    onTouchEnd={onTouchEnd}
                    className="absolute inset-0 w-full h-full cursor-crosshair z-20 rounded-xl shadow-inner transition-opacity duration-300"
                    style={{ touchAction: 'none' }}
                  />
                )}
              </div>

              {/* Bouton de secours rapide en cas de rush à l'entrée */}
              {!isRevealed && isQrReady && (
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
              {isPendingPayment ? 'Reçu téléchargé avec succès !' : 'Pass téléchargé avec succès !'}
            </div>
          )}

          {/* AJOUT AU CALENDRIER PERSONNEL */}
          <div className="pt-1">
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
                ticketUrl: typeof window !== 'undefined' ? window.location.href : 'https://thiesdn.mgartswork.site/',
              }}
              variant="secondary"
              className="w-full flex justify-center"
            />
          </div>

          {/* Boutons d'Action */}
          <div className="flex gap-2">
            {isPendingPayment ? (
              <button
                onClick={handleDownloadReceipt}
                className="flex-1 h-12 min-h-[48px] px-4 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-heading font-extrabold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-amber-600/30 active:scale-95 cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>📄 Télécharger mon reçu de commande</span>
              </button>
            ) : (
              <button
                onClick={handleDownloadPass}
                className="flex-1 h-12 min-h-[48px] px-4 rounded-xl bg-[#8A2BE2] hover:bg-[#7822c9] text-white font-heading font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-[#8A2BE2]/30 active:scale-95 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Télécharger Pass</span>
              </button>
            )}
            <button
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
                  alert('Code du pass copié dans le presse-papier !');
                }
              }}
              aria-label="Partager le billet"
              className="w-12 h-12 min-h-[48px] min-w-[48px] rounded-xl bg-[#1F1F1F] hover:bg-[#2A2A2A] text-[#DCB8FF] border border-white/10 font-heading font-bold text-xs flex items-center justify-center transition-all cursor-pointer shrink-0"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
