import React, { useState } from 'react';
import { Play, Disc3, Music2, ExternalLink, Volume2, X } from 'lucide-react';

interface SpotifyVinylPlayerProps {
  spotifyUrl: string;
  posterUrl?: string;
  eventTitle?: string;
  className?: string;
}

export const SpotifyVinylPlayer: React.FC<SpotifyVinylPlayerProps> = ({
  spotifyUrl,
  posterUrl,
  eventTitle = 'Ambiance Musicale',
  className = '',
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isIframeLoaded, setIsIframeLoaded] = useState(false);

  // Conversion URL Spotify standard en Embed officielle
  const getSpotifyEmbedUrl = (url: string): string => {
    if (!url) return '';
    try {
      const trimmed = url.trim();
      const match = trimmed.match(/open\.spotify\.com\/(track|album|playlist|artist|show|episode)\/([a-zA-Z0-9]+)/i);
      if (match) {
        const type = match[1];
        const id = match[2];
        return `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`;
      }
      if (trimmed.includes('/embed/')) return trimmed;
      // Fallback si URL complète avec query params
      return trimmed.replace('open.spotify.com/', 'open.spotify.com/embed/');
    } catch {
      return url;
    }
  };

  const embedUrl = getSpotifyEmbedUrl(spotifyUrl);
  const defaultPoster = posterUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=600&auto=format&fit=crop';

  return (
    <div
      className={`relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#181622]/95 via-[#100F17]/90 to-[#0A0A0E]/95 border border-[#8A2BE2]/30 p-5 sm:p-6 shadow-2xl shadow-[#8A2BE2]/15 backdrop-blur-xl ${className}`}
    >
      {/* Header Titre & Badge */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#8A2BE2]/20 border border-[#8A2BE2]/40 flex items-center justify-center text-[#DCB8FF]">
            <Music2 className="w-4 h-4 animate-bounce" />
          </div>
          <div>
            <span className="text-[10px] font-heading font-extrabold uppercase tracking-widest text-[#E9C349] block">
              Bande-Son & Ambiance
            </span>
            <h4 className="text-sm sm:text-base font-heading font-bold text-white line-clamp-1">
              Plongez dans l'univers musical
            </h4>
          </div>
        </div>

        <a
          href={spotifyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1DB954]/15 hover:bg-[#1DB954]/30 text-[#1DB954] border border-[#1DB954]/30 text-xs font-semibold transition-all hover:scale-105 shrink-0"
          title="Ouvrir dans Spotify"
        >
          <Volume2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Spotify</span>
          <ExternalLink className="w-3 h-3 opacity-70" />
        </a>
      </div>

      {!isPlaying ? (
        /* VUE EFFET WOW : DISQUE VINYLE ROTATIF INTERACTIF (0 iframe = 0 impact de chargement) */
        <div
          onClick={() => setIsPlaying(true)}
          className="relative group cursor-pointer flex flex-col sm:flex-row items-center gap-6 p-4 rounded-2xl bg-black/40 border border-white/5 hover:border-[#8A2BE2]/50 transition-all duration-500 hover:shadow-2xl hover:shadow-[#8A2BE2]/20"
        >
          {/* Disque Vinyle Stylisé */}
          <div className="relative w-36 h-36 sm:w-44 sm:h-44 shrink-0 transition-transform duration-500 group-hover:scale-105">
            {/* Corps du vinyle noir brillant avec rainures concentriques */}
            <div
              className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#0a0a0a] via-[#1a1a1a] to-[#0a0a0a] border-4 border-[#252525] shadow-2xl flex items-center justify-center animate-[spin_12s_linear_infinite]"
              style={{
                boxShadow: '0 0 25px rgba(138, 43, 226, 0.35), inset 0 0 20px rgba(255,255,255,0.05)',
              }}
            >
              {/* Rainures vinyle */}
              <div className="absolute inset-2 rounded-full border border-white/10 opacity-60" />
              <div className="absolute inset-4 rounded-full border border-white/5 opacity-40" />
              <div className="absolute inset-6 rounded-full border border-white/10 opacity-50" />
              <div className="absolute inset-8 rounded-full border border-white/5 opacity-30" />

              {/* Pastille Centrale (Pochette de l'événement) */}
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 border-[#E9C349] shadow-lg">
                <img
                  src={defaultPoster}
                  alt={eventTitle}
                  className="w-full h-full object-cover"
                />
                {/* Trou central du vinyle */}
                <div className="absolute inset-0 m-auto w-3.5 h-3.5 rounded-full bg-black border border-white/40 shadow-inner" />
              </div>
            </div>

            {/* Bouton Play Central Doré en superposition */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#E9C349] to-[#F3D779] text-[#241A00] flex items-center justify-center shadow-xl shadow-black/80 transition-transform duration-300 group-hover:scale-115 border border-white/40">
                <Play className="w-5 h-5 fill-current ml-0.5" />
              </div>
            </div>
          </div>

          {/* Présentation & Appel à l'action */}
          <div className="flex-1 text-center sm:text-left space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#8A2BE2]/20 border border-[#8A2BE2]/40 text-[#DCB8FF] text-[10px] font-bold uppercase tracking-wider">
              <Disc3 className="w-3.5 h-3.5 animate-spin" />
              <span>Lecteur Haute Fidélité</span>
            </div>
            <h5 className="font-heading font-extrabold text-base sm:text-lg text-white group-hover:text-[#E9C349] transition-colors">
              Écouter l'extrait ou la playlist
            </h5>
            <p className="text-xs text-gray-300 leading-relaxed">
              Cliquez pour lancer le lecteur officiel Spotify et découvrir les morceaux phares prévus pour cet événement.
            </p>
            <div className="pt-2">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#E9C349] to-[#d6ad30] text-[#241A00] font-heading font-black text-xs uppercase tracking-wider shadow-lg group-hover:shadow-[#E9C349]/30 transition-all">
                <Play className="w-3.5 h-3.5 fill-current" />
                Lancer la lecture
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* VUE EMBED SPOTIFY OFFICIELLE (Lazy loadée à la demande) */
        <div className="relative rounded-2xl overflow-hidden border border-[#8A2BE2]/40 bg-black/60 shadow-2xl transition-all">
          {/* Barre de contrôle du lecteur */}
          <div className="flex items-center justify-between p-2.5 bg-[#14131A] border-b border-white/10 text-xs text-gray-300">
            <span className="flex items-center gap-1.5 text-xs text-[#DCB8FF] font-semibold">
              <Music2 className="w-3.5 h-3.5 text-[#1DB954]" />
              Lecteur Spotify actif
            </span>
            <button
              onClick={() => setIsPlaying(false)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold transition-all"
            >
              <X className="w-3 h-3" />
              Fermer le lecteur
            </button>
          </div>

          {/* Spinner de chargement le temps que l'iframe charge */}
          {!isIframeLoaded && (
            <div className="flex items-center justify-center h-40 bg-[#121118]">
              <div className="flex flex-col items-center gap-2">
                <span className="w-6 h-6 border-2 border-[#1DB954] border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-gray-400">Chargement de Spotify...</span>
              </div>
            </div>
          )}

          <iframe
            src={embedUrl}
            width="100%"
            height={embedUrl.includes('/track/') ? '152' : '352'}
            frameBorder="0"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            onLoad={() => setIsIframeLoaded(true)}
            className={`w-full transition-opacity duration-500 ${isIframeLoaded ? 'opacity-100' : 'opacity-0 h-0'}`}
          />
        </div>
      )}
    </div>
  );
};
