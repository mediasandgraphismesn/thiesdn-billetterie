import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Printer,
  Send,
  Download,
  Share2,
  ShieldCheck,
  CheckCircle,
} from 'lucide-react';
import QRCode from 'qrcode';
import { Accreditation } from '../types';
import { LOGO_TIGHT_DATA_URL } from '../assets/logoTightBase64';

interface AccreditationBadgeModalProps {
  accreditation: Accreditation | null;
  isOpen: boolean;
  onClose: () => void;
  onSendWhatsApp?: (acc: Accreditation) => void;
}

export const AccreditationBadgeModal: React.FC<AccreditationBadgeModalProps> = ({
  accreditation,
  isOpen,
  onClose,
  onSendWhatsApp,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isQrReady, setIsQrReady] = useState(false);

  useEffect(() => {
    if (!isOpen || !accreditation || !canvasRef.current) return;

    let isCancelled = false;
    setIsQrReady(false);

    const canvas = canvasRef.current;
    const qrSize = 320;
    const qrText = accreditation.qrCode;

    // Charger le logo officiel
    const logoImg = new Image();
    logoImg.crossOrigin = 'anonymous';

    const loadLogo = new Promise<HTMLImageElement>((resolve) => {
      logoImg.onload = () => resolve(logoImg);
      logoImg.onerror = () => {
        const fb = new Image();
        fb.onload = () => resolve(fb);
        fb.src = LOGO_TIGHT_DATA_URL;
      };
      logoImg.src = '/logo-tight.png';
    });

    loadLogo
      .then((loadedLogo) => {
        if (isCancelled) return;
        return QRCode.toCanvas(canvas, qrText, {
          width: qrSize,
          margin: 2, // Margin 2 selon spécifications
          errorCorrectionLevel: 'H', // Tolérance aux erreurs 30%
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

        // Ratio 0.4 selon les spécifications
        const logoTargetW = Math.floor(qrSize * 0.40);
        const aspectRatio = loadedLogo.naturalHeight / loadedLogo.naturalWidth || 1;
        const logoTargetH = Math.floor(logoTargetW * aspectRatio);

        const padX = 8;
        const padY = 6;
        const badgeW = logoTargetW + padX * 2;
        const badgeH = logoTargetH + padY * 2;
        const badgeX = (qrSize - badgeW) / 2;
        const badgeY = (qrSize - badgeH) / 2;

        ctx.save();
        // Fond blanc protecteur
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
        ctx.shadowBlur = 10;
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
        ctx.lineWidth = 2;
        ctx.stroke();

        // Dessin du logo centré
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
        console.warn('Fallback QR badge sans logo:', err);
        QRCode.toCanvas(canvas, qrText, {
          width: qrSize,
          margin: 2,
          errorCorrectionLevel: 'H',
        })
          .then(() => setIsQrReady(true))
          .catch((e) => console.error('Erreur génération QR badge:', e));
      });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, accreditation]);

  if (!isOpen || !accreditation) return null;

  const handlePrintBadge = () => {
    window.print();
  };

  const handleDownloadBadge = () => {
    if (!canvasRef.current) return;
    try {
      const dataUrl = canvasRef.current.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `Badge-${accreditation.type}-${accreditation.qrCode}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error(e);
    }
  };

  const isStaff = accreditation.type === 'staff';
  const isInvite = accreditation.type === 'invite';

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#0A0A0A] border-2 border-white/20 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl overflow-hidden">
        {/* Effet Néon Ambient */}
        <div
          className={`absolute -top-24 -left-24 w-56 h-56 rounded-full blur-3xl opacity-30 pointer-events-none ${
            isStaff ? 'bg-[#8A2BE2]' : isInvite ? 'bg-[#E9C349]' : 'bg-[#0284C7]'
          }`}
        />
        <div
          className={`absolute -bottom-24 -right-24 w-56 h-56 rounded-full blur-3xl opacity-30 pointer-events-none ${
            isStaff ? 'bg-[#8A2BE2]' : isInvite ? 'bg-[#E9C349]' : 'bg-[#0284C7]'
          }`}
        />

        {/* Bouton Fermer */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 transition-all z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* CARTE BADGE IMPRIMABLE */}
        <div
          id="printable-badge"
          className={`relative bg-gradient-to-b from-[#141414] via-[#0E0E0E] to-[#0A0A0A] rounded-2xl p-6 border-2 text-center space-y-4 shadow-2xl ${
            isStaff
              ? 'border-[#8A2BE2] shadow-[0_0_30px_rgba(138,43,226,0.3)]'
              : isInvite
              ? 'border-[#E9C349] shadow-[0_0_30px_rgba(233,195,73,0.3)]'
              : 'border-[#0284C7] shadow-[0_0_30px_rgba(2,132,199,0.3)]'
          }`}
        >
          {/* En-tête Badge */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="text-left">
              <span className="font-heading text-xs font-black tracking-widest text-[#E9C349] uppercase">
                THIÈSDN BILLETTERIE
              </span>
              <p className="text-[10px] text-gray-400">Pass Officiel de Sécurité</p>
            </div>
            <div className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-white/10 text-white font-mono">
              OFFICIEL
            </div>
          </div>

          {/* Grand Bandeau Rôle */}
          <div>
            <div
              className={`py-2 px-4 rounded-xl font-heading font-black text-sm uppercase tracking-wider text-white shadow-lg ${
                isStaff
                  ? 'bg-gradient-to-r from-purple-700 to-[#8A2BE2]'
                  : isInvite
                  ? 'bg-gradient-to-r from-amber-600 to-[#E9C349] text-black font-extrabold'
                  : 'bg-gradient-to-r from-sky-700 to-[#0284C7]'
              }`}
            >
              {isStaff && 'ACCÈS STAFF TECHNIQUE'}
              {isInvite && 'INVITÉ VIP / GUEST LIST'}
              {!isStaff && !isInvite && 'ACCRÉDITATION PRESSE OFFICIELLE'}
            </div>
          </div>

          {/* Titulaire & Rôle */}
          <div className="space-y-1">
            <h2 className="font-heading text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
              {accreditation.holderName}
            </h2>
            {accreditation.organization && (
              <p className="text-xs font-bold text-[#E9C349] uppercase tracking-wide">
                {accreditation.organization}
              </p>
            )}
            <p className="text-xs text-gray-400">{accreditation.holderPhone}</p>
          </div>

          {/* Image QR Code Haute Définition avec Logo au Centre */}
          <div className="p-3 bg-white rounded-2xl w-52 h-52 mx-auto flex items-center justify-center shadow-xl">
            <canvas
              ref={canvasRef}
              className={`w-full h-full object-contain transition-opacity duration-300 ${
                isQrReady ? 'opacity-100' : 'opacity-20'
              }`}
            />
          </div>

          {/* Code Unique & Consignes */}
          <div className="space-y-1.5 pt-1">
            <p className="font-mono font-black text-sm text-white tracking-widest bg-white/5 py-1.5 px-3 rounded-lg border border-white/10 inline-block">
              {accreditation.qrCode}
            </p>
            <p className="text-[10px] text-gray-400 uppercase font-semibold">
              Événement : {accreditation.eventTitle}
            </p>
            <p className="text-[9px] text-gray-500 italic max-w-xs mx-auto">
              Présentation obligatoire à l'entrée. Badge strictement nominatif et infalsifiable.
            </p>
          </div>
        </div>

        {/* Actions sur le Badge */}
        <div className="grid grid-cols-3 gap-2 pt-2">
          <button
            onClick={handlePrintBadge}
            className="py-3 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-heading font-extrabold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all"
          >
            <Printer className="w-4 h-4 text-[#E9C349]" />
            Imprimer
          </button>

          <button
            onClick={handleDownloadBadge}
            className="py-3 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-heading font-extrabold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all"
          >
            <Download className="w-4 h-4 text-[#1DC3F4]" />
            Pass HD
          </button>

          {onSendWhatsApp && (
            <button
              onClick={() => onSendWhatsApp(accreditation)}
              className="py-3 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-heading font-extrabold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-lg"
            >
              <Send className="w-4 h-4" />
              WhatsApp
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
