import React, { useEffect, useMemo, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Tooltip,
  CircleMarker,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  ShieldAlert,
  Store,
  QrCode,
  Activity,
  Flame,
  Compass,
} from 'lucide-react';
import {
  ConnectionLogRecord,
  EventAnalyticsRecord,
  EventItem,
  SalesAgent,
  ScanStation,
} from '../types';
import {
  LatLngTuple,
  SENEGAL_CENTER,
  SENEGAL_DEFAULT_ZOOM,
  resolveCityCoordinates,
  resolveSenegalCoordinates,
} from '../data/senegalGeo';

const CARTO_API_KEY =
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_CARTO_API_KEY ||
  'cb1_4uey_1_40c81e60e427983a6f222d41';

const CARTO_DARK_MATTER_URL = `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${CARTO_API_KEY}`;

const FOCUS_PRESETS: ReadonlyArray<{ id: string; label: string; center: LatLngTuple; zoom: number }> = [
  { id: 'senegal', label: 'Sénégal', center: SENEGAL_CENTER, zoom: SENEGAL_DEFAULT_ZOOM },
  { id: 'thies', label: 'Thiès', center: [14.791, -16.9359], zoom: 12 },
  { id: 'dakar', label: 'Dakar', center: [14.6928, -17.4467], zoom: 11 },
  { id: 'petite_cote', label: 'Mbour / Saly', center: [14.432, -16.995], zoom: 12 },
];

type MarkerTheme = 'seller' | 'scanner' | 'connection' | 'suspicious';

const MARKER_THEMES: Record<
  MarkerTheme,
  { color: string; glow: string; label: string }
> = {
  seller: {
    color: '#8A2BE2',
    glow: 'rgba(138, 43, 226, 0.7)',
    label: 'Vendeur',
  },
  scanner: {
    color: '#E9C349',
    glow: 'rgba(233, 195, 73, 0.7)',
    label: 'Scanner',
  },
  connection: {
    color: '#06B6D4',
    glow: 'rgba(6, 182, 212, 0.7)',
    label: 'Connexion',
  },
  suspicious: {
    color: '#EF4444',
    glow: 'rgba(239, 68, 68, 0.85)',
    label: 'Log Suspect',
  },
};

const createCyberMarkerIcon = (theme: MarkerTheme): L.DivIcon => {
  const { color, glow } = MARKER_THEMES[theme];
  const size = theme === 'suspicious' ? 28 : 22;
  const html = `
    <div style="position:relative;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;cursor:pointer;">
      <span style="position:absolute;inset:0;border-radius:9999px;background:${color};opacity:0.32;animation:ping 2.2s cubic-bezier(0,0,0.2,1) infinite;"></span>
      <span style="position:relative;width:${Math.round(size * 0.56)}px;height:${Math.round(
        size * 0.56
      )}px;border-radius:9999px;background:${color};border:2px solid #ffffff;box-shadow:0 0 12px ${glow};"></span>
    </div>
  `;

  return L.divIcon({
    className: `senegal-cyber-marker-${theme}`,
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
};

const MapFocusController: React.FC<{ center: LatLngTuple; zoom: number }> = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.0, easeLinearity: 0.25 });
  }, [center, zoom, map]);
  return null;
};

interface SenegalMapProps {
  salesAgents: SalesAgent[];
  scanStations: ScanStation[];
  events: EventItem[];
  connectionLogs: ConnectionLogRecord[];
  analytics: EventAnalyticsRecord[];
  topOverlay?: React.ReactNode;
}

interface HeatBucket {
  cityKey: string;
  cityLabel: string;
  coords: LatLngTuple;
  clicks: number;
  shares: number;
  radius: number;
  color: string;
  fillOpacity: number;
  intensityLabel: 'Fort volume' | 'Volume moyen' | 'Faible volume';
}

