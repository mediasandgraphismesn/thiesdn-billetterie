import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Camera,
  Edit3,
  CheckCircle2,
  LogOut,
  Crown,
  Ticket,
  ExternalLink,
  AlertCircle,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  ChevronRight,
  X,
  Send,
  ShieldCheck,
  Loader2,
  Upload,
} from 'lucide-react';
import { UserProfile, UserTicket } from '../types';
import { getSupabaseClient, uploadAvatarToSupabase, updateUserProfileInSupabase } from '../services/supabase';
import { THIES_33_QUARTIERS, THIES_QUARTIERS_BY_ZONE } from '../data/thiesQuartiers';

interface ProfileViewProps {
  user: UserProfile;
  tickets: UserTicket[];
  onUpdateProfile: (updated: Partial<UserProfile>) => void;
  onOpenTicketPass: (ticket: UserTicket) => void;
  onSignOut: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  tickets,
  onUpdateProfile,
  onOpenTicketPass,
  onSignOut,
}) => {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone);
  const [city, setCity] = useState(user.city || 'Thiès');
  const [address, setAddress] = useState(user.address);
  const [quartier, setQuartier] = useState(user.quartier || 'Grand Standing');
  const [privacySettings, setPrivacySettings] = useState(user.privacySettings);
  const [isEditing, setIsEditing] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => {
    setName(user.name);
    setEmail(user.email);
    setPhone(user.phone);
    setCity(user.city || 'Thiès');
    setAddress(user.address);
    setQuartier(user.quartier || 'Grand Standing');
    setPrivacySettings(user.privacySettings);
  }, [user]);

  // Gestion de la photo de profil (Upload Supabase Storage)
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarSuccess, setAvatarSuccess] = useState<string | null>(null);

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarError(null);
    setAvatarSuccess(null);

    // 1. Validation du format
    if (!file.type.startsWith('image/')) {
      setAvatarError('Format non supporté. Veuillez sélectionner une image (JPG, PNG, WebP).');
      return;
    }

    // 2. Validation de la taille (2 Mo maximum)
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError('La taille de l\'image ne doit pas dépasser 2 Mo.');
      return;
    }

    // 3. Téléchargement vers Supabase Storage & Mise à jour de la table profiles
    setUploadingAvatar(true);
    try {
      const res = await uploadAvatarToSupabase(user.id, file);
      if (res.success && res.avatarUrl) {
        onUpdateProfile({ avatar: res.avatarUrl });
        setAvatarSuccess('Photo de profil mise à jour avec succès !');
        setTimeout(() => setAvatarSuccess(null), 3500);
      } else {
        setAvatarError(res.error || 'Erreur lors du téléchargement de la photo.');
      }
    } catch (err: any) {
      setAvatarError(err.message || 'Erreur lors de la mise à jour de la photo.');
    } finally {
      setUploadingAvatar(false);
      if (e.target) e.target.value = '';
    }
  };

  // Gestion du changement de mot de passe
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  const handleSaveProfile = async () => {
    const updatedData: Partial<UserProfile> = {
      name,
      email,
      phone,
      city,
      address,
      quartier,
      privacySettings,
    };
    onUpdateProfile(updatedData);
    if (user.id) {
      await updateUserProfileInSupabase(user.id, updatedData);
    }
    setIsEditing(false);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2500);
  };

  const handleCancelEdit = () => {
    setName(user.name);
    setEmail(user.email);
    setPhone(user.phone);
    setCity(user.city || 'Thiès');
    setAddress(user.address);
    setQuartier(user.quartier || 'Grand Standing');
    setIsEditing(false);
  };

  const togglePrivacy = (key: 'publicProfile' | 'biometricLogin') => {
    const updated = {
      ...privacySettings,
      [key]: !privacySettings[key],
    };
    setPrivacySettings(updated);
    onUpdateProfile({ privacySettings: updated });
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword.length < 6) {
      setPasswordError('Le nouveau mot de passe doit comporter au moins 6 caractères.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Les mots de passe ne correspondent pas.');
      return;
    }

    setPasswordLoading(true);
    const client = getSupabaseClient();

    if (client) {
      try {
        const { error } = await client.auth.updateUser({ password: newPassword });
        if (error) throw error;
        setPasswordSuccess('Votre mot de passe a été modifié avec succès !');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          setShowPasswordModal(false);
          setPasswordSuccess(null);
        }, 2000);
      } catch (err: any) {
        setPasswordError(err.message || 'Erreur lors de la mise à jour du mot de passe.');
      } finally {
        setPasswordLoading(false);
      }
    } else {
      // Simulation locale sans Supabase
      setTimeout(() => {
        setPasswordLoading(false);
        setPasswordSuccess('Mot de passe mis à jour (Mode local) !');
        setTimeout(() => {
          setShowPasswordModal(false);
          setPasswordSuccess(null);
        }, 1500);
      }, 600);
    }
  };

  const handleSendResetEmail = async () => {
    if (!user.email) {
      setPasswordError('Aucune adresse email associée à ce compte.');
      return;
    }
    setPasswordLoading(true);
    setPasswordError(null);

    const client = getSupabaseClient();
    if (client) {
      try {
        const { error } = await client.auth.resetPasswordForEmail(user.email, {
          redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/` : undefined,
        });
        if (error) throw error;
        setResetEmailSent(true);
        setPasswordSuccess(`Un email de réinitialisation a été envoyé à ${user.email}.`);
      } catch (err: any) {
        setPasswordError(err.message || 'Impossible d\'envoyer l\'email pour le moment.');
      } finally {
        setPasswordLoading(false);
      }
    } else {
      setTimeout(() => {
        setPasswordLoading(false);
        setResetEmailSent(true);
        setPasswordSuccess(`Email de réinitialisation simulé pour ${user.email}.`);
      }, 500);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-in fade-in duration-300">
      {savedToast && (
        <div className="fixed top-20 right-6 z-50 p-4 rounded-2xl bg-[#1C1B1B] border border-emerald-500 shadow-2xl text-white flex items-center gap-3 animate-in slide-in-from-top-4 duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-semibold">Profil mis à jour avec succès !</span>
        </div>
      )}

      {avatarSuccess && (
        <div className="fixed top-20 right-6 z-50 p-4 rounded-2xl bg-[#1C1B1B] border border-emerald-500 shadow-2xl text-white flex items-center gap-3 animate-in slide-in-from-top-4 duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-semibold">{avatarSuccess}</span>
        </div>
      )}

      {avatarError && (
        <div className="fixed top-20 right-6 z-50 p-4 rounded-2xl bg-[#1C1B1B] border border-rose-500 shadow-2xl text-rose-300 flex items-center gap-3 animate-in slide-in-from-top-4 duration-300">
          <AlertCircle className="w-5 h-5 text-rose-400" />
          <span className="text-sm font-semibold">{avatarError}</span>
        </div>
      )}

      {/* Input File invisible pour appareil photo sur mobile / explorateur sur PC */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleAvatarFileChange}
        className="hidden"
      />

      {/* Profile Header Bento matching Image 16 / 18 */}
      <section className="glass-panel rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-center md:items-start gap-6 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-48 h-48 bg-[#8A2BE2]/15 rounded-full blur-3xl pointer-events-none" />

        {/* Avatar cliquable avec sélecteur de fichier et effet hover */}
        <div
          onClick={() => !uploadingAvatar && fileInputRef.current?.click()}
          className="relative group cursor-pointer flex-shrink-0"
          title="Cliquez pour changer votre photo de profil"
        >
          <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden border-2 border-[#8A2BE2] group-hover:border-[#E9C349] shadow-[0_0_25px_rgba(138,43,226,0.4)] group-hover:shadow-[0_0_30px_rgba(233,195,73,0.5)] transition-all relative">
            <img
              src={user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600&auto=format&fit=crop'}
              alt={user.name}
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600&auto=format&fit=crop';
              }}
              className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${
                uploadingAvatar ? 'opacity-30 blur-sm' : 'opacity-100'
              }`}
            />

            {/* Overlay au survol */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-1">
              <Camera className="w-6 h-6 text-[#E9C349]" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-200">
                Modifier
              </span>
            </div>

            {/* Spinner pendant l'upload */}
            {uploadingAvatar && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 z-20 text-white gap-1.5">
                <Loader2 className="w-7 h-7 text-[#E9C349] animate-spin" />
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#E9C349]">
                  Envoi...
                </span>
              </div>
            )}
          </div>

          {/* Bouton Badge Caméra en bas à droite */}
          <button
            type="button"
            disabled={uploadingAvatar}
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="absolute bottom-0 right-0 bg-[#8A2BE2] hover:bg-[#7822c9] text-white p-2.5 rounded-full shadow-lg border-2 border-[#0A0A0A] transition-all hover:scale-110 active:scale-95 disabled:opacity-50 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
            title="Modifier la photo"
          >
            {uploadingAvatar ? (
              <Loader2 className="w-4 h-4 animate-spin text-[#E9C349]" />
            ) : (
              <Camera className="w-4 h-4 text-white" />
            )}
          </button>
        </div>

        {/* User Info */}
        <div className="flex-1 text-center md:text-left space-y-2 z-10">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
            <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {user.name && user.name.toLowerCase() !== 'visiteur' ? user.name : 'Mon Espace Client'}
            </h2>
            {user.isVip && (
              <span className="bg-[#E9C349] text-[#241A00] font-extrabold text-xs px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                <Crown className="w-3 h-3" /> Membre VIP
              </span>
            )}
            {user.isEmailConfirmed ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                Email Vérifié
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                <AlertCircle className="w-3 h-3 text-amber-400" />
                Email Non Confirmé
              </span>
            )}
          </div>
          <div className="text-sm text-[#CFC2D7] font-medium flex flex-wrap items-center justify-center md:justify-start gap-1.5 sm:gap-2">
            <span className="break-all">{user.email || 'Client Thièsdn Billetterie'}</span>
            <span className="text-gray-500 hidden sm:inline">•</span>
            <span className="text-[#E9C349] font-bold uppercase text-xs px-2 py-0.5 rounded-md bg-[#E9C349]/10 border border-[#E9C349]/30">
              {user.role === 'admin' ? 'Administrateur' : user.role === 'promoter' ? 'Promoteur Officiel' : 'Espace Client'}
            </span>
          </div>

          {/* Action buttons : Suppression Share Profile + Traduction */}
          <div className="pt-3 flex flex-wrap justify-center md:justify-start gap-3">
            {isEditing ? (
              <>
                <button
                  onClick={handleSaveProfile}
                  className="btn-primary-glow px-6 py-2.5 rounded-xl text-xs font-heading font-extrabold tracking-wider uppercase flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Enregistrer les Modifications</span>
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="px-5 py-2.5 rounded-xl border border-white/20 hover:border-white/40 text-gray-300 hover:text-white text-xs font-heading font-extrabold tracking-wider uppercase bg-[#1C1B1B] hover:bg-[#2A2A2A] transition-all"
                >
                  Annuler
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="btn-primary-glow px-6 py-2.5 rounded-xl text-xs font-heading font-extrabold tracking-wider uppercase flex items-center gap-2"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Modifier mon profil</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Grid: Personal Info & Connected Accounts / Privacy */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Personal Information */}
        <section className="glass-panel rounded-3xl p-6 space-y-4">
          <h3 className="font-heading font-bold text-base text-[#E9C349] border-b border-white/10 pb-3 flex items-center justify-between">
            <span>Informations Personnelles</span>
            {isEditing && (
              <span className="text-[11px] text-[#DCB8FF] font-normal">Mode édition actif</span>
            )}
          </h3>

          <div className="space-y-4">
            {/* Full Name */}
            <div className="flex flex-col">
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                Nom complet
              </label>
              <div className="input-glass rounded-xl px-4 py-3 flex items-center gap-3">
                <User className="w-4 h-4 text-[#8A2BE2]" />
                <input
                  type="text"
                  disabled={!isEditing}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-transparent border-none outline-none text-white text-sm w-full p-0 focus:ring-0 disabled:opacity-80"
                />
              </div>
            </div>

            {/* Email */}
            <div className="flex flex-col">
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                Adresse Email
              </label>
              <div className="input-glass rounded-xl px-4 py-3 flex items-center gap-3">
                <Mail className="w-4 h-4 text-[#8A2BE2]" />
                <input
                  type="email"
                  disabled={!isEditing}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-transparent border-none outline-none text-white text-sm w-full p-0 focus:ring-0 disabled:opacity-80"
                />
              </div>
            </div>

            {/* Phone Number */}
            <div className="flex flex-col">
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                Numéro de téléphone (Wave / OM)
              </label>
              <div className="input-glass rounded-xl px-4 py-3 flex items-center gap-3">
                <Phone className="w-4 h-4 text-[#8A2BE2]" />
                <input
                  type="tel"
                  disabled={!isEditing}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+221 77 000 00 00"
                  className="bg-transparent border-none outline-none text-white text-sm w-full p-0 focus:ring-0 disabled:opacity-80"
                />
              </div>
            </div>

            {/* Localisation : Ville & Quartier */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Ville */}
              <div className="flex flex-col">
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                  Ville
                </label>
                {isEditing ? (
                  <div className="input-glass rounded-xl px-4 py-3 flex items-center gap-3 border border-[#8A2BE2]/40 focus-within:border-[#E9C349] transition-all">
                    <MapPin className="w-4 h-4 text-[#E9C349] flex-shrink-0" />
                    <select
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="bg-transparent border-none outline-none text-white text-sm w-full p-0 focus:ring-0 cursor-pointer font-medium [&>option]:bg-[#1C1B1B] [&>option]:text-white"
                    >
                      <option value="Thiès">Thiès</option>
                      <option value="Dakar">Dakar</option>
                      <option value="Mbour">Mbour</option>
                      <option value="Saly">Saly</option>
                      <option value="Autre">Autre</option>
                    </select>
                  </div>
                ) : (
                  <div className="input-glass rounded-xl p-3.5 flex items-center gap-3 bg-[#1B1B1B]/90 border border-white/10">
                    <div className="w-8 h-8 rounded-lg bg-[#8A2BE2]/20 text-[#E9C349] flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-bold text-white">{city || 'Thiès'}</span>
                  </div>
                )}
              </div>

              {/* Quartier de la Ville de Thiès (33 Quartiers) */}
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    Quartier (Ville de Thiès)
                  </label>
                  <span className="text-[10px] font-extrabold text-[#E9C349] bg-[#E9C349]/10 px-2.5 py-0.5 rounded-full border border-[#E9C349]/25 shadow-xs">
                    33 Quartiers
                  </span>
                </div>

                {isEditing ? (
                  <div className="input-glass rounded-xl px-4 py-3 flex items-center gap-3 border border-[#8A2BE2]/40 focus-within:border-[#E9C349] transition-all">
                    <MapPin className="w-4 h-4 text-[#E9C349] flex-shrink-0" />
                    <select
                      value={quartier}
                      onChange={(e) => setQuartier(e.target.value)}
                      className="bg-transparent border-none outline-none text-white text-sm w-full p-0 focus:ring-0 cursor-pointer font-medium"
                    >
                      <optgroup label="📍 Thiès Ouest (11 quartiers)" className="bg-[#1A1A1A] text-[#DCB8FF] font-bold">
                        {THIES_QUARTIERS_BY_ZONE['Thiès Ouest'].map((q) => (
                          <option key={q.name} value={q.name} className="bg-[#1F1F1F] text-white font-normal">
                            {q.name} ({q.description})
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="📍 Thiès Est (11 quartiers)" className="bg-[#1A1A1A] text-[#DCB8FF] font-bold">
                        {THIES_QUARTIERS_BY_ZONE['Thiès Est'].map((q) => (
                          <option key={q.name} value={q.name} className="bg-[#1F1F1F] text-white font-normal">
                            {q.name} ({q.description})
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="📍 Thiès Nord (11 quartiers)" className="bg-[#1A1A1A] text-[#DCB8FF] font-bold">
                        {THIES_QUARTIERS_BY_ZONE['Thiès Nord'].map((q) => (
                          <option key={q.name} value={q.name} className="bg-[#1F1F1F] text-white font-normal">
                            {q.name} ({q.description})
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="🌍 Autre / Hors Thiès" className="bg-[#1A1A1A] text-gray-400 font-bold">
                        <option value="Autre quartier / Autre ville" className="bg-[#1F1F1F] text-white font-normal">
                          Autre quartier / Hors Thiès (Saly, Mbour, Dakar...)
                        </option>
                      </optgroup>
                    </select>
                  </div>
                ) : (
                  <div className="input-glass rounded-xl p-3.5 flex items-center justify-between gap-3 bg-[#1B1B1B]/90 border border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#8A2BE2]/20 text-[#E9C349] flex items-center justify-center flex-shrink-0">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">{quartier || 'Grand Standing'}</span>
                          {THIES_33_QUARTIERS.find((q) => q.name === (quartier || 'Grand Standing')) && (
                            <span className="text-[10px] font-semibold text-[#DCB8FF] bg-[#8A2BE2]/25 px-2 py-0.5 rounded-full border border-[#8A2BE2]/40">
                              {THIES_33_QUARTIERS.find((q) => q.name === (quartier || 'Grand Standing'))?.zone}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {THIES_33_QUARTIERS.find((q) => q.name === (quartier || 'Grand Standing'))?.description || 'Ville de Thiès, Sénégal'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Complément d'adresse */}
            <div className="flex flex-col">
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                Complément d'adresse / Rue / Repère
              </label>
              <div className="input-glass rounded-xl px-4 py-3 flex items-start gap-3">
                <MapPin className="w-4 h-4 text-[#8A2BE2] mt-0.5" />
                <textarea
                  rows={2}
                  disabled={!isEditing}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ex: Près de la grande mosquée, villa n°12..."
                  className="bg-transparent border-none outline-none text-white text-sm w-full p-0 focus:ring-0 resize-none disabled:opacity-80"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Right Column: Réseaux Sociaux & Confidentialité */}
        <div className="space-y-6">
          {/* Réseaux Sociaux Thièsdn — Liens d'invitation avec bouton Suivre */}
          <section className="glass-panel rounded-3xl p-6 space-y-4">
            <div className="border-b border-white/10 pb-3">
              <h3 className="font-heading font-bold text-base text-[#E9C349]">
                Réseaux Sociaux Officiels
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Suivez Thièsdn pour les exclusivités, galas et préventes
              </p>
            </div>

            <div className="space-y-2.5">
              {/* Facebook */}
              <a
                href="https://facebook.com/thiesdn"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3.5 rounded-xl bg-[#1F1F1F] hover:bg-[#28272a] transition-all border border-white/5 group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#1877F2] flex items-center justify-center text-white font-bold text-sm shadow-md">
                    f
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-white block">Facebook</span>
                    <span className="text-[11px] text-gray-400">@thiesdn</span>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#E9C349] group-hover:underline bg-[#E9C349]/10 px-3 py-1 rounded-lg border border-[#E9C349]/20 transition-all">
                  <span>Suivre</span>
                  <ExternalLink className="w-3 h-3" />
                </span>
              </a>

              {/* Instagram */}
              <a
                href="https://instagram.com/thiesdn"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3.5 rounded-xl bg-[#1F1F1F] hover:bg-[#28272a] transition-all border border-white/5 group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#FFDC80] via-[#F56040] to-[#C13584] flex items-center justify-center text-white font-bold text-xs shadow-md">
                    ig
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-white block">Instagram</span>
                    <span className="text-[11px] text-gray-400">@thiesdn</span>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#E9C349] group-hover:underline bg-[#E9C349]/10 px-3 py-1 rounded-lg border border-[#E9C349]/20 transition-all">
                  <span>Suivre</span>
                  <ExternalLink className="w-3 h-3" />
                </span>
              </a>

              {/* TikTok */}
              <a
                href="https://tiktok.com/@thiesdn"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3.5 rounded-xl bg-[#1F1F1F] hover:bg-[#28272a] transition-all border border-white/5 group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-black border border-white/20 flex items-center justify-center text-white font-bold text-xs shadow-md">
                    tk
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-white block">TikTok</span>
                    <span className="text-[11px] text-gray-400">@thiesdn</span>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#E9C349] group-hover:underline bg-[#E9C349]/10 px-3 py-1 rounded-lg border border-[#E9C349]/20 transition-all">
                  <span>Suivre</span>
                  <ExternalLink className="w-3 h-3" />
                </span>
              </a>
            </div>
          </section>

          {/* Confidentialité & Sécurité */}
          <section className="glass-panel rounded-3xl p-6 space-y-4">
            <h3 className="font-heading font-bold text-base text-[#E9C349] border-b border-white/10 pb-3">
              Confidentialité & Sécurité
            </h3>

            <div className="space-y-4">
              {/* Visibilité du Profil */}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-white">Visibilité du profil</h4>
                  <p className="text-xs text-gray-400">
                    Autoriser l'affichage de mon nom sur les listes de réservations publiques.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={privacySettings.publicProfile}
                    onChange={() => togglePrivacy('publicProfile')}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-[#2A2A2A] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8A2BE2]" />
                </label>
              </div>

              {/* Remplacement réel de Biometric Login par Changer mon mot de passe */}
              <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-[#E9C349]" />
                    <span>Mot de passe</span>
                  </h4>
                  <p className="text-xs text-gray-400">
                    Modifiez le mot de passe d'accès à votre compte.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPasswordError(null);
                    setPasswordSuccess(null);
                    setResetEmailSent(false);
                    setShowPasswordModal(true);
                  }}
                  className="btn-primary-glow px-4 py-2 rounded-xl text-xs font-heading font-bold uppercase tracking-wider flex items-center gap-1.5"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Changer</span>
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Mes Pass & Billets Section */}
      <section className="glass-panel rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Ticket className="w-5 h-5 text-[#8A2BE2]" />
            <h3 className="font-heading font-bold text-base text-white">
              Mes Billets & Pass VIP ({tickets.length})
            </h3>
          </div>
          <span className="text-xs text-[#DCB8FF]">Accès instantané QR</span>
        </div>

        {tickets.length === 0 ? (
          <p className="text-xs text-gray-400 py-4 text-center">
            Vous n'avez pas encore acheté de billet. Explorez nos soirées exclusives !
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {tickets.map((tkt) => (
              <div
                key={tkt.id}
                onClick={() => onOpenTicketPass(tkt)}
                className="p-4 rounded-2xl bg-[#1A1A1A] border border-white/10 hover:border-[#8A2BE2] cursor-pointer transition-all flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={tkt.eventPoster}
                    alt={tkt.eventTitle}
                    className="w-14 h-14 rounded-xl object-cover flex-shrink-0 group-hover:scale-105 transition-transform"
                  />
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-[#E9C349] uppercase block truncate">
                      {tkt.tierName}
                    </span>
                    <h4 className="font-heading font-bold text-sm text-white truncate">
                      {tkt.eventTitle}
                    </h4>
                    <p className="text-xs text-gray-400 truncate">{tkt.eventDate}</p>
                  </div>
                </div>

                <button className="btn-primary-glow p-2 rounded-xl text-white flex-shrink-0">
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Sign Out Action */}
      <div className="flex justify-center pt-4">
        <button
          onClick={onSignOut}
          className="flex items-center gap-2 text-red-400 hover:text-red-300 transition-colors py-2.5 px-6 rounded-xl bg-red-950/30 border border-red-500/30 text-xs font-heading font-bold uppercase tracking-wider shadow-sm hover:bg-red-950/50"
        >
          <LogOut className="w-4 h-4" />
          <span>SE DÉCONNECTER</span>
        </button>
      </div>

      {/* Modal Réel de Changement de Mot de Passe */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-[#181818] border border-[#8A2BE2]/40 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            {/* Header modal */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#E9C349]/20 text-[#E9C349] flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-base text-white">
                    Changer mon mot de passe
                  </h3>
                  <p className="text-[11px] text-gray-400">
                    Sécurisez l'accès à votre compte Thièsdn
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Notifications succès / erreur */}
            {passwordError && (
              <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{passwordError}</span>
              </div>
            )}

            {passwordSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            {/* Formulaire de saisie directe */}
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  Nouveau mot de passe
                </label>
                <div className="input-glass rounded-xl px-4 py-3 flex items-center gap-2.5">
                  <Lock className="w-4 h-4 text-gray-400" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Au moins 6 caractères"
                    className="bg-transparent border-none outline-none text-white text-xs w-full p-0 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="text-gray-400 hover:text-white"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  Confirmer le mot de passe
                </label>
                <div className="input-glass rounded-xl px-4 py-3 flex items-center gap-2.5">
                  <Lock className="w-4 h-4 text-gray-400" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Répétez le mot de passe"
                    className="bg-transparent border-none outline-none text-white text-xs w-full p-0 font-medium"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={passwordLoading}
                className="w-full btn-primary-glow py-3 rounded-xl font-heading font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all mt-2"
              >
                {passwordLoading ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>Mettre à jour le mot de passe</span>
                  </>
                )}
              </button>
            </form>

            {/* Option par email */}
            {user.email && (
              <div className="pt-2 border-t border-white/5 text-center">
                <button
                  type="button"
                  onClick={handleSendResetEmail}
                  disabled={passwordLoading || resetEmailSent}
                  className="text-xs text-[#DCB8FF] hover:underline flex items-center justify-center gap-1.5 mx-auto"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {resetEmailSent
                      ? 'Email de réinitialisation envoyé'
                      : `M'envoyer un lien de réinitialisation par email (${user.email})`}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
