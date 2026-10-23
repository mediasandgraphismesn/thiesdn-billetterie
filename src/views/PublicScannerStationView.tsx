import React, { useState, useEffect } from 'react';
import {
  Scan,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  Sparkles,
  Newspaper,
  Users,
  RefreshCw,
  Lock,
  Smartphone,
  Check,
  Copy,
} from 'lucide-react';
import { ScanStation } from '../types';
import {
  verifyScanStationAccess,
  scanTicketFromStation,
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

  const [scanResult, setScanResult] = useState<{
    status: 'success' | 'error' | null;
    message: string;
    badgeTheme?: 'staff' | 'invite' | 'presse' | 'vip' | 'standard';
    details?: {
      holderName: string;
      holderPhone?: string;
      tierName: string;
      eventTitle?: string;
      qrCode: string;
      scannedAt?: string;
      isPhysical?: boolean;
      agentName?: string;
    };
  }>({ status: null, message: '' });

  // Sons de feedback simples avec Web Audio API (aucun fichier MP3 requis)
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

  // Chargement et vérification du poste
  const loadStation = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    const res = await verifyScanStationAccess(accessCode);
    if (res.success && res.station) {
      setStation(res.station);
    } else {
      setErrorMessage(res.message);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadStation();
  }, [accessCode]);

  // Traitement d'un scan ou d'une saisie manuelle
  const handleVerify = async (codeToVerify: string) => {
    const trimmed = codeToVerify.trim();
    if (!trimmed || isVerifying || !station) return;

    setIsVerifying(true);
    try {
      const res = await scanTicketFromStation(station.accessCode, trimmed);
      if (res.success && res.ticketDetails) {
        playFeedbackSound('success');
        setScanResult({
          status: 'success',
          message: res.message,
          badgeTheme: res.badgeTheme,
          details: res.ticketDetails,
        });
        // Mettre à jour localement le compteur de scans
        setStation((prev) => (prev ? { ...prev, scansCount: prev.scansCount + 1 } : null));
        setInputCode('');
      } else {
        playFeedbackSound('error');
        setScanResult({
          status: 'error',
          message: res.message,
          badgeTheme: res.badgeTheme,
          details: res.refusedDetails,
        });
      }
    } catch {
      playFeedbackSound('error');
      setScanResult({
        status: 'error',
        message: 'Erreur réseau lors de la validation. Réessayez.',
      });
    } finally {
      setIsVerifying(false);
    }
  };

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
      {/* HEADER FIXE : NOM DU POSTE & STATUT */}
      <header className="sticky top-0 z-20 bg-[#111111]/95 backdrop-blur-md border-b border-white/10 p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-[#E9C349] tracking-wider flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Poste de Contrôle Sécurisé
            </span>
            <h1 className="font-heading text-lg font-black text-white leading-tight">
              {station.name}
            </h1>
            <p className="text-[11px] text-gray-400 truncate max-w-[240px]">
              {station.eventTitle}
            </p>
          </div>

          {/* Compteur de Scans en Direct */}
          <div className="text-right bg-black/50 px-3 py-1.5 rounded-xl border border-white/10">
            <span className="text-[9px] uppercase tracking-wider text-gray-400 font-bold block">
              Entrées
            </span>
            <span className="font-mono text-lg font-black text-emerald-400">
              {station.scansCount}
            </span>
          </div>
        </div>
      </header>

      {/* CONTENU PRINCIPAL */}
      <main className="flex-1 p-4 space-y-4 flex flex-col justify-between pb-8">
        <div className="space-y-4">
          {/* SIMULATEUR VISEUR / ZONE CAMERA */}
          <div className="relative h-60 rounded-3xl overflow-hidden bg-gradient-to-b from-[#181822] via-[#0E0E14] to-[#0A0A0C] border-2 border-[#8A2BE2]/40 flex flex-col items-center justify-center p-6 shadow-2xl">
            {/* Coins Dorés */}
            <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-[#E9C349]" />
            <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-[#E9C349]" />
            <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-[#E9C349]" />
            <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-[#E9C349]" />

            {/* Viseur QR Code animé */}
            <div className="w-40 h-40 border border-[#8A2BE2]/50 rounded-2xl relative flex items-center justify-center">
              <QrCode className="w-24 h-24 text-[#8A2BE2]/40 animate-pulse" />
              <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-[#E9C349] to-transparent shadow-[0_0_12px_#E9C349] animate-bounce" />
            </div>

            <p className="text-[11px] text-[#DCB8FF] mt-3 font-semibold flex items-center gap-1.5">
              <Scan className="w-3.5 h-3.5" /> Pointez le QR Code du visiteur
            </p>
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

            {/* Raccourcis de test sur mobile pour tester immédiatement */}
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

          {/* AFFICHAGE DU RÉSULTAT DU SCAN (ÉCRAN VERT / ÉCRAN ROUGE ANTI-FRAUDE) */}
          {scanResult.status && (
            <div
              className={`p-5 rounded-2xl border-2 animate-in zoom-in-95 duration-200 shadow-2xl ${
                scanResult.status === 'success'
                  ? scanResult.badgeTheme === 'staff'
                    ? 'bg-purple-950/90 border-[#8A2BE2] text-purple-100 shadow-[0_0_25px_rgba(138,43,226,0.4)]'
                    : scanResult.badgeTheme === 'invite'
                    ? 'bg-amber-950/90 border-[#E9C349] text-amber-100 shadow-[0_0_25px_rgba(233,195,73,0.4)]'
                    : scanResult.badgeTheme === 'presse'
                    ? 'bg-sky-950/90 border-sky-500 text-sky-100 shadow-[0_0_25px_rgba(2,132,199,0.4)]'
                    : 'bg-emerald-950/90 border-emerald-500 text-emerald-100 shadow-[0_0_25px_rgba(16,185,129,0.4)]'
                  : 'bg-red-950/90 border-red-500 text-red-100 shadow-[0_0_25px_rgba(239,68,68,0.5)]'
              }`}
            >
              <div className="flex items-start gap-3">
                {scanResult.status === 'success' ? (
                  <CheckCircle2
                    className={`w-10 h-10 shrink-0 ${
                      scanResult.badgeTheme === 'staff'
                        ? 'text-[#8A2BE2]'
                        : scanResult.badgeTheme === 'invite'
                        ? 'text-[#E9C349]'
                        : scanResult.badgeTheme === 'presse'
                        ? 'text-sky-400'
                        : 'text-emerald-400'
                    }`}
                  />
                ) : (
                  <AlertTriangle className="w-10 h-10 text-red-400 shrink-0 animate-bounce" />
                )}

                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        scanResult.status === 'success'
                          ? scanResult.badgeTheme === 'staff'
                            ? 'bg-[#8A2BE2] text-white'
                            : scanResult.badgeTheme === 'invite'
                            ? 'bg-[#E9C349] text-black font-extrabold'
                            : scanResult.badgeTheme === 'presse'
                            ? 'bg-sky-500 text-white'
                            : 'bg-emerald-500 text-black font-extrabold'
                          : 'bg-red-600 text-white animate-pulse'
                      }`}
                    >
                      {scanResult.status === 'success' ? '✅ ACCÈS AUTORISÉ' : '❌ ACCÈS REFUSÉ'}
                    </span>
                  </div>

                  <h3 className="font-heading text-lg font-black leading-tight text-white">
                    {scanResult.message}
                  </h3>

                  {scanResult.details && (
                    <div className="pt-3 mt-3 border-t border-white/10 space-y-2 text-center">
                      <p className="font-heading text-3xl font-black text-[#E9C349] leading-tight break-words">
                        {scanResult.details.holderName?.trim() || 'Nom non renseigné'}
                      </p>
                      <p className="font-mono text-2xl font-bold text-white tracking-wide">
                        {scanResult.details.holderPhone?.trim() || 'Téléphone non renseigné'}
                      </p>
                      <p className="font-mono text-lg font-black text-[#B57BFF]">
                        N° {scanResult.details.qrCode}
                      </p>
                      <p className="text-xs text-gray-300">
                        Catégorie : {scanResult.details.tierName}
                      </p>
                      {scanResult.details.isPhysical && (
                        <p className="text-[#E9C349] font-bold text-[11px]">
                          🏷️ Billet Papier Partenaire {scanResult.details.agentName ? `(${scanResult.details.agentName})` : ''}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* PIED DE PAGE ISOLÉ (AUCUN LIEN ADMIN / AUCUNE FUITE DE SÉCURITÉ) */}
        <footer className="pt-4 border-t border-white/5 text-center space-y-1">
          <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black">
            Thièsdn Billetterie • Sécurité Portes
          </p>
          <p className="text-[9px] text-gray-400 font-mono">
            Poste : {station.name} • Code : {station.accessCode}
          </p>
        </footer>
      </main>
    </div>
  );
};
