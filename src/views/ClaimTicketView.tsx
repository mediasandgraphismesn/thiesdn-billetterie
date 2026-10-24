import React, { useState, useEffect } from 'react';
import {
  Ticket,
  Calendar,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Camera,
  Upload,
  User,
  Phone,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  Gift,
  X,
  Sparkles,
} from 'lucide-react';
import { UserTicket, UserProfile } from '../types';
import { getTicketByClaimToken, claimTicketWithIdentity, declineTicketAssignment } from '../services/supabase';

interface ClaimTicketViewProps {
  claimToken: string;
  currentUser?: UserProfile | null;
  onClaimSuccess: (ticket: UserTicket) => void;
  onNavigateHome: () => void;
}

export const ClaimTicketView: React.FC<ClaimTicketViewProps> = ({
  claimToken,
  currentUser,
  onClaimSuccess,
  onNavigateHome,
}) => {
  const [ticket, setTicket] = useState<UserTicket | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Formulaire d'acceptation
  const [name, setName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isDeclining, setIsDeclining] = useState<boolean>(false);
  const [claimedSuccessTicket, setClaimedSuccessTicket] = useState<UserTicket | null>(null);

  // Chargement du billet via le token
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setErrorMessage(null);

    getTicketByClaimToken(claimToken)
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.ticket) {
          setTicket(res.ticket);
          // Pré-remplir les champs
          setName(currentUser?.name || res.ticket.assignedToName || '');
          setPhone(currentUser?.phone || res.ticket.assignedToPhone || '');
          setAvatarPreview(currentUser?.avatar || res.ticket.assignedToAvatar || null);
        } else {
          setErrorMessage(res.message || 'Ce lien d’invitation est invalide ou expiré.');
        }
      })
      .catch((err) => {
        if (isMounted) setErrorMessage(err.message || 'Erreur réseau');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [claimToken, currentUser]);

  // Gestion du selfie ou de l'upload photo
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket || isSubmitting) return;

    const cleanName = name.trim();
    const cleanPhone = phone.trim();

    if (!cleanName) {
      alert('Veuillez renseigner votre nom complet.');
      return;
    }
    if (!cleanPhone) {
      alert('Veuillez renseigner votre numéro de téléphone.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await claimTicketWithIdentity(
        claimToken,
        cleanName,
        cleanPhone,
        avatarPreview || undefined,
        currentUser?.id
      );

      if (res.success && res.ticket) {
        setClaimedSuccessTicket(res.ticket);
        onClaimSuccess(res.ticket);
      } else {
        alert(res.message || 'Erreur lors de la validation du pass.');
      }
    } catch (err: any) {
      alert(err.message || 'Erreur réseau.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDecline = async () => {
    if (!ticket || isDeclining) return;
    if (!confirm('Êtes-vous sûr de vouloir décliner ce pass ? Il sera restitué à la personne qui vous l’a offert.')) {
      return;
    }

    setIsDeclining(true);
    try {
      await declineTicketAssignment(claimToken);
      alert('Le pass a été restitué.');
      onNavigateHome();
    } catch (err: any) {
      alert(err.message || 'Erreur.');
    } finally {
      setIsDeclining(false);
    }
  };

  // 1. Écran de chargement
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-[#8A2BE2]/20 border border-[#8A2BE2]/40 flex items-center justify-center animate-pulse">
          <RefreshCw className="w-8 h-8 text-[#8A2BE2] animate-spin" />
        </div>
        <p className="font-heading text-lg font-bold text-white">Vérification de votre invitation...</p>
        <p className="text-xs text-gray-400 font-mono">Pass Cadeau Thièsdn</p>
      </div>
    );
  }

  // 2. Écran d'erreur : Billet Invalide ou Expiré
  if (errorMessage || !ticket) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center p-6 text-center space-y-6 max-w-md mx-auto">
        <div className="w-20 h-20 rounded-3xl bg-red-950/80 border-2 border-red-500/60 flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.3)]">
          <AlertTriangle className="w-10 h-10 text-red-400" />
        </div>
        <div className="space-y-2">
          <h2 className="font-heading text-2xl font-black text-white uppercase tracking-tight">
            Invitation Introuvable
          </h2>
          <p className="text-sm text-red-200">
            {errorMessage || 'Ce lien de récupération de pass est invalide ou a déjà été utilisé.'}
          </p>
        </div>
        <button
          onClick={onNavigateHome}
          className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider transition-all"
        >
          Retour à l'accueil
        </button>
      </div>
    );
  }

  // 3. Écran de Succès : Pass Récupéré
  if (claimedSuccessTicket) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center p-6 text-center space-y-6 max-w-md mx-auto animate-in zoom-in-95 duration-200">
        <div className="w-20 h-20 rounded-3xl bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center shadow-[0_0_35px_rgba(16,185,129,0.35)]">
          <CheckCircle2 className="w-12 h-12 text-emerald-400" />
        </div>

        <div className="space-y-2">
          <span className="px-3 py-1 rounded-full bg-emerald-500 text-black text-xs font-black uppercase tracking-wider">
            Pass Activé avec Succès !
          </span>
          <h2 className="font-heading text-2xl font-black text-white">
            Bienvenue, {claimedSuccessTicket.holderName}
          </h2>
          <p className="text-xs text-gray-300">
            Votre billet officiel pour <strong>{claimedSuccessTicket.eventTitle}</strong> est prêt dans votre portefeuille avec votre propre QR Code.
          </p>
        </div>

        {/* Aperçu du Pass Récupéré */}
        <div className="w-full bg-[#1A1A1A] border border-white/10 rounded-2xl p-4 text-left flex items-center gap-3">
          {avatarPreview ? (
            <img
              src={avatarPreview}
              alt={claimedSuccessTicket.holderName}
              className="w-14 h-14 rounded-xl object-cover border-2 border-[#E9C349]"
            />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-[#8A2BE2]/20 border border-[#8A2BE2]/40 flex items-center justify-center">
              <User className="w-6 h-6 text-[#DCB8FF]" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-heading font-black text-sm text-white truncate">
              {claimedSuccessTicket.holderName}
            </p>
            <p className="text-xs text-[#E9C349] font-bold">
              {claimedSuccessTicket.tierName}
            </p>
            <p className="text-[10px] text-gray-400 font-mono">
              N° {claimedSuccessTicket.qrCode}
            </p>
          </div>
        </div>

        <button
          onClick={onNavigateHome}
          className="w-full btn-primary-glow py-3.5 px-6 rounded-xl font-heading font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2"
        >
          <span>Accéder à mon Portefeuille</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // 4. Écran Principal : Formulaire de Réclamation d'Invitation
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col justify-center max-w-lg mx-auto p-4 sm:p-6 select-none animate-in fade-in duration-300">
      <div className="bg-gradient-to-b from-[#221F28] via-[#161616] to-[#121212] border-2 border-[#8A2BE2]/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        
        {/* En-tête Cadeau */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E9C349]/20 border border-[#E9C349]/40 text-[#E9C349] text-xs font-black uppercase tracking-wider">
            <Gift className="w-4 h-4" />
            Billet Offert par un Proche
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl font-black text-white leading-tight">
            Récupérez Votre Pass Officiel
          </h1>
          <p className="text-xs text-gray-300">
            Activez votre place nominative pour accéder directement à l'événement sans attendre l'acheteur.
          </p>
        </div>

        {/* Détails Événement */}
        <div className="relative rounded-2xl overflow-hidden border border-white/10 group">
          <div className="h-40 w-full relative">
            <img
              src={ticket.eventPoster}
              alt={ticket.eventTitle}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
            <div className="absolute bottom-3 inset-x-3">
              <span className="bg-[#E9C349] text-black text-[9px] font-black uppercase px-2 py-0.5 rounded-full inline-block mb-1">
                {ticket.tierName} • {ticket.seatNumber || 'Place Attribuée'}
              </span>
              <h3 className="font-heading font-black text-lg text-white leading-tight">
                {ticket.eventTitle}
              </h3>
              <p className="text-[11px] text-gray-300 flex items-center gap-2 mt-0.5">
                <Calendar className="w-3 h-3 text-[#DCB8FF]" />
                {ticket.eventDate} à {ticket.eventTime}
              </p>
            </div>
          </div>
        </div>

        {/* Formulaire de Personnalisation */}
        <form onSubmit={handleClaimSubmit} className="space-y-4">
          <div className="bg-white/5 border border-white/5 rounded-2xl p-4 space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#E9C349] block">
              Contrôle d'Accès Sécurisé • Identité du Titulaire
            </span>

            {/* Photo / Selfie */}
            <div className="flex items-center gap-4 pt-1">
              <div className="relative">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Aperçu photo"
                    className="w-20 h-20 rounded-2xl object-cover border-2 border-[#E9C349] shadow-lg"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-[#1A1A1A] border-2 border-dashed border-white/20 flex flex-col items-center justify-center text-gray-400">
                    <User className="w-7 h-7 text-gray-400" />
                    <span className="text-[8px] uppercase mt-0.5">Photo</span>
                  </div>
                )}

                <label
                  htmlFor="claim-photo-input"
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#8A2BE2] hover:bg-[#7822c9] text-white flex items-center justify-center cursor-pointer shadow-md transition-all active:scale-95"
                  title="Prendre un selfie ou choisir une photo"
                >
                  <Camera className="w-3.5 h-3.5" />
                </label>
                <input
                  type="file"
                  id="claim-photo-input"
                  accept="image/*"
                  capture="user"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </div>

              <div className="flex-1">
                <p className="text-xs font-bold text-white">Votre Photo de Profil (Selfie)</p>
                <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">
                  Elle apparaîtra sur l'écran du vigile lors du scan pour valider votre entrée sans équivoque.
                </p>
                <label
                  htmlFor="claim-photo-input"
                  className="text-xs text-[#DCB8FF] hover:underline font-semibold cursor-pointer inline-flex items-center gap-1 mt-1"
                >
                  <Upload className="w-3 h-3" />
                  <span>Prendre un selfie ou choisir une image</span>
                </label>
              </div>
            </div>

            {/* Nom */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-300 block mb-1">
                Votre Nom Complet <span className="text-[#E9C349]">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Moussa Ndiaye"
                className="w-full bg-[#161616] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#8A2BE2]"
              />
            </div>

            {/* Téléphone */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-300 block mb-1">
                Votre Numéro de Téléphone <span className="text-[#E9C349]">*</span>
              </label>
              <input
                type="tel"
                required
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ex: 77 123 45 67"
                className="w-full bg-[#161616] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-[#8A2BE2]"
              />
            </div>
          </div>

          {/* Boutons d'Action */}
          <div className="space-y-2 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full btn-primary-glow py-3.5 px-4 rounded-xl font-heading font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Activation du billet en cours...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Accepter et Ajouter à Mon Portefeuille</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDecline}
              disabled={isDeclining}
              className="w-full py-2.5 rounded-xl bg-transparent hover:bg-white/5 text-gray-400 hover:text-white text-xs font-bold transition-colors"
            >
              {isDeclining ? 'Restitution en cours...' : 'Décliner ce cadeau'}
            </button>
          </div>
        </form>

        <p className="text-[10px] text-gray-400 text-center font-mono">
          Thièsdn Billetterie • Sécurité Anti-Fraude & Nominativité Certifiée
        </p>
      </div>
    </div>
  );
};