export const SenegalMap: React.FC<SenegalMapProps> = ({
  salesAgents,
  scanStations,
  events,
  connectionLogs,
  analytics,
  topOverlay,
}) => {
  const [activePreset, setActivePreset] = useState<string>('senegal');
  const [showSellers, setShowSellers] = useState<boolean>(true);
  const [showScanners, setShowScanners] = useState<boolean>(true);
  const [showConnections, setShowConnections] = useState<boolean>(true);
  const [showHeatmap, setShowHeatmap] = useState<boolean>(true);

  const currentPreset = useMemo(
    () => FOCUS_PRESETS.find((p) => p.id === activePreset) || FOCUS_PRESETS[0],
    [activePreset]
  );

  const sellerIcon = useMemo(() => createCyberMarkerIcon('seller'), []);
  const scannerIcon = useMemo(() => createCyberMarkerIcon('scanner'), []);
  const connectionIcon = useMemo(() => createCyberMarkerIcon('connection'), []);
  const suspiciousIcon = useMemo(() => createCyberMarkerIcon('suspicious'), []);

  const eventById = useMemo(() => {
    const map = new Map<string, EventItem>();
    for (const evt of events) {
      if (evt?.id) map.set(evt.id, evt);
    }
    return map;
  }, [events]);

  // 1. Marqueurs Guichets mobiles (sales_agents)
  const sellerMarkers = useMemo(() => {
    const bucketCount: Record<string, number> = {};
    return salesAgents.map((agent) => {
      const linkedEvent = eventById.get(agent.eventId);
      const city = linkedEvent?.city || 'Thiès';
      const bucketKey = `${city}-${agent.quartier || agent.adresse || 'default'}`.toLowerCase();
      const idx = bucketCount[bucketKey] || 0;
      bucketCount[bucketKey] = idx + 1;

      const coords = resolveSenegalCoordinates(
        {
          latitude: agent.latitude,
          longitude: agent.longitude,
          quartier: agent.quartier,
          adresse: agent.adresse,
          city,
        },
        idx
      );
      const ticketsSummary =
        agent.allocatedCount > 0
          ? `${agent.soldCount}/${agent.allocatedCount} billets`
          : `${agent.soldCount} billets`;

      return {
        agent,
        coords,
        city,
        hoverLabel: `${agent.pointDeVente} - ${agent.quartier || city} - ${ticketsSummary}`,
      };
    });
  }, [salesAgents, eventById]);

  // 2. Marqueurs Postes de contrôle (scan_stations ou lieux d'événements)
  const scannerMarkers = useMemo(() => {
    const bucketCount: Record<string, number> = {};
    if (scanStations.length > 0) {
      return scanStations.map((station) => {
        const linkedEvent = eventById.get(station.eventId);
        const city = linkedEvent?.city || 'Thiès';
        const quartier = linkedEvent?.quartier || linkedEvent?.venue || '';
        const bucketKey = `${city}-${quartier}`.toLowerCase();
        const idx = bucketCount[bucketKey] || 0;
        bucketCount[bucketKey] = idx + 1;

        const coords = resolveSenegalCoordinates(
          {
            latitude: linkedEvent?.coordinates?.lat,
            longitude: linkedEvent?.coordinates?.lng,
            quartier: linkedEvent?.quartier,
            city,
          },
          idx,
          0.0035
        );

        return {
          id: station.id,
          name: station.name,
          eventTitle: station.eventTitle || linkedEvent?.title || 'Événement',
          venueLabel: linkedEvent?.venue ? `${linkedEvent.venue}, ${city}` : city,
          scansCount: station.scansCount,
          isActive: station.isActive,
          accessCode: station.accessCode,
          coords,
        };
      });
    }

    // Repli sur les lieux d'événements actifs s'il n'y a pas encore de scan_stations
    return events
      .filter((e) => e.status === 'approved' && !e.isDeleted)
      .slice(0, 15)
      .map((evt) => {
        const bucketKey = `${evt.city}-${evt.quartier || evt.venue}`.toLowerCase();
        const idx = bucketCount[bucketKey] || 0;
        bucketCount[bucketKey] = idx + 1;
        const coords = resolveSenegalCoordinates(
          {
            latitude: evt.coordinates?.lat,
            longitude: evt.coordinates?.lng,
            quartier: evt.quartier,
            city: evt.city,
          },
          idx,
          0.0035
        );
        return {
          id: `evt-loc-${evt.id}`,
          name: `Lieu : ${evt.venue}`,
          eventTitle: evt.title,
          venueLabel: `${evt.venue}${evt.quartier ? ` (${evt.quartier})` : ''}, ${evt.city}`,
          scansCount: 0,
          isActive: true,
          accessCode: 'EVENT-VENUE',
          coords,
        };
      });
  }, [scanStations, events, eventById]);

  // 3. Marqueurs Journal des connexions (connection_logs)
  const connectionMarkers = useMemo(() => {
    const bucketCount: Record<string, number> = {};
    return connectionLogs.slice(0, 40).map((log) => {
      const cityKey = `${log.country || 'Sénégal'}-${log.city || 'Thiès'}`.toLowerCase();
      const idx = bucketCount[cityKey] || 0;
      bucketCount[cityKey] = idx + 1;
      const coords = resolveSenegalCoordinates(
        {
          city: log.city,
          country: log.country,
        },
        idx,
        0.009
      );

      return {
        log,
        coords,
      };
    });
  }, [connectionLogs]);

  // 4. Couche Heatmap / Bulles de chaleur agrégées par ville (event_analytics)
  const heatmapBuckets = useMemo<HeatBucket[]>(() => {
    const byCity = new Map<string, { label: string; clicks: number; shares: number }>();

    for (const row of analytics) {
      const evt = eventById.get(row.eventId);
      const rawCity = row.city || evt?.city || 'Thiès';
      const resolved = resolveCityCoordinates(rawCity, 'Sénégal');
      const key = resolved.label.toLowerCase();
      const existing = byCity.get(key) || { label: resolved.label, clicks: 0, shares: 0 };
      if (row.action === 'click') {
        existing.clicks += 1;
      } else {
        existing.shares += 1;
      }
      byCity.set(key, existing);
    }

    const entries = Array.from(byCity.entries()).filter(([, v]) => v.clicks > 0 || v.shares > 0);
    if (entries.length === 0) return [];

    const maxClicks = Math.max(1, ...entries.map(([, v]) => v.clicks || v.shares));

    return entries.map(([cityKey, stats]) => {
      const volume = stats.clicks > 0 ? stats.clicks : stats.shares;
      const ratio = volume / maxClicks;
      const resolved = resolveCityCoordinates(stats.label, 'Sénégal');

      let color = '#FACC15'; // Jaune : faible
      let intensityLabel: HeatBucket['intensityLabel'] = 'Faible volume';
      let fillOpacity = 0.35;

      if (ratio >= 0.66 || volume >= 50) {
        color = '#EF4444'; // Rouge : fort
        intensityLabel = 'Fort volume';
        fillOpacity = 0.52;
      } else if (ratio >= 0.33 || volume >= 15) {
        color = '#F97316'; // Orange : moyen
        intensityLabel = 'Volume moyen';
        fillOpacity = 0.44;
      }

      const radius = Math.min(44, Math.max(15, 14 + Math.sqrt(volume) * 4.8));

      return {
        cityKey,
        cityLabel: stats.label,
        coords: resolved.coords,
        clicks: stats.clicks,
        shares: stats.shares,
        radius,
        color,
        fillOpacity,
        intensityLabel,
      };
    });
  }, [analytics, eventById]);

  const suspiciousCount = useMemo(
    () => connectionLogs.filter((l) => l.isSuspicious).length,
    [connectionLogs]
  );

  return (
    <div className="space-y-3">
      {/* Pastilles KPI optionnelles placées au-dessus de la carte */}
      {topOverlay && <div>{topOverlay}</div>}

      <div className="relative rounded-2xl overflow-hidden bg-[#0A0A0A] border border-white/10 shadow-2xl">
        {/* Barre supérieure Cyber-Command Center */}
        <div className="absolute top-3 left-3 right-3 z-[400] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
          <div className="pointer-events-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0A0A0A]/85 backdrop-blur-md border border-[#8A2BE2]/40 shadow-lg">
            <Compass className="w-4 h-4 text-[#E9C349]" />
            <span className="font-heading text-xs font-extrabold text-white tracking-wide">
              Command Center Sénégal
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
            {suspiciousCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-300 text-[10px] font-bold">
                <ShieldAlert className="w-3 h-3" />
                {suspiciousCount} alerte{suspiciousCount > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Focus Rapide Villes */}
          <div className="pointer-events-auto flex items-center gap-1 bg-[#0A0A0A]/85 backdrop-blur-md p-1 rounded-xl border border-white/10 shadow-lg">
            {FOCUS_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setActivePreset(preset.id)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activePreset === preset.id
                    ? 'bg-[#8A2BE2] text-white shadow-sm'
                    : 'text-gray-300 hover:text-white hover:bg-white/10'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Carte Leaflet Dark Matter */}
        <div className="h-[50vh] min-h-[340px] sm:h-[400px] w-full bg-[#0A0A0A]">
          <MapContainer
            center={SENEGAL_CENTER}
            zoom={SENEGAL_DEFAULT_ZOOM}
            scrollWheelZoom={true}
            className="h-full w-full !rounded-2xl"
            style={{ background: '#0A0A0A' }}
          >
            <MapFocusController center={currentPreset.center} zoom={currentPreset.zoom} />
            <TileLayer
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              url={CARTO_DARK_MATTER_URL}
            />

            {/* Couche 4 : Heatmap / Bulles de Chaleur des Clics */}
            {showHeatmap &&
              heatmapBuckets.map((bucket) => (
                <CircleMarker
                  key={`heat-${bucket.cityKey}`}
                  center={bucket.coords}
                  radius={bucket.radius}
                  pathOptions={{
                    color: bucket.color,
                    weight: 1.5,
                    opacity: 0.85,
                    fillColor: bucket.color,
                    fillOpacity: bucket.fillOpacity,
                  }}
                >
                  <Tooltip direction="top" opacity={0.96}>
                    <div className="px-2.5 py-1.5 text-[11px] bg-[#14131B] text-white rounded-lg border border-white/15">
                      <p className="font-heading font-extrabold text-[#E9C349]">
                        {bucket.cityLabel} — {bucket.intensityLabel}
                      </p>
                      <p className="text-gray-200">
                        {bucket.clicks} clic(s) • {bucket.shares} partage(s)
                      </p>
                    </div>
                  </Tooltip>
                </CircleMarker>
              ))}

            {/* Couche 1 : Points de vente (Guichets mobiles — Violet) */}
            {showSellers &&
              sellerMarkers.map(({ agent, coords, city, hoverLabel }) => (
                <Marker key={`seller-${agent.id}`} position={coords} icon={sellerIcon}>
                  <Tooltip direction="top" offset={[0, -10]} opacity={0.95}>
                    <div className="px-2.5 py-1 text-[11px] font-bold text-white bg-[#171224] border border-[#8A2BE2]/60 rounded-lg">
                      {hoverLabel}
                    </div>
                  </Tooltip>
                  <Popup>
                    <div className="p-3 min-w-[210px] space-y-1.5 text-xs">
                      <div className="flex items-center gap-1.5 text-[#DCB8FF] font-heading font-extrabold">
                        <Store className="w-3.5 h-3.5 text-[#8A2BE2]" />
                        <span>{agent.pointDeVente}</span>
                      </div>
                      <p className="text-gray-300">
                        Gérant : <strong className="text-white">{agent.gerantName}</strong>
                      </p>
                      <p className="text-gray-300">
                        Secteur : {agent.quartier || agent.adresse || city} ({city})
                      </p>
                      <p className="text-[#E9C349] font-bold">
                        {agent.soldCount} vendus / {agent.allocatedCount} alloués
                      </p>
                      <p className="text-[10px] text-gray-300">Tél : {agent.telephone}</p>
                    </div>
                  </Popup>
                </Marker>
              ))}

            {/* Couche 2 : Postes de contrôle / Scanners — Doré */}
            {showScanners &&
              scannerMarkers.map((station) => (
                <Marker key={`scanner-${station.id}`} position={station.coords} icon={scannerIcon}>
                  <Tooltip direction="top" offset={[0, -10]} opacity={0.95}>
                    <div className="px-2.5 py-1 text-[11px] font-bold text-white bg-[#1C180E] border border-[#E9C349]/60 rounded-lg">
                      {station.name} • {station.scansCount} scan(s)
                    </div>
                  </Tooltip>
                  <Popup>
                    <div className="p-3 min-w-[210px] space-y-1.5 text-xs">
                      <div className="flex items-center gap-1.5 text-[#E9C349] font-heading font-extrabold">
                        <QrCode className="w-3.5 h-3.5" />
                        <span>{station.name}</span>
                      </div>
                      <p className="text-white font-semibold">{station.eventTitle}</p>
                      <p className="text-gray-300">{station.venueLabel}</p>
                      <p className="text-emerald-400 font-bold">
                        {station.scansCount} entrée(s) scannée(s)
                      </p>
                    </div>
                  </Popup>
                </Marker>
              ))}

            {/* Couche 3 : Journal des connexions — Cyan / Rouge si suspect */}
            {showConnections &&
              connectionMarkers.map(({ log, coords }) => (
                <Marker
                  key={`conn-${log.id}`}
                  position={coords}
                  icon={log.isSuspicious ? suspiciousIcon : connectionIcon}
                >
                  <Tooltip direction="top" offset={[0, -10]} opacity={0.95}>
                    <div className="px-2.5 py-1 text-[11px] font-bold text-white bg-[#0F1720] border border-cyan-400/50 rounded-lg">
                      {log.isSuspicious ? '⚠️ Suspect : ' : ''}
                      {log.city || 'Sénégal'} ({log.ipAddress || 'IP'})
                    </div>
                  </Tooltip>
                  <Popup>
                    <div className="p-3 min-w-[220px] space-y-1.5 text-xs">
                      <div
                        className={`flex items-center gap-1.5 font-heading font-extrabold ${
                          log.isSuspicious ? 'text-red-400' : 'text-cyan-300'
                        }`}
                      >
                        {log.isSuspicious ? (
                          <ShieldAlert className="w-3.5 h-3.5" />
                        ) : (
                          <Activity className="w-3.5 h-3.5" />
                        )}
                        <span>{log.isSuspicious ? 'Connexion Suspecte' : 'Connexion Enregistrée'}</span>
                      </div>
                      <p className="text-white font-semibold truncate">{log.email}</p>
                      <p className="text-gray-300">
                        IP : <span className="font-mono text-cyan-300">{log.ipAddress || 'Inconnue'}</span>
                      </p>
                      <p className="text-gray-300">
                        Localisation : {log.city || 'Thiès'}, {log.country || 'Sénégal'}
                      </p>
                      {log.deviceFingerprint && (
                        <p className="text-[10px] text-gray-300 font-mono truncate">
                          Empreinte : {log.deviceFingerprint}
                        </p>
                      )}
                      {log.userAgent && (
                        <p className="text-[10px] text-gray-300 line-clamp-2">{log.userAgent}</p>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ))}
          </MapContainer>
        </div>

        {/* Légende en bas à gauche (Marqueurs + Carte de Chaleur des Clics) */}
        <div className="absolute bottom-3 left-3 z-[400] max-w-[92%] sm:max-w-md bg-[#0A0A0A]/90 backdrop-blur-md border border-white/15 rounded-2xl p-2.5 sm:p-3 shadow-2xl space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowSellers((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                showSellers
                  ? 'bg-[#8A2BE2]/25 border-[#8A2BE2]/60 text-white'
                  : 'bg-white/5 border-white/10 text-gray-400 opacity-60'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#8A2BE2] border border-white/80" />
              <span>Vendeurs ({sellerMarkers.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setShowScanners((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                showScanners
                  ? 'bg-[#E9C349]/20 border-[#E9C349]/60 text-[#E9C349]'
                  : 'bg-white/5 border-white/10 text-gray-400 opacity-60'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#E9C349] border border-white/80" />
              <span>Scanners ({scannerMarkers.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setShowConnections((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                showConnections
                  ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-300'
                  : 'bg-white/5 border-white/10 text-gray-400 opacity-60'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 border border-white/80" />
              <span>Connexions ({connectionMarkers.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setShowHeatmap((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                showHeatmap
                  ? 'bg-orange-500/20 border-orange-400/60 text-orange-300'
                  : 'bg-white/5 border-white/10 text-gray-400 opacity-60'
              }`}
            >
              <Flame className="w-3 h-3 text-orange-400" />
              <span>Heatmap ({heatmapBuckets.length})</span>
            </button>
          </div>

          {showHeatmap && (
            <div className="pt-1.5 border-t border-white/10 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-gray-200">
              <span className="font-heading font-extrabold text-[#E9C349] uppercase tracking-wider">
                Carte de Chaleur des Clics :
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
                <span>Fort</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#F97316]" />
                <span>Moyen</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FACC15]" />
                <span>Faible</span>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
