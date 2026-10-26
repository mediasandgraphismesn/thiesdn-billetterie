import React, { useState, useEffect } from 'react';
import {
  Radio,
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  Laptop,
  Clock,
  MapPin,
  RefreshCw,
  Power,
  CheckCircle2,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { VigileSessionRecord } from '../types';
import { fetchVigileSessions, revokeVigileSession } from '../services/supabase';

export const VigileSessionsView: React.FC = () => {
  const [sessions, setSessions] = useState<VigileSessionRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const loadSessions = async () => {
    setIsLoading(true);
    try {
      const data = await fetchVigileSessions();
      setSessions(data);
    } catch (err) {
      console.warn('Erreur chargement vigile_sessions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
    // Rafraîchissement automatique toutes les 15 secondes pour statut temps réel
    const interval = setInterval(loadSessions, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleRevoke = async (session: VigileSessionRecord) => {
    if (!window.confirm(`Confirmer la révocation du poste "${session.stationCode}" ? Le scanner mobile sera immédiatement déconnecté.`)) {
      return;
    }

    setRevokingId(session.id);
    try {
      const ok = await revokeVigileSession(session.id);
      if (ok) {
        setToastMessage({
          text: `La session pour le poste ${session.stationCode} a été révoquée avec succès.`,
          type: 'success',
        });
        setSessions((prev) =>
          prev.map((s) => (s.id === session.id ? { ...s, isActive: false } : s))
        );
      } else {
        setToastMessage({
          text: 'Erreur lors de la révocation de la session.',
          type: 'error',
        });
      }
    } catch {
      setToastMessage({
        text: 'Erreur réseau lors de la révocation.',
        type: 'error',
      });
    } finally {
      setRevokingId(null);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const parseDevice = (userAgent?: string) => {
    if (!userAgent) return { label: 'Inconnu', icon: Smartphone };
    if (/iPhone/i.test(userAgent)) return { label: 'Apple iPhone', icon: Smartphone };
    if (/Android/i.test(userAgent)) return { label: 'Smartphone Android', icon: Smartphone };
    if (/iPad/i.test(userAgent)) return { label: 'Apple iPad', icon: Smartphone };
    if (/Windows/i.test(userAgent)) return { label: 'PC Windows', icon: Laptop };
    return { label: 'Appareil Mobile', icon: Smartphone };
  };

  const activeCount = sessions.filter((s) => s.isActive).length;
  const revokedCount = sessions.filter((s) => !s.isActive).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-16">
      {/* HEADER DE LA VUE */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-[#171424] via-[#100F17] to-[#0A0A0E] border border-[#8A2BE2]/30 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#8A2BE2]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-1 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#8A2BE2]/20 border border-[#8A2BE2]/40 text-[#DCB8FF] text-xs font-bold uppercase tracking-wider">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>Supervision des Portes en Direct</span>
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl font-black text-white tracking-tight">
            Sessions de Scan & Vigiles
          </h1>
          <p className="text-xs sm:text-sm text-gray-400">
            Contrôle anti-partage de lien : chaque scanner mobile est verrouillé sur un seul terminal physique.
          </p>
        </div>

        <button
          onClick={loadSessions}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold uppercase tracking-wider border border-white/10 transition-all self-start md:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Actualiser</span>
        </button>
      </div>

      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div
          className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-2 animate-in slide-in-from-top-2 duration-200 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
              : 'bg-red-500/20 border-red-500/40 text-red-300'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-400" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* STATS RAPIDES */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-panel p-4 rounded-2xl border border-white/10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">
              Scanners Actifs en Direct
            </span>
            <span className="font-heading text-2xl font-black text-emerald-400">{activeCount}</span>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-white/10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-500/20 border border-gray-500/40 flex items-center justify-center text-gray-400">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">
              Sessions Révoquées / Expirées
            </span>
            <span className="font-heading text-2xl font-black text-gray-300">{revokedCount}</span>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-white/10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#E9C349]/20 border border-[#E9C349]/40 flex items-center justify-center text-[#E9C349]">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">
              Verrouillage Anti-Fraude
            </span>
            <span className="font-heading text-xl font-black text-[#E9C349]">1 Poste = 1 Appareil</span>
          </div>
        </div>
      </div>

      {/* TABLEAU DES SESSIONS */}
      <div className="glass-panel rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#16151E] text-gray-400 font-heading uppercase text-[10px] tracking-wider border-b border-white/10">
              <tr>
                <th className="py-3.5 px-4">Statut</th>
                <th className="py-3.5 px-4">Poste & Événement</th>
                <th className="py-3.5 px-4">Terminal Détecté</th>
                <th className="py-3.5 px-4">Adresse IP</th>
                <th className="py-3.5 px-4">Localisation</th>
                <th className="py-3.5 px-4">Dernière Activité</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading && sessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#8A2BE2] mb-2" />
                    Lecture des sessions de contrôle...
                  </td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    <Radio className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    Aucune session vigile active pour le moment.
                  </td>
                </tr>
              ) : (
                sessions.map((session) => {
                  const device = parseDevice(session.userAgent);
                  const DeviceIcon = device.icon;
                  const dateObj = new Date(session.lastSeenAt);
                  const formattedDate = !isNaN(dateObj.getTime())
                    ? dateObj.toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })
                    : session.lastSeenAt;

                  return (
                    <tr
                      key={session.id}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Statut (Actif / Révoqué) */}
                      <td className="py-3.5 px-4">
                        {session.isActive ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black uppercase tracking-wider">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            Actif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-500/20 text-gray-400 border border-gray-500/30 text-[10px] font-bold uppercase tracking-wider">
                            <span className="w-2 h-2 rounded-full bg-gray-500" />
                            Révoqué
                          </span>
                        )}
                      </td>

                      {/* Poste & Événement */}
                      <td className="py-3.5 px-4">
                        <div className="font-heading font-black text-white text-xs">
                          {session.stationName || 'Poste de Contrôle'}
                        </div>
                        <div className="text-[10px] text-gray-400 font-mono mt-0.5 flex items-center gap-1">
                          <span className="text-[#E9C349] font-bold">{session.stationCode}</span>
                          <span>•</span>
                          <span className="truncate max-w-[150px]">{session.eventTitle || 'Soirée Thiès'}</span>
                        </div>
                      </td>

                      {/* Terminal Détecté */}
                      <td className="py-3.5 px-4 text-gray-300">
                        <div className="flex items-center gap-1.5" title={session.userAgent}>
                          <DeviceIcon className="w-3.5 h-3.5 text-[#E9C349]" />
                          <span className="font-medium">{device.label}</span>
                        </div>
                      </td>

                      {/* Adresse IP */}
                      <td className="py-3.5 px-4 font-mono text-xs text-[#DCB8FF]">
                        {session.ipAddress || '127.0.0.1'}
                      </td>

                      {/* Localisation */}
                      <td className="py-3.5 px-4 text-gray-300">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-rose-400" />
                          <span>
                            {session.city || 'Thiès'}, {session.country || 'Sénégal'}
                          </span>
                        </div>
                      </td>

                      {/* Horodatage */}
                      <td className="py-3.5 px-4 font-mono text-gray-300 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-[#DCB8FF]/60" />
                          <span>{formattedDate}</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center">
                        {session.isActive ? (
                          <button
                            onClick={() => handleRevoke(session)}
                            disabled={revokingId === session.id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 text-[11px] font-bold uppercase tracking-wider transition-all hover:scale-105 disabled:opacity-50"
                            title="Forcer la déconnexion immédiate de ce scanner"
                          >
                            <Power className="w-3 h-3 text-red-400" />
                            <span>{revokingId === session.id ? 'Révocation...' : 'Révoquer'}</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-gray-500 font-mono">Désactivé</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
