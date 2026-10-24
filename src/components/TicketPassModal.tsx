import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  MapPin,
  Download,
  Share2,
  ShieldCheck,
  CheckCircle,
  Sparkles,
} from 'lucide-react';
import QRCode from 'qrcode';
import { UserTicket } from '../types';
import { AddToCalendarButton } from './AddToCalendarButton';
import { CalendarEventData } from '../services/calendar';

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
  const [isQrReady, setIsQrReady] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

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

    const loadLogoPromise = new Promise<HTMLImageElement>((resolve, reject) => {
      logo.onload = () => resolve(logo);
      logo.onerror = () => reject(new Error('Logo introuvable'));
      logo.src = '/logo-tight.png';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm sm:max-w-md bg-gradient-to-b from-[#221F28] via-[#171717] to-[#121212] border border-[#8A2BE2]/40 rounded-3xl overflow-hidden shadow-2xl my-6">
        
        {/* TOP BAR AVEC LOGO OFFICIEL THIÈSDN */}
        <div className="p-4 flex items-center justify-between border-b border-white/10 bg-black/40">
          <div className="flex items-center gap-2.5">
            {/* Logo officiel en haut du billet */}
            <div className="h-7 px-2 py-0.5 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center">
              <img
                src="/logo-tight.png"
                alt="Thièsdn Logo"
                className="h-4 w-auto object-contain"
              />
            </div>
            <span className="font-heading font-extrabold text-xs text-[#E9C349] flex items-center gap-1.5 uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5 text-[#E9C349]" /> Pass Billet Officiel
            </span>
          </div>

          <button
            onClick={onClose}
            aria-label="Fermer le pass"
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corps Visuel du Billet */}
        <div className="p-6 space-y-5">
          {/* Bannière de l'affiche */}
          <div className="relative h-36 rounded-2xl overflow-hidden border border-white/10">
            <img
              src={ticket.eventPoster}
              alt={ticket.eventTitle}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
            <div className="absolute bottom-3 inset-x-3">
              <span className="bg-[#E9C349] text-[#241A00] text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full mb-1 inline-block">
                {ticket.tierName}
              </span>
              <h3 className="font-heading text-lg font-bold text-white leading-tight">
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

          {/* SECTION QR CODE AVEC LOGO CENTRÉ (CANVAS OVERLAY) */}
          <div className="p-5 rounded-2xl bg-white text-black flex flex-col items-center justify-center text-center shadow-2xl relative">
            <div className="p-2 rounded-xl bg-gray-50 border border-gray-200 mb-2 flex items-center justify-center">
              <canvas
                ref={canvasRef}
                className={`w-52 h-52 sm:w-56 sm:h-56 transition-opacity duration-300 ${
                  isQrReady ? 'opacity-100' : 'opacity-20'
                }`}
              />
            </div>

            <div className="flex items-center gap-1.5 justify-center">
              <Sparkles className="w-3.5 h-3.5 text-[#8A2BE2]" />
              <p className="font-mono text-xs font-bold tracking-widest text-[#241A00]">
                {ticket.qrCode}
              </p>
            </div>

            <p className="text-[10px] text-gray-500 mt-1 flex items-center gap-1 font-sans">
              <CheckCircle className="w-3 h-3 text-emerald-600" />
              QR Code certifié avec signature visuelle Thièsdn
            </p>
          </div>

          {downloadSuccess && (
            <div className="p-2.5 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-xs text-center font-bold animate-in fade-in">
              Pass téléchargé avec succès !
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
            <button
              onClick={handleDownloadPass}
              className="flex-1 py-3 px-4 rounded-xl bg-[#8A2BE2] hover:bg-[#7822c9] text-white font-heading font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-[#8A2BE2]/30 active:scale-[0.98]"
            >
              <Download className="w-4 h-4" />
              Télécharger Pass
            </button>
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
              className="py-3 px-4 rounded-xl bg-[#1F1F1F] hover:bg-[#2A2A2A] text-[#DCB8FF] border border-white/10 font-heading font-bold text-xs flex items-center justify-center gap-2 transition-all"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
