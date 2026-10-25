import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Calendar,
  Clock,
  MapPin,
  Sparkles,
  Ticket,
  ArrowRight,
  Maximize2,
  Navigation,
  LocateFixed,
  Loader2,
  AlertCircle,
  Compass,
} from 'lucide-react';
import { EventItem } from '../types';

// Coordonnées GPS officielles des villes principales du Sénégal
const CITY_COORDINATES: Record<string, { center: [number, number]; zoom: number }> = {
  All: { center: [14.65, -17.15], zoom: 9 },
  Thiès: { center: [14.7910, -16.9359], zoom: 13 },
  Dakar: { center: [14.6928, -17.4467], zoom: 12 },
  Mbour: { center: [14.4220, -16.9638], zoom: 13 },
  Saly: { center: [14.4433, -17.0278], zoom: 14 },
};

// Coordonnées par défaut par ville pour les événements sans GPS précis
const DEFAULT_COORDS_BY_CITY: Record<string, [number, number]> = {
  Thiès: [14.7910, -16.9359],
  Dakar: [14.6928, -17.4467],
  Mbour: [14.4220, -16.9638],
  Saly: [14.4433, -17.0278],
  Autre: [14.7910, -16.9359],
};

// Clé API CARTO pour les tuiles de fond de carte (Dark Matter)
const CARTO_API_KEY =
  (import.meta as any).env?.VITE_CARTO_API_KEY ||
  'cb1_4uey_1_40c81e60e427983a6f222d41';

const CARTO_DARK_MATTER_URL = `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${CARTO_API_KEY}`;

/**
 * Création d'icônes Leaflet personnalisées (Nocturnal Elegance)
 * Pins Violets (#8A2BE2) pour les soirées standards et Dorés (#E9C349) pour les événements VIP
 */
const createCustomMarkerIcon = (isVipOrExclusive: boolean = false) => {
  const primaryColor = isVipOrExclusive ? '#E9C349' : '#8A2BE2';
  const shadowColor = isVipOrExclusive ? 'rgba(233,195,73,0.45)' : 'rgba(138,43,226,0.55)';
  const pulseClass = isVipOrExclusive ? 'border-[#E9C349]/40' : 'border-[#8A2BE2]/40';

  const html = `
    <div style="position: relative; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
      <div style="position: absolute; inset: 0; border-radius: 9999px; background-color: ${primaryColor}; opacity: 0.25; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
      <div style="position: relative; width: 30px; height: 30px; border-radius: 9999px; background: linear-gradient(135deg, ${primaryColor}, #121212); border: 2px solid #ffffff; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px ${shadowColor};">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
          <circle cx="12" cy="10" r="3"></circle>
        </svg>
      </div>
      <div style="position: absolute; bottom: -4px; width: 6px; height: 6px; border-radius: 50%; background-color: ${primaryColor};"></div>
    </div>
  `;

  return L.divIcon({
    className: 'custom-leaflet-marker-element',
    html,
    iconSize: [38, 38],
    iconAnchor: [19, 36],
    popupAnchor: [0, -36],
  });
};

/**
 * Icône spéciale pour la position de l'utilisateur ("Autour de moi")
 */
const createUserLocationMarkerIcon = () => {
  const html = `
    <div style="position: relative; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center;">
      <div style="position: absolute; inset: 0; border-radius: 9999px; background-color: #1DC3F4; opacity: 0.35; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
      <div style="position: relative; width: 24px; height: 24px; border-radius: 9999px; background: linear-gradient(135deg, #1DC3F4, #0088cc); border: 3px solid #ffffff; box-shadow: 0 0 16px rgba(29, 195, 244, 0.9); display: flex; align-items: center; justify-content: center;">
        <div style="width: 6px; height: 6px; border-radius: 50%; background-color: #ffffff;"></div>
      </div>
    </div>
  `;
  return L.divIcon({
    className: 'custom-user-location-marker',
    html,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
    popupAnchor: [0, -21],
  });
};

/**
 * Sous-composant pour animer le recentrage fluide de la carte lors d'un changement de filtre
 */
const MapRecenterController: React.FC<{ center: [number, number]; zoom: number }> = ({ center, zoom }) => {
  const map = useMap();

  useEffect(() => {
    map.flyTo(center, zoom, {
      duration: 1.2,
      easeLinearity: 0.25,
    });
  }, [center, zoom, map]);

  return null;
};

/**
 * Contrôleur pour animer le vol direct vers la position de l'utilisateur
 */
const UserLocationFlyController: React.FC<{ target: [number, number] | null }> = ({ target }) => {
  const map = useMap();

  useEffect(() => {
    if (target) {
      map.flyTo(target, 14, {
        duration: 1.5,
        easeLinearity: 0.25,
      });
    }
  }, [target, map]);

  return null;
};

interface MapViewProps {
  events: EventItem[];
  selectedCity: string;
  onSelectCity: (city: string) => void;
  onSelectEvent: (event: EventItem) => void;
}

