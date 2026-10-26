import React, { useState, useEffect, useRef } from 'react';
import {
  Scan,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  RefreshCw,
  Lock,
  Wifi,
  WifiOff,
  RotateCcw,
  Clock,
  UserCheck,
  Phone,
  Ticket,
  ArrowRight,
  Camera,
  CameraOff,
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { ScanStation } from '../types';
import {
  verifyScanStationAccess,
  scanTicketFromStation,
  preloadStationTicketsCache,
  syncOfflineScansToSupabase,
  getOfflineScanQueue,
  StationScanResult,
  getStoredTickets,
  getStoredAccreditations,
} from '../services/supabase';

interface PublicScannerStationViewProps {
  accessCode: string;
}

export const PublicScannerStationView: React.FC<PublicScannerStationViewProps> = ({
  accessCode,
}) => {
  const [station, setStation] = useState<ScanStation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [inputCode, setInputCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Caméra arrière & Scanner Html5Qrcode
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScannedRef = useRef<{ code: string; timestamp: number }>({ code: '', timestamp: 0 });

  // Connectivité réseau & synchronisation hors-ligne
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [cacheTicketsCount, setCacheTicketsCount] = useState<number>(0);

  const [scanResult, setScanResult] = useState<StationScanResult | null>(null);

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
      // AudioContext non disponible ou bloqué
    }
  };

  // Synchronisation des scans hors-ligne vers Supabase
  const handleSyncOfflineScans = async () => {
    if (isSyncing || !accessCode) return;
    setIsSyncing(true);
    try {
      await syncOfflineScansToSupabase(accessCode);
      const queue = getOfflineScanQueue();
      setPendingSyncCount(queue.length);
    } catch (e) {
      console.warn('Erreur lors de la synchronisation hors-ligne:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  // Chargement et vérification du poste + préchargement du cache hors-ligne
  const loadStation = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    const res = await verifyScanStationAccess(accessCode);
    if (res.success && res.station) {
      setStation(res.station);

      // Pré-chargement des billets de l'événement dans le cache local (mode hors-ligne)
      try {
        const preloadRes = await preloadStationTicketsCache(accessCode);
        setCacheTicketsCount(preloadRes.count);
      } catch (err) {
        console.warn('Préchargement cache billets:', err);
      }

      // Vérifier les éventuels scans hors-ligne en attente
      const queue = getOfflineScanQueue();
      setPendingSyncCount(queue.length);

      // Si en ligne et scans en attente, lancer la synchro
      if (typeof navigator !== 'undefined' && navigator.onLine && queue.length > 0) {
        syncOfflineScansToSupabase(accessCode).then(() => {
          setPendingSyncCount(getOfflineScanQueue().length);
        });
      }
    } else {
      setErrorMessage(res.message);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadStation();

    const handleOnlineStatus = () => {
      setIsOnline(true);
      handleSyncOfflineScans();
    };

    const handleOfflineStatus = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOfflineStatus);

    return () => {
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOfflineStatus);
    };
  }, [accessCode]);

  // Traitement d'un scan ou d'une saisie manuelle
  const handleVerify = async (codeToVerify: string) => {
    const trimmed = codeToVerify.trim();
    if (!trimmed || isVerifying || !station) return;

    setIsVerifying(true);
    try {
      const res = await scanTicketFromStation(station.accessCode, trimmed);
      setScanResult(res);

      if (res.success) {
        playFeedbackSound('success');
        setStation((prev) => (prev ? { ...prev, scansCount: prev.scansCount + 1 } : null));
        setInputCode('');
      } else {
        playFeedbackSound('error');
      }

      // Mettre à jour le compteur de la file d'attente hors-ligne si besoin
      const queue = getOfflineScanQueue();
      setPendingSyncCount(queue.length);
    } catch {
      playFeedbackSound('error');
      setScanResult({
        success: false,
        reason: 'not_found',
        message: 'Erreur réseau lors de la validation. Réessayez.',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // Réarmer pour le billet suivant
  const handleResetForNext = () => {
    setScanResult(null);
    setInputCode('');
  };

  // Démarrage & cycle de vie du lecteur caméra Html5Qrcode
  useEffect(() => {
    let isMounted = true;
    const scannerElementId = 'qr-reader';

    const startCamera = async () => {
      // Petite attente pour garantir le montage effectif du conteneur DOM
      await new Promise((r) => setTimeout(r, 120));
      if (!isMounted) return;

      const element = document.getElementById(scannerElementId);
      if (!element) return;

      // Nettoyer toute instance active préalable
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
            handleVerify(decodedText);
          },
          () => {
            // Frames vides ignorées pendant la recherche
          }
        );

        if (isMounted) {
          setIsCameraActive(true);
        }
      } catch (err: any) {
        console.warn('Erreur activation caméra poste public:', err);
        if (isMounted) {
          setIsCameraActive(false);
          setCameraError(
            err?.message ||
              "Impossible d'activer la caméra arrière. Vérifiez les autorisations de votre navigateur ou utilisez la saisie manuelle."
          );
        }
      }
    };

    if (station) {
      startCamera();
    }

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
  }, [station?.accessCode]);

  // 1. Écran de chargement
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-[#8A2BE2]/20 border border-[#8A2BE2]/40 flex items-center justify-center animate-pulse">
          <RefreshCw className="w-8 h-8 text-[#8A2BE2] animate-spin" />
        </div>
        <p className="font-heading text-lg font-bold text-white">Connexion au Poste de Contrôle...</p>
        <p className="text-xs text-gray-400 font-mono">Code poste : {accessCode}</p>
      </div>
    );
  }

  // 2. Écran d'erreur : Poste Invalide ou Désactivé
  if (errorMessage || !station) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center p-6 text-center space-y-6">
        <div className="w-20 h-20 rounded-3xl bg-red-950/80 border-2 border-red-500/60 flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.3)]">
          <Lock className="w-10 h-10 text-red-400" />
        </div>
        <div className="space-y-2 max-w-sm">
          <h2 className="font-heading text-2xl font-black text-white uppercase tracking-tight">
            Accès Refusé
          </h2>
          <p className="text-sm text-red-200">
            {errorMessage || 'Ce poste de contrôle est inactif ou n’existe pas.'}
          </p>
          <p className="text-xs text-gray-500 pt-2">
            Demandez un nouveau lien ou la réactivation du poste auprès du promoteur ou de la régie.
          </p>
        </div>
        <button
          onClick={loadStation}
          className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase transition-all flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> Réessayer
        </button>
      </div>
    );
  }

  // Obtenir quelques billets et accréditations pour raccourcis de test rapide sur mobile
  const sampleTickets = getStoredTickets().filter((t) => t.status !== 'used').slice(0, 3);
  const sampleAccreds = getStoredAccreditations().filter((a) => a.status === 'validated').slice(0, 2);

  // 3. Écran Principal du Scanner Mobile Autonome
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col max-w-md mx-auto relative select-none">
      {/* HEADER FIXE : NOM DU POSTE & STATUT RÉSEAU */}
      <header className="sticky top-0 z-20 bg-[#111111]/95 backdrop-blur-md border-b border-white/10 p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase text-[#E9C349] tracking-wider flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Poste de Contrôle Sécurisé
              </span>

              {/* Pastille Connectivité Réseau */}
              {isOnline ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-bold">
                  <Wifi className="w-2.5 h-2.5 text-emerald-400" />
                  En Ligne
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-bold animate-pulse">
                  <WifiOff className="w-2.5 h-2.5 text-amber-400" />
                  Hors-Ligne
                </span>
              )}
            </div>

            <h1 className="font-heading text-lg font-black text-white leading-tight mt-0.5">
              {station.name}
            </h1>
            <p className="text-[11px] text-gray-400 truncate max-w-[240px] flex items-center gap-1.5">
              <span>{station.eventTitle}</span>
              <span className="text-[9px] text-[#DCB8FF] font-bold bg-[#8A2BE2]/20 px-1.5 py-0.2 rounded">
                24h/24
              </span>
            </p>
          </div>

          {/* Compteur de Scans en Direct & File Synchro */}
          <div className="flex items-center gap-2">
            {pendingSyncCount > 0 && (
              <button
                onClick={handleSyncOfflineScans}
                disabled={isSyncing || !isOnline}
                title="Synchroniser les scans hors-ligne avec Supabase"
                className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 px-2 py-1.5 rounded-xl text-[10px] font-black flex items-center gap-1 transition-all"
              >
                <RotateCcw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                {pendingSyncCount} en attente
              </button>
            )}

            <div className="text-right bg-black/50 px-3 py-1.5 rounded-xl border border-white/10">
              <span className="text-[9px] uppercase tracking-wider text-gray-400 font-bold block">
                Entrées
              </span>
              <span className="font-mono text-lg font-black text-emerald-400">
                {station.scansCount}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* CONTENU PRINCIPAL */}
      <main className="flex-1 p-4 space-y-4 flex flex-col justify-between pb-8">
        <div className="space-y-4">
          {/* ZONE CAMERA & VISEUR TEMPS RÉEL (HTML5QRCODE) */}
          <div className="relative h-64 sm:h-72 rounded-3xl overflow-hidden bg-black border-2 border-[#8A2BE2]/50 flex flex-col items-center justify-center shadow-2xl">
            {/* Conteneur DOM où html5-qrcode injecte le stream <video> */}
            <div
              id="qr-reader"
              className="absolute inset-0 w-full h-full [&>video]:w-full [&>video]:h-full [&>video]:object-cover"
            />

            {/* Overlay d'attente ou d'erreur caméra */}
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
            <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-[#E9C349] pointer-events-none z-10" />
            <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-[#E9C349] pointer-events-none z-10" />
            <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-[#E9C349] pointer-events-none z-10" />
            <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-[#E9C349] pointer-events-none z-10" />

            {/* Viseur & ligne laser animée */}
            <div className="w-44 h-44 border border-[#8A2BE2]/60 rounded-2xl relative flex items-center justify-center pointer-events-none z-10 shadow-[0_0_15px_rgba(138,43,226,0.3)]">
              {isCameraActive ? (
                <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-[#E9C349] to-transparent shadow-[0_0_12px_#E9C349] animate-bounce" />
              ) : (
                <QrCode className="w-20 h-20 text-[#8A2BE2]/30 animate-pulse" />
              )}
            </div>

            {/* Pastille Statut Caméra */}
            <div className="absolute bottom-3 inset-x-4 z-10 flex items-center justify-center pointer-events-none">
              <span className="px-3 py-1 rounded-full bg-black/75 backdrop-blur-md border border-white/10 text-[10px] font-semibold text-[#DCB8FF] flex items-center gap-1.5 shadow-lg">
                <span className={`w-2 h-2 rounded-full ${isCameraActive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                <span>{isCameraActive ? 'Caméra Arrière Active • Visez le QR code' : 'Caméra en attente'}</span>
              </span>
            </div>
          </div>

          {/* FORMULAIRE DE SAISIE RAPIDE (MANUELLE OU DOUCHETTE SCANNER) */}
          <div className="glass-panel p-4 rounded-2xl border border-white/10 space-y-2.5 shadow-xl">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
              Saisie du Code Pass / Billet
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleVerify(inputCode);
                }}
                placeholder="Ex: THIESDN-... ou ACC-..."
                className="flex-1 bg-[#161616] border border-white/10 rounded-xl px-3.5 py-3 text-sm text-white font-mono focus:outline-none focus:border-[#8A2BE2]"
              />
              <button
                onClick={() => handleVerify(inputCode)}
                disabled={isVerifying || !inputCode.trim()}
                className="btn-primary-glow px-4 rounded-xl font-heading font-black text-xs uppercase tracking-wider disabled:opacity-50"
              >
                {isVerifying ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  'Scanner'
                )}
              </button>
            </div>

            {/* Raccourcis de test sur mobile pour validation immédiate */}
            <div className="pt-2 border-t border-white/5 space-y-2">
              <div>
                <p className="text-[9px] text-amber-300 uppercase font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-amber-400" />
                  Tests Règle Validation par Vente :
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setInputCode('BPT-PHY-THS-UNSOLD');
                      handleVerify('BPT-PHY-THS-UNSOLD');
                    }}
                    title="Billet imprimé non vendu : doit afficher un écran rouge"
                    className="px-2 py-0.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-[10px] text-rose-300 border border-rose-500/40 font-mono"
                  >
                    Non Vendu (Refus)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setInputCode('BPT-PHY-THS-SOLDOK');
                      handleVerify('BPT-PHY-THS-SOLDOK');
                    }}
                    title="Billet vendu par collaborateur : doit afficher un écran vert"
                    className="px-2 py-0.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-[10px] text-emerald-300 border border-emerald-500/40 font-mono"
                  >
                    Vendu (Autorisé)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setInputCode('BPT-PHY-THS-SCANNED');
                      handleVerify('BPT-PHY-THS-SCANNED');
                    }}
                    title="Billet déjà scanné : doit afficher un écran rouge"
                    className="px-2 py-0.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-[10px] text-amber-200 border border-amber-500/40 font-mono"
                  >
                    Déjà Scanné
                  </button>
                </div>
              </div>

              <div>
                <p className="text-[9px] text-gray-400 uppercase font-bold">
                  Autres Pass (Digitaux & Accréditations) :
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {sampleTickets.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setInputCode(t.qrCode);
                        handleVerify(t.qrCode);
                      }}
                      className="px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] text-purple-200 border border-white/5 font-mono"
                    >
                      {t.holderName} ({t.tierName})
                    </button>
                  ))}
                  {sampleAccreds.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => {
                        setInputCode(a.qrCode);
                        handleVerify(a.qrCode);
                      }}
                      className="px-2 py-0.5 rounded-lg bg-[#E9C349]/20 hover:bg-[#E9C349]/30 text-[10px] text-amber-200 border border-[#E9C349]/30 font-mono"
                    >
                      {a.type.toUpperCase()}: {a.holderName}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ==================================================================== */}
          {/* AFFICHAGE DU RÉSULTAT DU SCAN EN GRAND ET EN HAUTE VISIBILITÉ        */}
          {/* ==================================================================== */}
          {scanResult && (
            <div
              className={`rounded-3xl border-4 p-6 animate-in zoom-in-95 duration-200 shadow-2xl space-y-4 ${
                scanResult.success
                  ? 'bg-[#052E16] border-emerald-400 text-white shadow-[0_0_40px_rgba(16,185,129,0.45)]'
                  : 'bg-[#450A0A] border-red-500 text-white shadow-[0_0_40px_rgba(239,68,68,0.55)]'
              }`}
            >
              {/* CAS 1 : SUCCÈS -> ÉCRAN VERT XXL AVEC ACCÈS AUTORISÉ + NOM + TÉLÉPHONE */}
              {scanResult.success ? (
                <div className="space-y-4 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center">
                      <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                    </div>
                    <span className="px-4 py-1 rounded-full bg-emerald-500 text-black font-black text-sm uppercase tracking-widest">
                      ✅ ACCÈS AUTORISÉ
                    </span>
                    {scanResult.offlineValidated && (
                      <span className="text-[10px] uppercase font-bold text-emerald-300/80 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                        ⚡ Contrôle Validé Hors-Ligne (Enregistré localement)
                      </span>
                    )}
                  </div>

                  {/* IDENTITÉ DU TITULAIRE EN TRÈS GRAND POUR CONTRÔLE VISUEL */}
                  {scanResult.ticketDetails && (
                    <div className="bg-black/40 border border-emerald-500/30 rounded-2xl p-4 space-y-3">
                      {/* Photo / Selfie du titulaire pour contrôle facial immédiat */}
                      {scanResult.ticketDetails.holderAvatar && (
                        <div className="flex justify-center pb-1">
                          <img
                            src={scanResult.ticketDetails.holderAvatar}
                            alt={scanResult.ticketDetails.holderName}
                            className="w-24 h-24 rounded-2xl object-cover border-4 border-[#FACC15] shadow-xl"
                          />
                        </div>
                      )}

                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-300 block mb-1">
                          Nom du Titulaire
                        </span>
                        <p className="font-heading text-3xl sm:text-4xl font-black text-[#FACC15] leading-tight break-words drop-shadow">
                          {scanResult.ticketDetails.holderName?.trim() || 'Nom non renseigné'}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-emerald-500/20">
                        <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-300 block mb-1">
                          Numéro de Téléphone
                        </span>
                        <p className="font-mono text-2xl font-black text-white tracking-widest">
                          {scanResult.ticketDetails.holderPhone?.trim() || 'Téléphone non renseigné'}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-emerald-500/20 flex items-center justify-between text-xs text-emerald-200">
                        <span>Formule : <strong>{scanResult.ticketDetails.tierName}</strong></span>
                        <span className="font-mono font-bold">N° {scanResult.ticketDetails.qrCode}</span>
                      </div>

                      {scanResult.ticketDetails.isPhysical && (
                        <p className="text-[#FACC15] font-bold text-[11px]">
                          🏷️ Billet Papier Partenaire {scanResult.ticketDetails.agentName ? `(${scanResult.ticketDetails.agentName})` : ''}
                        </p>
                      )}
                    </div>
                  )}

                  {/* BOUTON PASSER AU SUIVANT */}
                  <button
                    onClick={handleResetForNext}
                    className="w-full py-3.5 px-4 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-black font-heading font-black text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg"
                  >
                    Scanner le Billet Suivant <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                /* CAS 2 : REFUS -> ÉCRAN ROUGE XXL SELON LA RAISON (DÉJÀ UTILISÉ, NON VENDU, FAUX) */
                <div className="space-y-4 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-16 h-16 rounded-2xl bg-red-500/20 border-2 border-red-500 flex items-center justify-center animate-pulse">
                      <AlertTriangle className="w-10 h-10 text-red-400" />
                    </div>

                    {/* TITRE EXPLICITE EN GRAND */}
                    {scanResult.reason === 'already_scanned' ? (
                      <span className="px-4 py-1.5 rounded-full bg-red-600 text-white font-black text-base uppercase tracking-wider animate-bounce">
                        ❌ BILLET DÉJÀ UTILISÉ
                      </span>
                    ) : scanResult.reason === 'printed_not_sold' ? (
                      <span className="px-4 py-1.5 rounded-full bg-red-600 text-white font-black text-base uppercase tracking-wider animate-bounce">
                        ❌ BILLET NON DÉCLARÉ VENDU
                      </span>
                    ) : (
                      <span className="px-4 py-1.5 rounded-full bg-red-600 text-white font-black text-base uppercase tracking-wider">
                        ❌ ACCÈS STRICTEMENT REFUSÉ
                      </span>
                    )}
                  </div>

                  {/* HORODATAGE DU SCAN PRÉCÉDENT SI BILLET DÉJÀ UTILISÉ */}
                  {scanResult.reason === 'already_scanned' && (
                    <div className="bg-red-950/80 border-2 border-red-500/60 rounded-2xl p-3 inline-block mx-auto">
                      <p className="font-mono text-base font-black text-red-200 flex items-center justify-center gap-2">
                        <Clock className="w-5 h-5 text-red-400 shrink-0" />
                        Scanné à {scanResult.scannedAtFormatted || scanResult.refusedDetails?.scannedAtFormatted || 'heure inconnue'}
                      </p>
                    </div>
                  )}

                  {/* MESSAGE EXPLICATIF */}
                  <p className="text-sm font-bold text-red-200 px-2">
                    {scanResult.message}
                  </p>

                  {/* IDENTITÉ DU TITULAIRE INITIAL POUR CONTRÔLE VISUEL DE LA FRAUDE */}
                  {scanResult.refusedDetails && (
                    <div className="bg-black/40 border border-red-500/30 rounded-2xl p-4 space-y-2 text-left">
                      {scanResult.refusedDetails.holderAvatar && (
                        <div className="flex justify-center pb-2 border-b border-red-500/20">
                          <img
                            src={scanResult.refusedDetails.holderAvatar}
                            alt={scanResult.refusedDetails.holderName}
                            className="w-20 h-20 rounded-2xl object-cover border-2 border-red-500 shadow-md"
                          />
                        </div>
                      )}
                      <p className="text-[10px] uppercase font-bold text-red-300/80 tracking-wider">
                        Contrôle Identité du Porteur Déclaré :
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-300">Nom :</span>
                        <span className="font-heading font-black text-lg text-[#FACC15]">
                          {scanResult.refusedDetails.holderName?.trim() || 'Nom non renseigné'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-300">Téléphone :</span>
                        <span className="font-mono font-bold text-base text-white">
                          {scanResult.refusedDetails.holderPhone?.trim() || 'Téléphone non renseigné'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-400 pt-1 border-t border-white/10 font-mono">
                        <span>Billet : {scanResult.refusedDetails.qrCode}</span>
                        <span>{scanResult.refusedDetails.tierName}</span>
                      </div>
                    </div>
                  )}

                  {/* BOUTON RÉESSAYER / SUIVANT */}
                  <button
                    onClick={handleResetForNext}
                    className="w-full py-3.5 px-4 rounded-xl bg-white/20 hover:bg-white/30 text-white font-heading font-black text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" /> Scanner un Autre Billet
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* PIED DE PAGE ISOLÉ (AUCUN LIEN ADMIN / AUCUNE FUITE DE SÉCURITÉ) */}
        <footer className="pt-4 border-t border-white/5 text-center space-y-1">
          <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black">
            Thièsdn Billetterie • Sécurité Portes
          </p>
          <p className="text-[9px] text-gray-400 font-mono">
            Poste : {station.name} • Code : {station.accessCode} • Cache billets : {cacheTicketsCount}
          </p>
        </footer>
      </main>
    </div>
  );
};
