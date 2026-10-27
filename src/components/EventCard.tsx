import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Sparkles, Crown, ShieldCheck, Clock, Eye, Radio } from 'lucide-react';
import { EventItem } from '../types';
import { CountdownTimer } from './CountdownTimer';
import { getEventEndDatetime } from '../services/supabase';
import { getOptimizedImageUrl } from '../utils/imageOptimizer';

interface EventCardProps {
  event: EventItem;
  variant?: 'featured' | 'list' | 'grid';
  onSelect: (event: EventItem) => void;
}

export const EventCard: React.FC<EventCardProps> = ({
  event,
  variant = 'grid',
  onSelect,
}) => {
  const now = Date.now();
  const startMs = event.datetimeIso ? new Date(event.datetimeIso).getTime() : NaN;
  const endMs = getEventEndDatetime(event).getTime();

  // Événement en cours : date actuelle entre le début et la fin estimée (gestion nuit traversant minuit)
  const isOngoing = !isNaN(startMs) && now >= startMs && now <= endMs;

  // Vérifier si les ventes sont programmées dans le futur
  const isSalesUpcoming = Boolean(
    !isOngoing && event.salesOpenAt && new Date(event.salesOpenAt).getTime() > now
  );

  if (variant === 'featured') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        onClick={() => onSelect(event)}
        className="relative group cursor-pointer flex-shrink-0 w-80 sm:w-96 h-64 rounded-2xl overflow-hidden border border-white/10 shadow-xl transition-shadow duration-300 hover:shadow-2xl hover:shadow-[#8A2BE2]/20"
      >
        <img
          src={getOptimizedImageUrl(event.posterUrl, 800, 80)}
          alt={event.title}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />

        {/* Top Badges */}
        <div className="absolute top-3 inset-x-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-1.5 flex-wrap">
            {isOngoing ? (
              <span className="bg-red-600 text-white font-heading font-black text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full shadow-lg shadow-red-600/50 flex items-center gap-1.5 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                EN COURS
              </span>
            ) : (
              <span className="bg-[#1C1B1B]/80 backdrop-blur-md text-[#E9C349] border border-[#E9C349]/30 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-md">
                {event.category}
              </span>
            )}

            {event.vipAvailable && (
              <span className="bg-[#8A2BE2]/80 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-md flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-[#E9C349]" /> VIP
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="bg-[#E9C349] text-[#241A00] font-heading font-extrabold text-xs px-2.5 py-1 rounded-lg shadow-lg tabular-nums">
              {event.priceLabel || `${event.price.toLocaleString('fr-FR')} FCFA`}
            </span>
          </div>
        </div>

        {/* Badge Ventes Ouvertes Dans si futur */}
        {!isOngoing && isSalesUpcoming && event.salesOpenAt && (
          <div className="absolute top-12 left-3 z-10">
            <CountdownTimer targetDate={event.salesOpenAt} size="sm" />
          </div>
        )}

        {/* Bottom Details */}
        <div className="absolute bottom-3 inset-x-4 z-10">
          <h3 className="font-heading font-bold text-lg sm:text-xl text-white line-clamp-1 group-hover:text-[#DCB8FF] transition-colors">
            {event.title}
          </h3>
          <div className="mt-1.5 space-y-1 text-xs text-gray-300">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#DCB8FF]" />
              <span>{event.date} • {event.time}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#E9C349]" />
              <span className="truncate">{event.venue}{event.quartier ? ` (${event.quartier})` : ''}, {event.city}</span>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  if (variant === 'list') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        onClick={() => onSelect(event)}
        className="glass-panel p-3.5 rounded-2xl flex items-center gap-4 cursor-pointer hover:border-[#8A2BE2]/50 hover:bg-[#252328] transition-colors group"
      >
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden flex-shrink-0 relative">
          <img
            src={getOptimizedImageUrl(event.posterUrl, 400, 80)}
            alt={event.title}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute top-1 left-1">
            {isOngoing ? (
              <span className="bg-red-600 text-white text-[8px] font-black uppercase px-1.5 py-0.5 rounded shadow flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                EN COURS
              </span>
            ) : (
              <span className="bg-black/60 backdrop-blur-xs text-[9px] font-bold text-[#E9C349] px-1.5 py-0.5 rounded">
                {event.category}
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-heading font-bold text-sm sm:text-base text-white truncate group-hover:text-[#DCB8FF] transition-colors">
              {event.title}
            </h4>
            {isOngoing && (
              <span className="hidden sm:inline-flex bg-red-600/20 border border-red-500/40 text-red-400 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full animate-pulse">
                En Direct
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
            <Calendar className="w-3.5 h-3.5 text-[#DCB8FF]" />
            <span>{event.date} • {event.time}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-400 truncate">
            <MapPin className="w-3.5 h-3.5 text-[#E9C349]" />
            <span className="truncate">{event.venue}{event.quartier ? ` (${event.quartier})` : ''}, {event.city}</span>
          </div>
          {!isOngoing && isSalesUpcoming && event.salesOpenAt && (
            <div className="mt-1.5">
              <CountdownTimer targetDate={event.salesOpenAt} size="sm" />
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <span className="font-heading font-extrabold text-xs sm:text-sm text-[#E9C349] tabular-nums">
            {event.price.toLocaleString('fr-FR')} FCFA
          </span>
          <button
            className={
              isOngoing
                ? 'px-3 py-1.5 rounded-xl font-heading font-black text-xs tracking-wider uppercase bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30 transition-all flex items-center gap-1.5'
                : isSalesUpcoming
                ? 'px-3 py-1.5 rounded-xl font-heading font-bold text-xs tracking-wider uppercase bg-[#8A2BE2]/20 text-[#DCB8FF] border border-[#8A2BE2]/40 hover:bg-[#8A2BE2]/40 transition-all flex items-center gap-1.5'
                : 'btn-gold-glow px-3.5 py-1.5 rounded-xl font-heading font-bold text-xs tracking-wider uppercase'
            }
          >
            {isOngoing ? (
              <>
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                <span>Rejoindre</span>
              </>
            ) : isSalesUpcoming ? (
              <>
                <Eye className="w-3.5 h-3.5" />
                <span>Voir</span>
              </>
            ) : (
              'Réserver'
            )}
          </button>
        </div>
      </motion.div>
    );
  }

  // Grid variant
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      onClick={() => onSelect(event)}
      className="glass-panel rounded-2xl overflow-hidden flex flex-col cursor-pointer hover:border-[#8A2BE2]/50 transition-shadow duration-300 group shadow-lg"
    >
      <div className="h-44 sm:h-48 relative overflow-hidden">
        <img
          src={getOptimizedImageUrl(event.posterUrl, 800, 80)}
          alt={event.title}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A1A] via-transparent to-transparent" />
        
        <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between z-10">
          {isOngoing ? (
            <span className="bg-red-600 text-white font-heading font-black text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-lg shadow-red-600/40 flex items-center gap-1.5 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
              EN COURS
            </span>
          ) : (
            <span className="bg-[#1C1B1B]/80 backdrop-blur-md text-[#E9C349] border border-[#E9C349]/30 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
              {event.category}
            </span>
          )}

          <span className="bg-[#E9C349] text-[#241A00] font-heading font-extrabold text-xs px-2.5 py-0.5 rounded-md tabular-nums">
            {event.price.toLocaleString('fr-FR')} FCFA
          </span>
        </div>

        {/* Badge Ventes Ouvertes Dans si futur */}
        {!isOngoing && isSalesUpcoming && event.salesOpenAt && (
          <div className="absolute top-10 left-2.5 z-10">
            <CountdownTimer targetDate={event.salesOpenAt} size="sm" />
          </div>
        )}

        <div className="absolute bottom-2 left-3 right-3 text-white">
          <p className="font-heading font-bold text-base line-clamp-1 group-hover:text-[#DCB8FF] transition-colors">
            {event.title}
          </p>
        </div>
      </div>

      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div className="space-y-1.5 text-xs text-gray-300">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-[#DCB8FF]" />
            <span>{event.date} • {event.time}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-[#E9C349]" />
            <span className="truncate">{event.venue}{event.quartier ? ` (${event.quartier})` : ''}, {event.city}</span>
          </div>
        </div>

        <div className="pt-2 border-t border-white/5 flex items-center justify-between">
          {event.promoter?.name && event.promoter.name.trim().toLowerCase() !== 'utilisateur' ? (
            <div className="flex items-center gap-1.5">
              {event.promoter.avatar && (
                <img
                  src={getOptimizedImageUrl(event.promoter.avatar, 120, 80)}
                  alt={event.promoter.name}
                  loading="lazy"
                  decoding="async"
                  className="w-5 h-5 rounded-full object-cover"
                />
              )}
              <span className="text-[11px] text-gray-400 truncate max-w-[100px]">
                {event.promoter.name}
              </span>
            </div>
          ) : (
            <div />
          )}

          <button
            className={
              isOngoing
                ? 'px-3 py-1 rounded-lg text-xs font-black font-heading bg-red-600 hover:bg-red-500 text-white shadow-md shadow-red-600/30 transition-all flex items-center gap-1.5'
                : isSalesUpcoming
                ? 'px-3 py-1 rounded-lg text-xs font-bold font-heading bg-[#8A2BE2]/20 text-[#DCB8FF] border border-[#8A2BE2]/40 hover:bg-[#8A2BE2]/40 transition-all flex items-center gap-1.5'
                : 'btn-primary-glow px-3 py-1 rounded-lg text-xs font-bold font-heading'
            }
          >
            {isOngoing ? (
              <>
                <Radio className="w-3 h-3 animate-pulse" />
                <span>En Direct</span>
              </>
            ) : isSalesUpcoming ? (
              <>
                <Eye className="w-3.5 h-3.5" />
                <span>Voir l'événement</span>
              </>
            ) : (
              'Réserver'
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
};