export const MapView: React.FC<MapViewProps> = ({
  events,
  selectedCity,
  onSelectCity,
  onSelectEvent,
}) => {
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);

  const handleLocateMe = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setLocationError("La géolocalisation n'est pas disponible sur votre navigateur.");
      return;
    }
    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords: [number, number] = [
          position.coords.latitude,
          position.coords.longitude,
        ];
        setUserLocation(coords);
        setFlyTarget(coords);
        setIsLocating(false);
      },
      (err) => {
        setIsLocating(false);
        if (err.code === 1) {
          setLocationError("Veuillez autoriser l'accès GPS dans votre navigateur pour situer les soirées autour de vous.");
        } else {
          setLocationError("Impossible de détecter votre position GPS. Vérifiez vos autorisations.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  };

  // Détermination de la vue actuelle (centre et zoom)
  const currentView = useMemo(() => {
    return CITY_COORDINATES[selectedCity] || CITY_COORDINATES.All;
  }, [selectedCity]);

  // Calcul des coordonnées précises pour chaque événement (avec léger décalage si même ville)
  const eventsWithCoordinates = useMemo(() => {
    const cityOffsetsCount: Record<string, number> = {};

    return events.map((event) => {
      let lat: number;
      let lng: number;

      if (event.coordinates && event.coordinates.lat && event.coordinates.lng) {
        lat = event.coordinates.lat;
        lng = event.coordinates.lng;
      } else {
        const baseCoords = DEFAULT_COORDS_BY_CITY[event.city] || DEFAULT_COORDS_BY_CITY.Thiès;
        const count = cityOffsetsCount[event.city] || 0;
        cityOffsetsCount[event.city] = count + 1;

        // Décalage en spirale déterministe pour éviter la superposition exacte
        const angle = count * 1.25;
        const radius = 0.007 * Math.sqrt(count);
        lat = baseCoords[0] + radius * Math.cos(angle);
        lng = baseCoords[1] + radius * Math.sin(angle);
      }

      return {
        event,
        position: [lat, lng] as [number, number],
        isVip: Boolean(event.vipAvailable || event.isExclusive),
      };
    });
  }, [events]);

  const citiesList = ['All', 'Thiès', 'Mbour', 'Saly', 'Dakar'];

  return (
    <div className="glass-panel rounded-3xl p-4 sm:p-6 relative overflow-hidden space-y-4 border border-white/10 shadow-2xl">
      {/* Barre d'en-tête de la carte */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#8A2BE2]/20 text-[#DCB8FF] border border-[#8A2BE2]/30">
              <Navigation className="w-4 h-4 text-[#E9C349]" />
            </span>
            <h3 className="font-heading font-bold text-base sm:text-lg text-white">
              Carte Interactive des Soirées & Galas
            </h3>
          </div>
          <p className="text-xs text-gray-400">
            Zoomez, naviguez et cliquez sur les marqueurs pour découvrir et réserver vos billets au Sénégal.
          </p>
        </div>

        {/* Badge récapitulatif */}
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#8A2BE2]/15 text-[#DCB8FF] border border-[#8A2BE2]/30 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{events.length} événement(s) géolocalisé(s)</span>
          </span>
        </div>
      </div>

      {/* Filtres par Région au-dessus de la carte & Bouton Autour de moi */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {/* Bouton GPS "Autour de moi" */}
        <button
          type="button"
          onClick={handleLocateMe}
          disabled={isLocating}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 shrink-0 ${
            userLocation
              ? 'bg-[#1DC3F4] text-[#07131D] shadow-md shadow-[#1DC3F4]/30'
              : 'bg-[#181818] text-[#1DC3F4] hover:bg-[#252525] border border-[#1DC3F4]/40 hover:border-[#1DC3F4]'
          }`}
          title="Géolocaliser les soirées à proximité de votre position"
        >
          {isLocating ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <LocateFixed className="w-3.5 h-3.5" />
          )}
          <span>{isLocating ? 'Recherche GPS...' : userLocation ? 'Autour de moi (Actif)' : 'Autour de moi'}</span>
        </button>

        <div className="w-[1px] h-5 bg-white/10 shrink-0 mx-1" />

        {citiesList.map((city) => (
          <button
            key={city}
            type="button"
            onClick={() => onSelectCity(city)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 shrink-0 ${
              selectedCity === city
                ? 'bg-[#E9C349] text-[#241A00] shadow-md shadow-[#E9C349]/20'
                : 'bg-[#181818] text-gray-300 hover:bg-[#252525] hover:text-white border border-white/5'
            }`}
          >
            {city !== 'All' && <MapPin className="w-3.5 h-3.5 text-[#8A2BE2]" />}
            <span>{city === 'All' ? 'Toutes Régions (Sénégal)' : city}</span>
          </button>
        ))}
      </div>

      {/* Message d'erreur géolocalisation éventuel */}
      {locationError && (
        <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>{locationError}</span>
          </div>
          <button
            type="button"
            onClick={() => setLocationError(null)}
            className="text-amber-400 hover:text-white text-[11px] font-bold underline"
          >
            Fermer
          </button>
        </div>
      )}

      {/* Conteneur de la Carte Leaflet */}
      <div className="relative w-full h-[450px] sm:h-[520px] rounded-2xl overflow-hidden border border-white/10 shadow-inner z-10 group">
        {/* Bouton Flottant Rapide "Autour de moi" sur la carte */}
        <button
          type="button"
          onClick={handleLocateMe}
          disabled={isLocating}
          className="absolute top-4 right-4 z-[400] p-3 rounded-2xl bg-[#141414]/90 backdrop-blur-md border border-white/20 text-[#1DC3F4] hover:bg-[#1DC3F4] hover:text-[#07131D] shadow-xl transition-all active:scale-95 flex items-center gap-2 text-xs font-bold font-heading"
          title="Centrer la carte sur ma position actuelle"
        >
          {isLocating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <LocateFixed className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">Me Localiser</span>
        </button>

        <MapContainer
          center={currentView.center}
          zoom={currentView.zoom}
          scrollWheelZoom={true}
          className="w-full h-full"
          style={{ height: '100%', width: '100%', background: '#0a0a0a' }}
        >
          {/* Controller de recentrage animé par ville */}
          <MapRecenterController center={currentView.center} zoom={currentView.zoom} />

          {/* Controller de recentrage animé sur la géolocalisation utilisateur */}
          <UserLocationFlyController target={flyTarget} />

          {/* CartoDB Dark Matter : Fond de carte sombre premium avec clé API CARTO */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url={CARTO_DARK_MATTER_URL}
            subdomains="abcd"
            maxZoom={19}
          />

          {/* Marqueur de l'Utilisateur s'il a cliqué "Autour de moi" */}
          {userLocation && (
            <Marker position={userLocation} icon={createUserLocationMarkerIcon()}>
              <Popup className="custom-nocturnal-popup" minWidth={220} maxWidth={260}>
                <div className="p-3 bg-[#181818] text-white space-y-2 text-center">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/20 text-[#1DC3F4] text-[11px] font-bold border border-sky-500/30">
                    <LocateFixed className="w-3.5 h-3.5" />
                    <span>Vous êtes ici</span>
                  </div>
                  <p className="text-xs text-gray-200 font-medium leading-snug">
                    Position GPS détectée avec succès.
                  </p>
                  <p className="text-[10px] text-[#DCB8FF]">
                    Naviguez sur la carte pour explorer les soirées autour de vous à Thiès, Dakar et sur la Petite Côte.
                  </p>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Marqueurs interactifs pour chaque événement */}
          {eventsWithCoordinates.map(({ event, position, isVip }) => (
            <Marker
              key={event.id}
              position={position}
              icon={createCustomMarkerIcon(isVip)}
            >
              <Popup className="custom-nocturnal-popup" minWidth={260} maxWidth={300}>
                <div className="p-3 space-y-2.5 bg-[#181818] text-white">
                  {/* Miniature Poster */}
                  {event.posterUrl && (
                    <div className="relative w-full h-28 rounded-xl overflow-hidden border border-white/10">
                      <img
                        src={event.posterUrl}
                        alt={event.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-sm text-[10px] font-bold text-[#DCB8FF] border border-white/10">
                        {event.category}
                      </div>
                      {isVip && (
                        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-[#E9C349] text-[#241A00] text-[10px] font-extrabold shadow-sm flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5" />
                          <span>VIP</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Titre et Détails */}
                  <div>
                    <h4 className="font-heading font-bold text-sm text-white line-clamp-1 leading-snug">
                      {event.title}
                    </h4>
                    <p className="text-[11px] text-[#DCB8FF] font-semibold mt-0.5">
                      {event.promoter.name}
                    </p>
                  </div>

                  {/* Date, Heure & Lieu */}
                  <div className="space-y-1 text-[11px] text-gray-300">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#E9C349] shrink-0" />
                      <span>{event.date} à {event.time}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#8A2BE2] shrink-0" />
                      <span className="truncate">
                        {event.venue}{event.quartier ? ` (${event.quartier})` : ''}, {event.city}
                      </span>
                    </div>
                  </div>

                  {/* Prix et Bouton de Réservation */}
                  <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-gray-400 block">À partir de</span>
                      <span className="text-sm font-extrabold text-[#E9C349] font-heading">
                        {event.price.toLocaleString('fr-FR')} F
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectEvent(event)}
                      className="btn-primary-glow px-3 py-1.5 rounded-xl text-xs font-bold font-heading uppercase tracking-wider flex items-center gap-1 shadow-md hover:scale-105 transition-transform"
                    >
                      <span>Voir</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Légende en bas de carte */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-gray-400 pt-1">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#8A2BE2] border border-white inline-block shadow-sm" />
            <span>Soirée Standard</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#E9C349] border border-white inline-block shadow-sm" />
            <span>Événement VIP / Prestige</span>
          </div>
        </div>

        <div className="text-[11px] text-gray-500">
          Source cartographique : CartoDB Dark Matter & OpenStreetMap
        </div>
      </div>
    </div>
  );
};
