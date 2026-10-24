import React, { useState, useEffect, useRef } from 'react';
import {
  QrCode,
  Scan,
  CheckCircle,
  XCircle,
  Search,
  ShieldCheck,
  Users,
  RefreshCw,
  BadgeAlert,
  Sparkles,
  Newspaper,
  UserCheck,
  AlertTriangle,
  Camera,
  CameraOff,
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { UserTicket, Accreditation } from '../types';
import { scanTicketAtomic, scanTicketWithSupabase, scanGuestTicketAtomic, scanAccreditationAtomic, getStoredAccreditations } from '../services/supabase';

interface CheckInScannerViewProps {
  tickets: UserTicket[];
  onValidateTicket: (ticketId: string) => void;
}

export const CheckInScannerView: React.FC<CheckInScannerViewProps> = ({
  tickets,
  onValidateTicket,
}) => {
  const [searchCode, setSearchCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [scanResult, setScanResult] = useState<{
    status: 'success' | 'error' | null;
    message: string;
    ticket?: UserTicket;
    accreditation?: Accreditation;
    isAccreditation?: boolean;
  }>({ status: null, message: '' });

  const [activeTab, setActiveTab] = useState<'scan' | 'list'>('scan');
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScannedRef = useRef<{ code: string; timestamp: number }>({ code: '', timestamp: 0 });

  // Sons de feedback simples avec Web Audio API (aucun MP3 externe requis)
  const playFeedbackSound = (type: 'success' | 'error') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'success') {
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        osc.frequency.setValueAtTime(880.0, audioCtx.currentTime + 0.08); // A5
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.25);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220.0, audioCtx.currentTime); // A3
        osc.frequency.setValueAtTime(164.81, audioCtx.currentTime + 0.12); // E3
        gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.35);
      }
    } catch {
      // Ignorer si audio bloqué
    }
  };

  // Initialisation de la caméra arrière (facingMode: "environment") avec html5-qrcode
  useEffect(() => {
    if (activeTab !== 'scan') {
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          scannerRef.current.stop().catch(() => {});
        }
        scannerRef.current.clear();
        scannerRef.current = null;
        setIsCameraActive(false);
      }
      return;
    }

    const scannerElementId = 'thiesdn-qr-camera-viewport';
    let isMounted = true;

    const startCamera = async () => {
      // Temporisation de sécurité pour s'assurer de la présence du DOM
      await new Promise((resolve) => setTimeout(resolve, 250));
      if (!isMounted) return;

      const element = document.getElementById(scannerElementId);
      if (!element) return;

      // Nettoyer toute instance préexistante
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            await scannerRef.current.stop();
          }
          scannerRef.current.clear();
        } catch {
          // Ignorer
        }
        scannerRef.current = null;
      }

      try {
        setCameraError(null);
        const html5Qr = new Html5Qrcode(scannerElementId);
        scannerRef.current = html5Qr;

        await html5Qr.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const edge = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.75);
              return { width: edge, height: edge };
            },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            if (!isMounted) return;
            const now = Date.now();
            // Anti-rebond : éviter de rescanner en boucle le même billet en moins de 3s
            if (
              lastScannedRef.current.code === decodedText &&
              now - lastScannedRef.current.timestamp < 3000
            ) {
              return;
            }
            lastScannedRef.current = { code: decodedText, timestamp: now };
            handleVerifyCode(decodedText);
          },
          () => {
            // Frames vides ignorées pendant la recherche
          }
        );

        if (isMounted) {
          setIsCameraActive(true);
        }
      } catch (err: any) {
        console.warn('Erreur activation caméra:', err);
        if (isMounted) {
          setIsCameraActive(false);
          setCameraError(
            err?.message ||
              "Impossible d'activer la caméra arrière. Vérifiez les autorisations de caméra de votre navigateur."
          );
        }
      }
    };

    startCamera();

    return () => {
      isMounted = false;
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          scannerRef.current.stop().catch(() => {});
        }
        scannerRef.current.clear();
        scannerRef.current = null;
      }
      setIsCameraActive(false);
    };
  }, [activeTab]);

  const handleVerifyCode = async (code: string) => {
    if (!code || isValidating) return;
    setIsValidating(true);
    const trimmedCode = code.trim();

    try {
      // 0. Cas prioritaire : Badges d'Accréditations (Staff, Invités VIP & Presse)
      if (trimmedCode.toUpperCase().startsWith('ACC-')) {
        const accredRes = await scanAccreditationAtomic(trimmedCode);
        if (accredRes.success && accredRes.accreditation) {
          setScanResult({
            status: 'success',
            message: accredRes.message,
            accreditation: accredRes.accreditation,
            isAccreditation: true,
          });
        } else {
          setScanResult({
            status: 'error',
            message: accredRes.message,
            accreditation: accredRes.accreditation,
            isAccreditation: true,
          });
        }
        setIsValidating(false);
        return;
      }

      // 1. Cas particulier : Pass Invités Guest List Artiste / Staff (GUEST-)
      if (trimmedCode.toUpperCase().startsWith('GUEST-')) {
        const guestRes = await scanGuestTicketAtomic(trimmedCode);
        if (guestRes.success && guestRes.ticket) {
          setScanResult({
            status: 'success',
            message: guestRes.message,
            ticket: {
              id: guestRes.ticket.id,
              eventId: guestRes.ticket.eventId,
              eventTitle: guestRes.ticket.eventTitle,
              eventPoster: '',
              eventDate: '',
              eventTime: '',
              eventVenue: '',
              tierName: `Guest List (${guestRes.ticket.coproducerName})`,
              price: 0,
              qrCode: guestRes.ticket.qrCode,
              holderName: guestRes.ticket.guestName,
              purchasedAt: guestRes.ticket.createdAt,
              status: 'used',
            },
          });
          setIsValidating(false);
          return;
        } else {
          setScanResult({
            status: 'error',
            message: guestRes.message,
          });
          setIsValidating(false);
          return;
        }
      }

      // 2. Vérification sécurisée en base Supabase via RPC scan_ticket
      const rpcResult = await scanTicketWithSupabase(trimmedCode);
      if (rpcResult.success) {
        playFeedbackSound('success');
        setScanResult({
          status: 'success',
          message: rpcResult.message,
          ticket: rpcResult.ticket,
        });
        if (rpcResult.ticket?.id) {
          onValidateTicket(rpcResult.ticket.id);
        }
      } else {
        // Fallback local atomique si présent en mémoire
        const localResult = await scanTicketAtomic(trimmedCode, tickets);
        if (localResult.success && localResult.ticket) {
          playFeedbackSound('success');
          onValidateTicket(localResult.ticket.id);
          setScanResult({
            status: 'success',
            message: localResult.message,
            ticket: localResult.ticket,
          });
        } else {
          playFeedbackSound('error');
          setScanResult({
            status: 'error',
            message: rpcResult.message || localResult.message || 'Billet non reconnu ou invalide.',
            ticket: rpcResult.ticket || localResult.ticket,
          });
        }
      }
    } catch (err: any) {
      playFeedbackSound('error');
      setScanResult({
        status: 'error',
        message: 'Erreur technique lors de la vérification du billet.',
      });
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Scanner & Check-in
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Contrôle d’accès et validation des pass en temps réel
          </p>
        </div>

        <div className="flex bg-[#1C1B1B] p-1 rounded-xl border border-white/10">
          <button
            onClick={() => setActiveTab('scan')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'scan' ? 'bg-[#8A2BE2] text-white' : 'text-gray-400'
            }`}
          >
            Scanner
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'list' ? 'bg-[#8A2BE2] text-white' : 'text-gray-400'
            }`}
          >
            Liste Pass ({tickets.length})
          </button>
        </div>
      </div>

      {activeTab === 'scan' ? (
        <div className="space-y-6">
          {/* Zone Caméra & Viseur Temps Réel */}
          <div className="relative h-72 sm:h-80 rounded-3xl overflow-hidden bg-black border-2 border-[#8A2BE2]/50 flex flex-col items-center justify-center shadow-2xl">
            {/* Conteneur DOM où html5-qrcode injecte le stream <video> */}
            <div
              id="thiesdn-qr-camera-viewport"
              className="absolute inset-0 w-full h-full [&>video]:w-full [&>video]:h-full [&>video]:object-cover"
            />

            {/* Overlay de chargement ou d'erreur de caméra */}
            {!isCameraActive && (
              <div className="absolute inset-0 z-0 bg-gradient-to-b from-[#181822] via-[#0e0e13] to-[#0a0a0c] flex flex-col items-center justify-center p-6 text-center">
                {cameraError ? (
                  <div className="space-y-2 max-w-xs">
                    <CameraOff className="w-10 h-10 text-amber-400 mx-auto" />
                    <p className="text-xs text-amber-200 font-medium">{cameraError}</p>
                    <p className="text-[11px] text-gray-400">
                      Vous pouvez utiliser la saisie manuelle ci-dessous.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-[#8A2BE2]/20 border border-[#8A2BE2]/40 flex items-center justify-center mx-auto animate-pulse">
                      <Camera className="w-6 h-6 text-[#DCB8FF]" />
                    </div>
                    <p className="text-xs text-gray-300 font-semibold">
                      Activation de la caméra arrière...
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Coins Dorés */}
            <div className="absolute top-6 left-6 w-8 h-8 border-t-2 border-l-2 border-[#E9C349] pointer-events-none z-10" />
            <div className="absolute top-6 right-6 w-8 h-8 border-t-2 border-r-2 border-[#E9C349] pointer-events-none z-10" />
            <div className="absolute bottom-6 left-6 w-8 h-8 border-b-2 border-l-2 border-[#E9C349] pointer-events-none z-10" />
            <div className="absolute bottom-6 right-6 w-8 h-8 border-b-2 border-r-2 border-[#E9C349] pointer-events-none z-10" />

            {/* Viseur & ligne laser animée */}
            <div className="w-52 h-52 border border-[#8A2BE2]/60 rounded-2xl relative flex items-center justify-center pointer-events-none z-10 shadow-[0_0_15px_rgba(138,43,226,0.3)]">
              {isCameraActive ? (
                <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-[#E9C349] to-transparent shadow-[0_0_12px_#E9C349] animate-bounce" />
              ) : (
                <QrCode className="w-28 h-28 text-[#8A2BE2]/30 animate-pulse" />
              )}
            </div>

            {/* Pastille Statut Caméra */}
            <div className="absolute bottom-3 inset-x-4 z-10 flex items-center justify-center pointer-events-none">
              <span className="px-3 py-1 rounded-full bg-black/75 backdrop-blur-md border border-white/10 text-[11px] font-semibold text-[#DCB8FF] flex items-center gap-1.5 shadow-lg">
                <span className={`w-2 h-2 rounded-full ${isCameraActive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                <span>{isCameraActive ? 'Caméra Arrière Active • Visez le QR code' : 'Caméra en attente'}</span>
              </span>
            </div>
          </div>

          {/* Manual Input or Quick Test */}
          <div className="glass-panel p-5 rounded-2xl space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Saisie Manuelle du Code Pass
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                placeholder="Ex: THIESDN-VIP-..."
                className="input-glass flex-1 rounded-xl px-4 py-3 text-sm text-white focus:outline-none"
              />
              <button
                onClick={() => handleVerifyCode(searchCode)}
                className="btn-primary-glow px-5 rounded-xl font-heading font-bold text-xs uppercase"
              >
                Vérifier
              </button>
            </div>

            {/* Quick test buttons with available tickets & accreditations */}
            <div className="pt-2 space-y-2">
              {tickets.length > 0 && (
                <div>
                  <p className="text-[10px] text-gray-400 mb-1.5 uppercase font-bold">
                    Billets Clients prêts pour le test :
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {tickets.slice(0, 4).map((t) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          setSearchCode(t.qrCode);
                          handleVerifyCode(t.qrCode);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-[#DCB8FF] border border-white/5 font-mono"
                      >
                        {t.holderName} ({t.tierName})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Raccourcis de test Billets Physiques Porteur (Validation par Vente) */}
              <div className="pt-2 border-t border-white/5 space-y-1.5">
                <p className="text-[10px] text-amber-300 uppercase font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  Billets Physiques Porteur (Test Règle Sécurité Validation par Vente) :
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const code = 'BPT-PHY-THS-UNSOLD';
                      setSearchCode(code);
                      handleVerifyCode(code);
                    }}
                    title="Doit être REFUSÉ car non vendu par le collaborateur"
                    className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-xs text-rose-300 border border-rose-500/40 font-mono flex items-center gap-1"
                  >
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    <span>Non Vendu (Refus Attendu)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const code = 'BPT-PHY-THS-SOLDOK';
                      setSearchCode(code);
                      handleVerifyCode(code);
                    }}
                    title="Doit être ACCEPTÉ (sold_valid)"
                    className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-xs text-emerald-300 border border-emerald-500/40 font-mono flex items-center gap-1"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>Vendu Activé (Accès Autorisé)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const code = 'BPT-PHY-THS-SCANNED';
                      setSearchCode(code);
                      handleVerifyCode(code);
                    }}
                    title="Doit être REFUSÉ (déjà utilisé)"
                    className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-xs text-amber-200 border border-amber-500/40 font-mono flex items-center gap-1"
                  >
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                    <span>Déjà Scanné (Double Entrée)</span>
                  </button>
                </div>
              </div>

              {/* Raccourcis de test Accréditations (Staff, Invité VIP, Presse) */}
              <div className="pt-1 border-t border-white/5">
                <p className="text-[10px] text-[#DCB8FF] mb-1.5 uppercase font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#E9C349]" />
                  Accréditations de test (Staff, Invité, Presse) :
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => {
                      const code = 'ACC-STAFF-THS-8F2B';
                      setSearchCode(code);
                      handleVerifyCode(code);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#8A2BE2]/20 hover:bg-[#8A2BE2]/30 text-xs text-purple-200 border border-[#8A2BE2]/40 font-mono flex items-center gap-1"
                  >
                    <span className="w-2 h-2 rounded-full bg-[#8A2BE2]" />
                    Staff : Abdoulaye Sène
                  </button>
                  <button
                    onClick={() => {
                      const code = 'ACC-INVITE-THS-9A1D';
                      setSearchCode(code);
                      handleVerifyCode(code);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#E9C349]/20 hover:bg-[#E9C349]/30 text-xs text-amber-200 border border-[#E9C349]/40 font-mono flex items-center gap-1"
                  >
                    <span className="w-2 h-2 rounded-full bg-[#E9C349]" />
                    Invité VIP : Maire Thiès
                  </button>
                  <button
                    onClick={() => {
                      const code = 'ACC-PRESSE-THS-1B9E';
                      setSearchCode(code);
                      handleVerifyCode(code);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-xs text-sky-200 border border-sky-500/40 font-mono flex items-center gap-1"
                  >
                    <span className="w-2 h-2 rounded-full bg-sky-400" />
                    Presse : Thiès Info
                  </button>
                  <button
                    onClick={() => {
                      const code = 'ACC-PRESSE-THS-7D5C';
                      setSearchCode(code);
                      handleVerifyCode(code);
                    }}
                    title="Tester la détection de badge déjà scanné"
                    className="px-2.5 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-xs text-red-200 border border-red-500/40 font-mono flex items-center gap-1"
                  >
                    <AlertTriangle className="w-3 h-3 text-red-400" />
                    Déjà Scanné (RTS 1)
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Scan result display */}
          {scanResult.status && (
            <div
              className={`p-5 rounded-2xl border animate-in zoom-in-95 duration-200 ${
                scanResult.isAccreditation && scanResult.accreditation
                  ? scanResult.status === 'success'
                    ? scanResult.accreditation.type === 'staff'
                      ? 'bg-purple-950/80 border-[#8A2BE2] text-purple-100 shadow-[0_0_20px_rgba(138,43,226,0.3)]'
                      : scanResult.accreditation.type === 'invite'
                      ? 'bg-amber-950/80 border-[#E9C349] text-amber-100 shadow-[0_0_20px_rgba(233,195,73,0.3)]'
                      : 'bg-sky-950/80 border-sky-500 text-sky-100 shadow-[0_0_20px_rgba(2,132,199,0.3)]'
                    : 'bg-red-950/80 border-red-500 text-red-200 shadow-[0_0_20px_rgba(239,68,68,0.3)]'
                  : scanResult.status === 'success'
                  ? 'bg-emerald-950/70 border-emerald-500 text-emerald-200'
                  : 'bg-red-950/70 border-red-500 text-red-200'
              }`}
            >
              {/* Header résultat accréditation */}
              {scanResult.isAccreditation && scanResult.accreditation ? (
                <div>
                  <div className="flex items-start gap-3">
                    {scanResult.status === 'success' ? (
                      <CheckCircle
                        className={`w-9 h-9 flex-shrink-0 ${
                          scanResult.accreditation.type === 'staff'
                            ? 'text-[#8A2BE2]'
                            : scanResult.accreditation.type === 'invite'
                            ? 'text-[#E9C349]'
                            : 'text-sky-400'
                        }`}
                      />
                    ) : (
                      <AlertTriangle className="w-9 h-9 text-red-400 flex-shrink-0 animate-bounce" />
                    )}
                    <div className="flex-1">
                      {/* Badge rôle distinct */}
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        {scanResult.accreditation.type === 'staff' && (
                          <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-[#8A2BE2] text-white shadow-md flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            ACCÈS STAFF - ACCRÉDITÉ
                          </span>
                        )}
                        {scanResult.accreditation.type === 'invite' && (
                          <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-[#E9C349] text-black shadow-md flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5" />
                            INVITÉ VIP - GUEST LIST
                          </span>
                        )}
                        {scanResult.accreditation.type === 'presse' && (
                          <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-[#0284C7] text-white shadow-md flex items-center gap-1.5">
                            <Newspaper className="w-3.5 h-3.5" />
                            PRESSE & MÉDIA - ACCRÉDITÉ
                          </span>
                        )}

                        {scanResult.status === 'error' && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase bg-red-600 text-white animate-pulse">
                            BADGE DÉJÀ SCANNÉ
                          </span>
                        )}
                      </div>

                      <h4 className="font-heading font-extrabold text-lg text-white">
                        {scanResult.message}
                      </h4>

                      {/* Détails du badge */}
                      <div className="mt-3 p-3.5 rounded-xl bg-black/40 border border-white/10 space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-400 font-medium">Titulaire :</span>
                          <span className="text-white font-bold">{scanResult.accreditation.holderName}</span>
                        </div>
                        {scanResult.accreditation.organization && (
                          <div className="flex justify-between">
                            <span className="text-gray-400 font-medium">Organisation / Rôle :</span>
                            <span className="text-[#E9C349] font-semibold">{scanResult.accreditation.organization}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-gray-400 font-medium">Téléphone :</span>
                          <span className="text-gray-200 font-mono">{scanResult.accreditation.holderPhone}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400 font-medium">Code Unique :</span>
                          <span className="text-purple-300 font-mono font-bold">{scanResult.accreditation.qrCode}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400 font-medium">Émis par :</span>
                          <span className="text-gray-300 font-medium">
                            {scanResult.accreditation.createdByName || 'Production'} ({scanResult.accreditation.createdByRole || 'promoteur'})
                          </span>
                        </div>
                        {scanResult.accreditation.scannedAt && (
                          <div className="flex justify-between pt-1.5 border-t border-white/10">
                            <span className="text-red-400 font-semibold">Heure du Scan Entrée :</span>
                            <span className="text-red-300 font-bold font-mono">
                              {new Date(scanResult.accreditation.scannedAt).toLocaleTimeString('fr-FR', {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Billet standard ou physique */
                <div className="flex items-start gap-3">
                  {scanResult.status === 'success' ? (
                    <CheckCircle className="w-10 h-10 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-10 h-10 text-red-400 flex-shrink-0 animate-bounce" />
                  )}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                          scanResult.status === 'success'
                            ? 'bg-emerald-500 text-black font-extrabold'
                            : 'bg-red-600 text-white animate-pulse'
                        }`}
                      >
                        {scanResult.status === 'success' ? '✅ ACCÈS AUTORISÉ' : '❌ ACCÈS REFUSÉ'}
                      </span>
                    </div>
                    <h4 className="font-heading font-extrabold text-lg text-white">
                      {scanResult.message}
                    </h4>
                    {scanResult.ticket && (
                      <div className="pt-2 mt-2 border-t border-white/10 space-y-1.5">
                        <p className="font-heading text-2xl sm:text-3xl font-black text-[#E9C349] leading-tight">
                          {scanResult.ticket.holderName?.trim() || 'Nom non renseigné'}
                        </p>
                        <p className="font-mono text-xl sm:text-2xl font-bold text-white">
                          {scanResult.ticket.holderPhone?.trim() || 'Téléphone non renseigné'}
                        </p>
                        <p className="font-mono text-base font-black text-[#B57BFF]">
                          N° {scanResult.ticket.qrCode}
                        </p>
                        <p className="text-xs opacity-85">
                          Événement : {scanResult.ticket.eventTitle} ({scanResult.ticket.tierName})
                        </p>
                        {scanResult.ticket.isPhysical && (
                          <div className="mt-2 pt-2 border-t border-white/10 flex flex-wrap items-center gap-2 text-[11px]">
                            <span className="bg-[#E9C349]/20 text-[#E9C349] font-extrabold px-2 py-0.5 rounded-full border border-[#E9C349]/30">
                              🏷️ Billet Papier Partenaire
                            </span>
                            {scanResult.ticket.agentName && (
                              <span className="text-white font-semibold">
                                Point de vente : {scanResult.ticket.agentName}
                              </span>
                            )}
                            <span className="text-gray-300 font-mono">
                              Souche N° {scanResult.ticket.serialNumber || scanResult.ticket.seatNumber}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Bouton de réinitialisation rapide pour scanner le pass suivant */}
              <div className="mt-4 pt-3 border-t border-white/10 flex justify-end">
                <button
                  type="button"
                  onClick={() => setScanResult({ status: null, message: '' })}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2"
                >
                  <Scan className="w-3.5 h-3.5 text-[#E9C349]" />
                  <span>Scanner le pass suivant</span>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* List of Attendees */
        <div className="space-y-3">
          {tickets.map((tkt) => (
            <div
              key={tkt.id}
              className="glass-panel p-4 rounded-2xl flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <img
                  src={tkt.eventPoster}
                  alt={tkt.eventTitle}
                  className="w-12 h-12 rounded-xl object-cover"
                />
                <div>
                  <h4 className="font-heading font-bold text-sm text-white">
                    {tkt.holderName}
                  </h4>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#DCB8FF]">
                    <span>{tkt.eventTitle} • {tkt.tierName}</span>
                    {tkt.isPhysical && (
                      <span className="bg-[#E9C349]/20 text-[#E9C349] text-[9px] font-extrabold px-1.5 py-0.2 rounded border border-[#E9C349]/30">
                        Papier {tkt.agentName ? `(${tkt.agentName})` : ''}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400 font-mono mt-0.5">{tkt.qrCode}</p>
                </div>
              </div>

              <div className="text-right">
                <span
                  className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full ${
                    tkt.status === 'used'
                      ? 'bg-gray-700 text-gray-300'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {tkt.status === 'used' ? 'Validé' : 'Valide'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
