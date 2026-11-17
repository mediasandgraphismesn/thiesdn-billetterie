import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
} from 'recharts';
import {
  BarChart3,
  Eye,
  Share2,
  TrendingUp,
  Smartphone,
  Clock,
  Globe,
  Flame,
} from 'lucide-react';
import { EventAnalyticsRecord, EventItem } from '../../types';
import { ContextualTooltip } from '../ui/ContextualTooltip';

interface AudienceAnalyticsCardProps {
  analytics: EventAnalyticsRecord[];
  events: EventItem[];
  isLoading?: boolean;
  errorMessage?: string | null;
  scopeLabel?: string;
  cardPaddingClass?: string;
}

interface ShareChannelDatum {
  name: string;
  value: number;
  color: string;
}

interface DailyClickDatum {
  dateLabel: string;
  clicks: number;
  shares: number;
}

interface HourlyClickDatum {
  hourLabel: string;
  hour: number;
  clicks: number;
}

interface TrafficSourceRow {
  key: string;
  label: string;
  sourceType: 'site' | 'social';
  medium: string;
  clicks: number;
  shares: number;
  percent: number;
}

const SHARE_COLORS = {
  whatsapp: '#10B981',
  facebook: '#3B82F6',
  others: '#E9C349',
};

export const AudienceAnalyticsCard: React.FC<AudienceAnalyticsCardProps> = ({
  analytics,
  events,
  isLoading = false,
  errorMessage = null,
  scopeLabel = 'Plateforme',
  cardPaddingClass = 'p-4 sm:p-6',
}) => {
  const [selectedEventId, setSelectedEventId] = useState<string>('all');

  const allowedEventIds = useMemo(() => new Set(events.map((e) => e.id)), [events]);

  const scopedRecords = useMemo(() => {
    return analytics.filter((row) => {
      if (events.length > 0 && !allowedEventIds.has(row.eventId)) return false;
      if (selectedEventId !== 'all' && row.eventId !== selectedEventId) return false;
      return true;
    });
  }, [analytics, events.length, allowedEventIds, selectedEventId]);

  const totalViews = useMemo(
    () => scopedRecords.filter((r) => r.action === 'click').length,
    [scopedRecords]
  );

  const totalShares = useMemo(
    () => scopedRecords.filter((r) => r.action !== 'click').length,
    [scopedRecords]
  );

  const shareRate = useMemo(() => {
    if (totalViews === 0) return 0;
    return Math.round((totalShares / totalViews) * 100);
  }, [totalViews, totalShares]);

  const mobileRatio = useMemo(() => {
    if (scopedRecords.length === 0) return 0;
    const mobileCount = scopedRecords.filter((r) => r.device === 'mobile').length;
    return Math.round((mobileCount / scopedRecords.length) * 100);
  }, [scopedRecords]);

  // Graphique 1 : Donut des partages (WhatsApp vs Facebook vs Autres)
  const shareDonutData = useMemo<ShareChannelDatum[]>(() => {
    let whatsapp = 0;
    let facebook = 0;
    let others = 0;

    for (const r of scopedRecords) {
      if (r.action === 'share_whatsapp') whatsapp += 1;
      else if (r.action === 'share_facebook') facebook += 1;
      else if (r.action === 'share_twitter' || r.action === 'share_copy_link') others += 1;
    }

    return [
      { name: 'WhatsApp', value: whatsapp, color: SHARE_COLORS.whatsapp },
      { name: 'Facebook', value: facebook, color: SHARE_COLORS.facebook },
      { name: 'Autres (X / Lien)', value: others, color: SHARE_COLORS.others },
    ].filter((d) => d.value > 0);
  }, [scopedRecords]);

  // Graphique 2 : Barres des clics des 7 derniers jours
  const dailyClicksData = useMemo<DailyClickDatum[]>(() => {
    const days: DailyClickDatum[] = [];
    const byDayKey = new Map<string, { clicks: number; shares: number }>();

    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit' });
      byDayKey.set(key, { clicks: 0, shares: 0 });
      days.push({ dateLabel: label, clicks: 0, shares: 0 });
    }

    const keysOrder = Array.from(byDayKey.keys());

    for (const r of scopedRecords) {
      const parsed = new Date(r.createdAt);
      if (Number.isNaN(parsed.getTime())) continue;
      const key = parsed.toISOString().slice(0, 10);
      const bucket = byDayKey.get(key);
      if (!bucket) continue;
      if (r.action === 'click') bucket.clicks += 1;
      else bucket.shares += 1;
    }

    return keysOrder.map((key, idx) => {
      const bucket = byDayKey.get(key) || { clicks: 0, shares: 0 };
      return {
        dateLabel: days[idx].dateLabel,
        clicks: bucket.clicks,
        shares: bucket.shares,
      };
    });
  }, [scopedRecords]);

  // Graphique 3 : Activité par Heure (0h - 23h)
  const hourlyActivity = useMemo(() => {
    const buckets: HourlyClickDatum[] = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      hourLabel: `${String(hour).padStart(2, '0')}h`,
      clicks: 0,
    }));

    for (const r of scopedRecords) {
      if (r.action !== 'click') continue;
      const d = new Date(r.createdAt);
      if (Number.isNaN(d.getTime())) continue;
      const h = d.getHours();
      if (h >= 0 && h < 24) {
        buckets[h].clicks += 1;
      }
    }

    let peakHour = 20;
    let peakClicks = 0;
    for (const b of buckets) {
      if (b.clicks > peakClicks) {
        peakClicks = b.clicks;
        peakHour = b.hour;
      }
    }

    return { buckets, peakHour, peakClicks };
  }, [scopedRecords]);

  // Tableau Source du trafic & UTM
  const trafficSources = useMemo<TrafficSourceRow[]>(() => {
    const map = new Map<string, Omit<TrafficSourceRow, 'percent'>>();

    for (const r of scopedRecords) {
      const utm = r.utmSource?.trim().toLowerCase();
      const key = utm ? `${r.source}:${utm}` : `${r.source}:direct`;
      const label = utm
        ? utm === 'direct'
          ? 'Lien copié (Direct)'
          : utm.charAt(0).toUpperCase() + utm.slice(1)
        : r.source === 'social'
        ? 'Réseaux Sociaux'
        : 'Site Web Direct';

      const current = map.get(key) || {
        key,
        label,
        sourceType: r.source,
        medium: r.utmMedium || (r.source === 'social' ? 'social' : 'organique'),
        clicks: 0,
        shares: 0,
      };

      if (r.action === 'click') current.clicks += 1;
      else current.shares += 1;
      map.set(key, current);
    }

    const total = Math.max(1, scopedRecords.length);
    return Array.from(map.values())
      .map((item) => ({
        ...item,
        percent: Math.round(((item.clicks + item.shares) / total) * 100),
      }))
      .sort((a, b) => b.clicks + b.shares - (a.clicks + a.shares));
  }, [scopedRecords]);

  const isEmpty = scopedRecords.length === 0;

  return (
    <section
      className={`glass-panel rounded-3xl ${cardPaddingClass} border border-white/10 space-y-5 shadow-2xl`}
    >
      {/* En-tête */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <BarChart3 className="w-5 h-5 text-[#E9C349]" />
            <h2 className="font-heading text-base sm:text-lg font-extrabold text-white">
              Analyse de l&apos;Audience
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#8A2BE2]/20 text-[#DCB8FF] border border-[#8A2BE2]/40">
              {scopeLabel}
            </span>

            {errorMessage ? (
              <ContextualTooltip
                variant="rbac"
                title="Lecture Analytics restreinte (RBAC)"
                reason={`Supabase a retourné : ${errorMessage}. Les politiques RLS réservent la lecture aux administrateurs ou au promoteur propriétaire de l'événement.`}
                remedy="Vérifiez votre rôle sur la table profiles et assurez-vous d'avoir exécuté supabase_migration_command_center_analytics.sql."
                align="left"
              />
            ) : (
              isEmpty &&
              !isLoading && (
                <ContextualTooltip
                  variant="info"
                  title="Aucune interaction enregistrée"
                  reason="Aucun clic ou partage UTM n'a encore été capturé sur cet événement pour les 30 derniers jours."
                  remedy="Partagez un lien d'événement via WhatsApp, Facebook ou Copier le lien, ou ouvrez la fiche d'un événement côté public."
                  align="left"
                />
              )
            )}
          </div>
          <p className="text-xs text-[#E5E2E1]">
            Suivi des clics, partages sociaux, attribution UTM et heures de pointe pour optimiser vos campagnes WhatsApp.
          </p>
        </div>

        {/* Sélecteur d'événement */}
        {events.length > 0 && (
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            aria-label="Filtrer les analytics par événement"
            className="bg-[#141418] border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8A2BE2] max-w-full sm:max-w-xs"
          >
            <option value="all">Tous les événements ({events.length})</option>
            {events.map((evt) => (
              <option key={evt.id} value={evt.id}>
                {evt.title}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* 4 Mini KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-[#14131B] border border-white/10 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-gray-300 font-bold uppercase">
            <span>Total Vues (Clics)</span>
            <Eye className="w-4 h-4 text-[#8A2BE2]" />
          </div>
          <p className="font-heading text-2xl font-black text-white tabular-nums">{totalViews}</p>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#14131B] border border-white/10 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-gray-300 font-bold uppercase">
            <span>Total Partages</span>
            <Share2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="font-heading text-2xl font-black text-emerald-400 tabular-nums">
            {totalShares}
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#14131B] border border-white/10 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-gray-300 font-bold uppercase">
            <span>Taux de Partage</span>
            <TrendingUp className="w-4 h-4 text-[#E9C349]" />
          </div>
          <p className="font-heading text-2xl font-black text-[#E9C349] tabular-nums">
            {shareRate}%
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#14131B] border border-white/10 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-gray-300 font-bold uppercase">
            <span>Trafic Mobile</span>
            <Smartphone className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="font-heading text-2xl font-black text-cyan-300 tabular-nums">
            {mobileRatio}%
          </p>
        </div>
      </div>

      {/* Grille Graphique 1 (Donut) + Graphique 2 (Barres 7 jours) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Graphique 1 : Donut des Partages */}
        <div className="p-4 rounded-2xl bg-[#121118] border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-heading font-bold text-sm text-white">
              Répartition des Partages Sociaux
            </h3>
            <span className="text-[11px] text-gray-300">{totalShares} partage(s)</span>
          </div>

          {shareDonutData.length === 0 ? (
            <div className="h-56 flex flex-col items-center justify-center text-center text-xs text-gray-300 border border-dashed border-white/10 rounded-xl p-4">
              <Share2 className="w-7 h-7 text-gray-500 mb-2" />
              <span>Aucun partage social enregistré pour cette sélection.</span>
            </div>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={shareDonutData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={80}
                    paddingAngle={4}
                  >
                    {shareDonutData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#14131B',
                      border: '1px solid rgba(233, 195, 73, 0.4)',
                      borderRadius: '12px',
                      color: '#FFFFFF',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-4 text-[11px]">
            <span className="inline-flex items-center gap-1.5 text-emerald-300">
              <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
              WhatsApp
            </span>
            <span className="inline-flex items-center gap-1.5 text-blue-300">
              <span className="w-2.5 h-2.5 rounded-full bg-[#3B82F6]" />
              Facebook
            </span>
            <span className="inline-flex items-center gap-1.5 text-[#E9C349]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#E9C349]" />
              Twitter/X &amp; Lien copié
            </span>
          </div>
        </div>

        {/* Graphique 2 : Barres Clics 7 derniers jours */}
        <div className="p-4 rounded-2xl bg-[#121118] border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-heading font-bold text-sm text-white">
              Clics par Jour (7 derniers jours)
            </h3>
            <span className="text-[11px] text-[#DCB8FF]">Tendance hebdo</span>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyClicksData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="dateLabel" stroke="#9CA3AF" fontSize={11} />
                <YAxis stroke="#9CA3AF" fontSize={11} allowDecimals={false} />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: '#14131B',
                    border: '1px solid rgba(138, 43, 226, 0.5)',
                    borderRadius: '12px',
                    color: '#FFFFFF',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="clicks" name="Clics" fill="#8A2BE2" radius={[6, 6, 0, 0]} />
                <Bar dataKey="shares" name="Partages" fill="#E9C349" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Graphique 3 : Activité par Heure (0h - 23h) — Heure de pointe */}
      <div className="p-4 rounded-2xl bg-[#121118] border border-[#E9C349]/25 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#E9C349]" />
            <h3 className="font-heading font-bold text-sm text-white">
              Activité par Heure (0h - 23h)
            </h3>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E9C349]/15 border border-[#E9C349]/40 text-[#E9C349] text-xs font-bold self-start sm:self-auto">
            <Flame className="w-3.5 h-3.5" />
            <span>
              {hourlyActivity.peakClicks > 0
                ? `Pic d'activité à ${String(hourlyActivity.peakHour).padStart(2, '0')}h (${hourlyActivity.peakClicks} clics)`
                : "En attente de clics pour calculer l'heure de pointe"}
            </span>
          </div>
        </div>

        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={hourlyActivity.buckets}
              margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
            >
              <defs>
                <linearGradient id="peakHoursGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#E9C349" stopOpacity={0.55} />
                  <stop offset="95%" stopColor="#8A2BE2" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="hourLabel" stroke="#9CA3AF" fontSize={10} interval={2} />
              <YAxis stroke="#9CA3AF" fontSize={11} allowDecimals={false} />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: '#14131B',
                  border: '1px solid rgba(233, 195, 73, 0.5)',
                  borderRadius: '12px',
                  color: '#FFFFFF',
                  fontSize: '12px',
                }}
              />
              <Area
                type="monotone"
                dataKey="clicks"
                name="Clics"
                stroke="#E9C349"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#peakHoursGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {hourlyActivity.peakClicks > 0 && (
          <p className="text-[11px] text-emerald-300 font-medium">
            Recommandation campagne WhatsApp : programmez vos diffusions entre{' '}
            <strong>{String(hourlyActivity.peakHour).padStart(2, '0')}h00</strong> et{' '}
            <strong>{String((hourlyActivity.peakHour + 1) % 24).padStart(2, '0')}h00</strong> pour
            maximiser la conversion.
          </p>
        )}
      </div>

      {/* Tableau Source du trafic & Attribution UTM */}
      <div className="p-4 rounded-2xl bg-[#121118] border border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-heading font-bold text-sm text-white flex items-center gap-2">
            <Globe className="w-4 h-4 text-cyan-400" />
            <span>Provenance du Trafic &amp; Attribution UTM</span>
          </h3>
          <span className="text-[11px] text-gray-300">Site Direct vs Réseaux Sociaux</span>
        </div>

        {trafficSources.length === 0 ? (
          <p className="text-xs text-gray-300 py-4 text-center">
            Aucune source UTM enregistrée pour le moment.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase tracking-wider text-gray-300 border-b border-white/10">
                <tr>
                  <th className="py-2 pr-3">Source / Canal</th>
                  <th className="py-2 px-3">Origine</th>
                  <th className="py-2 px-3">Medium UTM</th>
                  <th className="py-2 px-3 text-right">Clics</th>
                  <th className="py-2 px-3 text-right">Partages</th>
                  <th className="py-2 pl-3 text-right">Part</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {trafficSources.map((row) => (
                  <tr key={row.key} className="hover:bg-white/[0.03]">
                    <td className="py-2.5 pr-3 font-bold text-white">{row.label}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          row.sourceType === 'social'
                            ? 'bg-[#8A2BE2]/25 text-[#DCB8FF] border border-[#8A2BE2]/40'
                            : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                        }`}
                      >
                        {row.sourceType === 'social' ? 'Social' : 'Site'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-gray-300">
                      {row.medium}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-white tabular-nums">
                      {row.clicks}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-[#E9C349] tabular-nums">
                      {row.shares}
                    </td>
                    <td className="py-2.5 pl-3 text-right font-mono text-emerald-400 tabular-nums">
                      {row.percent}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};
