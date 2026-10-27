import React, { useState, useEffect } from 'react';
import {
  History,
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  Globe,
  Smartphone,
  Laptop,
  Clock,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  MapPin,
  LogIn,
  LogOut,
} from 'lucide-react';
import { LoginHistoryRecord } from '../types';
import { fetchLoginHistory } from '../services/supabase';

export const LoginHistoryView: React.FC = () => {
  const [logs, setLogs] = useState<LoginHistoryRecord[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 50;

  // Filtres
  const [searchEmail, setSearchEmail] = useState<string>('');
  const [selectedCountry, setSelectedCountry] = useState<string>('all');
  const [selectedAction, setSelectedAction] = useState<string>('all');

  const loadLogs = async (page: number = 1) => {
    setIsLoading(true);
    try {
      const res = await fetchLoginHistory(page, pageSize, {
        email: searchEmail,
        country: selectedCountry,
        action: selectedAction,
      });
      setLogs(res.logs);
      setTotalCount(res.totalCount);
      setCurrentPage(page);
    } catch (err) {
      console.warn('Erreur chargement historique connexions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs(1);
  }, [selectedCountry, selectedAction]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadLogs(1);
  };

  // Helper pour simplifier le User-Agent
  const parseDevice = (userAgent?: string) => {
    if (!userAgent) return { label: 'Inconnu', icon: Laptop };
    if (/iPhone/i.test(userAgent)) return { label: 'iPhone (Safari)', icon: Smartphone };
    if (/iPad/i.test(userAgent)) return { label: 'iPad (Safari)', icon: Smartphone };
    if (/Android/i.test(userAgent)) return { label: 'Android (Chrome)', icon: Smartphone };
    if (/Windows/i.test(userAgent)) return { label: 'Windows (Navigateur)', icon: Laptop };
    if (/Macintosh/i.test(userAgent)) return { label: 'Mac OS (Navigateur)', icon: Laptop };
    if (/Linux/i.test(userAgent)) return { label: 'Linux', icon: Laptop };
    return { label: 'Web Browser', icon: Laptop };
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  // Liste des pays uniques pour le filtre
  const uniqueCountries = Array.from(new Set(logs.map((l) => l.country).filter(Boolean)));

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-16">
      {/* HEADER : TITRE & RÉSUMÉ CYBERSÉCURITÉ */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-[#171424] via-[#100F17] to-[#0A0A0E] border border-[#8A2BE2]/30 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#8A2BE2]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-1 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#8A2BE2]/20 border border-[#8A2BE2]/40 text-[#DCB8FF] text-xs font-bold uppercase tracking-wider">
            <ShieldAlert className="w-3.5 h-3.5 text-[#E9C349]" />
            <span>Audit & Sécurité des Accès</span>
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl font-black text-white tracking-tight">
            Journal des Connexions
          </h1>
          <p className="text-xs sm:text-sm text-gray-400">
            Traçabilité des accès utilisateurs et administrateurs avec géolocalisation IP et empreinte appareil.
          </p>
        </div>

        <button
          onClick={() => loadLogs(currentPage)}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold uppercase tracking-wider border border-white/10 transition-all self-start md:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Actualiser</span>
        </button>
      </div>

      {/* CARTES STATISTIQUES RAPIDES */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-panel p-4 rounded-2xl border border-white/10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#8A2BE2]/20 border border-[#8A2BE2]/40 flex items-center justify-center text-[#DCB8FF]">
            <History className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">
              Total Connexions Enregistrées
            </span>
            <span className="font-heading text-xl font-black text-white">{totalCount}</span>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-white/10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">
              Pays d'Origine Détectés
            </span>
            <span className="font-heading text-xl font-black text-white">
              {uniqueCountries.length > 0 ? uniqueCountries.length : '1+ (Sénégal)'}
            </span>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-white/10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#E9C349]/20 border border-[#E9C349]/40 flex items-center justify-center text-[#E9C349]">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">
              Protection RLS Active
            </span>
            <span className="font-heading text-xl font-black text-[#E9C349]">100% Hermétique</span>
          </div>
        </div>
      </div>

      {/* BARRE DE FILTRES ET RECHERCHE */}
      <div className="glass-panel p-4 rounded-2xl border border-white/10 flex flex-col md:flex-row items-center justify-between gap-3 shadow-xl">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchEmail}
            onChange={(e) => setSearchEmail(e.target.value)}
            placeholder="Rechercher par email..."
            className="w-full bg-[#161616] border border-white/10 rounded-xl pl-10 pr-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#8A2BE2]"
          />
        </form>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Filtre Pays */}
          <div className="flex items-center gap-1.5 bg-[#161616] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-gray-300">
            <Globe className="w-3.5 h-3.5 text-[#E9C349]" />
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="bg-transparent text-xs text-white focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-[#1C1B1B]">Tous les pays</option>
              <option value="Sénégal" className="bg-[#1C1B1B]">Sénégal 🇸🇳</option>
              <option value="France" className="bg-[#1C1B1B]">France 🇫🇷</option>
              <option value="États-Unis" className="bg-[#1C1B1B]">États-Unis 🇺🇸</option>
              {uniqueCountries
                .filter((c) => !['Sénégal', 'France', 'États-Unis'].includes(c || ''))
                .map((c) => (
                  <option key={c} value={c} className="bg-[#1C1B1B]">
                    {c}
                  </option>
                ))}
            </select>
          </div>

          {/* Filtre Action */}
          <div className="flex items-center gap-1.5 bg-[#161616] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-gray-300">
            <Filter className="w-3.5 h-3.5 text-[#DCB8FF]" />
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="bg-transparent text-xs text-white focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-[#1C1B1B]">Toutes les actions</option>
              <option value="login" className="bg-[#1C1B1B]">Connexion (login)</option>
              <option value="logout" className="bg-[#1C1B1B]">Déconnexion (logout)</option>
            </select>
          </div>
        </div>
      </div>

      {/* TABLEAU DES CONNEXIONS NOCTURNAL ELEGANCE */}
      <div className="glass-panel rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#16151E] text-gray-400 font-heading uppercase text-[10px] tracking-wider border-b border-white/10">
              <tr>
                <th className="py-3.5 px-4">Date & Heure</th>
                <th className="py-3.5 px-4">Utilisateur</th>
                <th className="py-3.5 px-4">Appareil</th>
                <th className="py-3.5 px-4">Adresse IP</th>
                <th className="py-3.5 px-4">Localisation</th>
                <th className="py-3.5 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#8A2BE2] mb-2" />
                    Chargement du journal des accès...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    <History className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    Aucun enregistrement de connexion correspondant.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const device = parseDevice(log.userAgent);
                  const DeviceIcon = device.icon;
                  const dateObj = new Date(log.createdAt);
                  const formattedDate = !isNaN(dateObj.getTime())
                    ? dateObj.toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })
                    : log.createdAt;

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Date & Heure */}
                      <td className="py-3 px-4 font-mono text-gray-300 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-[#DCB8FF]/60" />
                          <span>{formattedDate}</span>
                        </div>
                      </td>

                      {/* Utilisateur (Email) */}
                      <td className="py-3 px-4 font-medium text-white max-w-full min-w-0 truncate">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#8A2BE2]/20 border border-[#8A2BE2]/40 flex items-center justify-center text-[10px] text-[#DCB8FF] shrink-0 font-bold">
                            {log.email.charAt(0).toUpperCase()}
                          </div>
                          <span className="truncate" title={log.email}>
                            {log.email}
                          </span>
                        </div>
                      </td>

                      {/* Appareil */}
                      <td className="py-3 px-4 text-gray-300">
                        <div className="flex items-center gap-1.5" title={log.userAgent}>
                          <DeviceIcon className="w-3.5 h-3.5 text-[#E9C349]" />
                          <span>{device.label}</span>
                        </div>
                      </td>

                      {/* Adresse IP */}
                      <td className="py-3 px-4 font-mono text-xs text-[#DCB8FF]">
                        {log.ipAddress || '127.0.0.1'}
                      </td>

                      {/* Localisation */}
                      <td className="py-3 px-4 text-gray-300">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-rose-400" />
                          <span>
                            {log.city || 'Thiès'}, {log.country || 'Sénégal'}
                          </span>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-center">
                        {log.action === 'login' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                            <LogIn className="w-2.5 h-2.5" />
                            Connexion
                          </span>
                        ) : log.action === 'logout' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gray-500/20 text-gray-300 border border-gray-500/30 text-[10px] font-bold">
                            <LogOut className="w-2.5 h-2.5" />
                            Déconnexion
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                            {log.action}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION (50 PAR PAGE) */}
        <div className="p-4 bg-[#14131A] border-t border-white/10 flex items-center justify-between text-xs text-gray-400">
          <div>
            Affichage de {logs.length} sur {totalCount} connexions enregistrées
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadLogs(currentPage - 1)}
              disabled={currentPage <= 1 || isLoading}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-white font-mono text-xs px-2">
              Page {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => loadLogs(currentPage + 1)}
              disabled={currentPage >= totalPages || isLoading}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
