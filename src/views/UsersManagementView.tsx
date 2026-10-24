import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Filter,
  ShieldCheck,
  Crown,
  User,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Phone,
  Mail,
  MapPin,
  RefreshCw,
  Sparkles,
  Scale,
  FileText,
} from 'lucide-react';
import { UserProfile, CURRENT_TERMS_VERSION } from '../types';
import { fetchAllProfilesFromSupabase, updateUserRoleOrVip } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';

interface UsersManagementViewProps {
  onBackToDashboard: () => void;
}

export const UsersManagementView: React.FC<UsersManagementViewProps> = ({
  onBackToDashboard,
}) => {
  const { user: currentAuthUser, refreshUserProfile } = useAuth();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'promoter' | 'admin'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const loadProfiles = async () => {
    setIsLoading(true);
    const { profiles: dbProfiles } = await fetchAllProfilesFromSupabase();
    setProfiles(dbProfiles);
    setIsLoading(false);
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  const handleToggleVip = async (user: UserProfile) => {
    const newStatus = !user.isVip;
    setUpdatingUserId(user.id);
    const res = await updateUserRoleOrVip(user.id, { isVip: newStatus });
    setUpdatingUserId(null);

    if (res.success) {
      setSuccessToast(`Statut VIP mis à jour pour ${user.name} (${newStatus ? 'Actif' : 'Désactivé'})`);
      setErrorToast(null);
      // Rechargement obligatoire depuis Supabase pour refléter la réalité de la base
      await loadProfiles();
      if (currentAuthUser?.id === user.id) {
        await refreshUserProfile();
      }
      setTimeout(() => setSuccessToast(null), 3500);
    } else {
      console.error('Échec mise à jour VIP Supabase:', res.error);
      setErrorToast(`Échec de la modification : ${res.error || 'Erreur inconnue'}`);
      setSuccessToast(null);
      // Recharger pour annuler tout état incohérent
      await loadProfiles();
      setTimeout(() => setErrorToast(null), 6000);
    }
  };

  const handleChangeRole = async (user: UserProfile, newRole: 'user' | 'promoter' | 'admin') => {
    setUpdatingUserId(user.id);
    const res = await updateUserRoleOrVip(user.id, { role: newRole });
    setUpdatingUserId(null);

    if (res.success) {
      setSuccessToast(`Rôle de ${user.name} mis à jour avec succès : ${newRole.toUpperCase()}`);
      setErrorToast(null);
      // CRUCIAL : Rechargement complet de la liste depuis Supabase
      await loadProfiles();
      // Synchronisation de session immédiate si c'est l'utilisateur connecté
      if (currentAuthUser?.id === user.id) {
        await refreshUserProfile();
      }
      setTimeout(() => setSuccessToast(null), 3500);
    } else {
      console.error('Échec changement de rôle Supabase:', res.error);
      setErrorToast(`Échec de mise à jour du rôle : ${res.error || 'Permission refusée'}`);
      setSuccessToast(null);
      // Recharger pour restaurer l'état réel de la base
      await loadProfiles();
      setTimeout(() => setErrorToast(null), 6000);
    }
  };

  const filteredProfiles = profiles.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.quartier && p.quartier.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesRole = roleFilter === 'all' || p.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-300">
      {/* Toast Succès */}
      {successToast && (
        <div className="fixed top-20 right-6 z-50 p-4 rounded-2xl bg-[#1C1B1B] border border-emerald-500 shadow-2xl text-white flex items-center gap-3 animate-in slide-in-from-top-4 duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-semibold">{successToast}</span>
        </div>
      )}

      {/* Toast Erreur RLS / Réseau */}
      {errorToast && (
        <div className="fixed top-20 right-6 z-50 p-4 rounded-2xl bg-[#1C1B1B] border border-red-500 shadow-2xl text-white flex items-center gap-3 animate-in slide-in-from-top-4 duration-300 max-w-md">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span className="text-sm font-semibold text-red-200">{errorToast}</span>
        </div>
      )}

      {/* Header */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-white/10">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-blue-500/20 text-blue-300 border border-blue-500/40 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              Répertoire National
            </span>
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Gestion des Utilisateurs
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">
            Gérez les comptes clients, promoteurs d'événements, artistes et superviseurs administratifs.
          </p>
        </div>

        <button
          onClick={loadProfiles}
          disabled={isLoading}
          className="p-3 rounded-xl bg-[#1F1F1F] hover:bg-[#282828] text-gray-300 hover:text-white border border-white/10 transition-all flex items-center gap-2 text-xs font-bold self-start md:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#E9C349]' : ''}`} />
          <span>Actualiser</span>
        </button>
      </div>

      {/* Barre de recherche et filtre de rôle */}
      <div className="glass-panel p-4 rounded-2xl border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par nom, email, téléphone, quartier..."
            className="w-full bg-[#141414] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#8A2BE2]"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(['all', 'user', 'promoter', 'admin'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                roleFilter === r
                  ? 'bg-[#8A2BE2] text-white shadow-md'
                  : 'bg-[#181818] text-gray-400 hover:text-white border border-white/5'
              }`}
            >
              {r === 'all'
                ? `Tous (${profiles.length})`
                : r === 'user'
                ? `Clients (${profiles.filter((p) => p.role === 'user').length})`
                : r === 'promoter'
                ? `Promoteurs (${profiles.filter((p) => p.role === 'promoter').length})`
                : `Admins (${profiles.filter((p) => p.role === 'admin').length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Liste des utilisateurs */}
      <div className="space-y-3">
        {filteredProfiles.map((user) => (
          <div
            key={user.id}
            className="glass-panel p-4 rounded-2xl border border-white/10 hover:border-white/20 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            {/* Profil gauche */}
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-[#8A2BE2] flex-shrink-0 relative">
                <img
                  src={user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop'}
                  alt={user.name}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-bold text-white truncate font-heading">
                    {user.name}
                  </h3>
                  {user.isVip && (
                    <span className="bg-[#E9C349] text-[#241A00] text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                      <Crown className="w-3 h-3" /> VIP
                    </span>
                  )}
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      user.role === 'admin'
                        ? 'bg-[#8A2BE2]/20 text-[#DCB8FF] border border-[#8A2BE2]/30'
                        : user.role === 'promoter'
                        ? 'bg-[#E9C349]/20 text-[#E9C349] border border-[#E9C349]/30'
                        : 'bg-white/10 text-gray-300'
                    }`}
                  >
                    {user.role === 'admin'
                      ? 'Super Administrateur'
                      : user.role === 'promoter'
                      ? 'Promoteur / Artiste'
                      : 'Client Standard'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <Mail className="w-3 h-3 text-[#DCB8FF]" />
                    <span>{user.email || 'Email non renseigné'}</span>
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3 text-[#E9C349]" />
                    <span>{user.phone || 'Pas de numéro'}</span>
                  </span>
                  {(user.quartier || user.city) && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-[#DCB8FF]">
                        <MapPin className="w-3 h-3 text-[#8A2BE2]" />
                        <span>{user.quartier ? `${user.quartier} (${user.city || 'Thiès'})` : user.city}</span>
                      </span>
                    </>
                  )}
                </div>

                {/* Traçabilité Juridique & Statut CGV */}
                <div className="pt-1 flex flex-wrap items-center gap-2 text-[11px]">
                  {user.termsAccepted ? (
                    user.termsVersion === CURRENT_TERMS_VERSION ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-medium">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span>
                          CGV {user.termsVersion || CURRENT_TERMS_VERSION} signées
                          {user.termsAcceptedAt && (
                            <span className="text-gray-400 ml-1">
                              ({new Date(user.termsAcceptedAt).toLocaleDateString('fr-FR', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })})
                            </span>
                          )}
                        </span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/40 font-medium">
                        <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                        <span>
                          CGV {user.termsVersion || 'Inconnue'} (Obsolète — màj {CURRENT_TERMS_VERSION} requise)
                        </span>
                      </span>
                    )
                  ) : (
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg font-medium ${
                        user.role === 'promoter'
                          ? 'bg-rose-500/15 text-rose-300 border border-rose-500/40'
                          : 'bg-white/5 text-gray-500 border border-white/10'
                      }`}
                    >
                      <AlertCircle className={`w-3 h-3 shrink-0 ${user.role === 'promoter' ? 'text-rose-400' : 'text-gray-500'}`} />
                      <span>
                        {user.role === 'promoter'
                          ? 'CGV non signées (Création d’événements bloquée)'
                          : 'CGV non signées'}
                      </span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Actions Administratives */}
            <div className="flex items-center gap-2.5 self-end md:self-auto flex-shrink-0">
              <button
                onClick={() => handleToggleVip(user)}
                disabled={updatingUserId === user.id}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border disabled:opacity-50 ${
                  user.isVip
                    ? 'bg-[#E9C349]/20 text-[#E9C349] border-[#E9C349]/40 hover:bg-[#E9C349]/30'
                    : 'bg-white/5 text-gray-400 border-white/10 hover:text-white hover:bg-white/10'
                }`}
              >
                {updatingUserId === user.id ? 'Mise à jour...' : user.isVip ? '★ Membre VIP' : '☆ Passer VIP'}
              </button>

              <select
                value={user.role}
                disabled={updatingUserId === user.id}
                onChange={(e) => handleChangeRole(user, e.target.value as any)}
                className="bg-[#141414] border border-white/10 text-white rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-[#8A2BE2] cursor-pointer disabled:opacity-50"
              >
                <option value="user">Rôle : Client</option>
                <option value="promoter">Rôle : Promoteur</option>
                <option value="admin">Rôle : Super Admin</option>
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
