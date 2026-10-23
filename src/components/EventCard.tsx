import React from 'react';
import { Calendar, MapPin, Sparkles, Crown, ShieldCheck } from 'lucide-react';
import { EventItem } from '../types';

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
  if (variant === 'featured') {
    return (
      <div
        onClick={() => onSelect(event)}
        className="relative group cursor-pointer flex-shrink-0 w-80 sm:w-96 h-64 rounded-2xl overflow-hidden border border-white/10 shadow-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-[#8A2BE2]/20"
      >
        <img
          src={event.posterUrl}
          alt={event.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />

        {/* Top Badges */}
        <div className="absolute top-3 inset-x-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-1.5">
            <span className="bg-[#1C1B1B]/80 backdrop-blur-md text-[#E9C349] border border-[#E9C349]/30 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-md">
              {event.category}
            </span>
            {event.vipAvailable && (
              <span className="bg-[#8A2BE2]/80 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-md flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-[#E9C349]" /> VIP
              </span>
            )}
          </div>

          <span className="bg-[#E9C349] text-[#241A00] font-heading font-extrabold text-xs px-2.5 py-1 rounded-lg shadow-lg tabular-nums">
            {event.priceLabel || `${event.price.toLocaleString('fr-FR')} FCFA`}
          </span>
        </div>

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
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div
        onClick={() => onSelect(event)}
        className="glass-panel p-3.5 rounded-2xl flex items-center gap-4 cursor-pointer hover:border-[#8A2BE2]/50 hover:bg-[#252328] transition-all group"
      >
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden flex-shrink-0 relative">
          <img
            src={event.posterUrl}
            alt={event.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute top-1 left-1 bg-black/60 backdrop-blur-xs text-[9px] font-bold text-[#E9C349] px-1.5 py-0.5 rounded">
            {event.category}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="font-heading font-bold text-sm sm:text-base text-white truncate group-hover:text-[#DCB8FF] transition-colors">
            {event.title}
          </h4>
          <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
            <Calendar className="w-3.5 h-3.5 text-[#DCB8FF]" />
            <span>{event.date} • {event.time}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-400 truncate">
            <MapPin className="w-3.5 h-3.5 text-[#E9C349]" />
            <span className="truncate">{event.venue}{event.quartier ? ` (${event.quartier})` : ''}, {event.city}</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <span className="font-heading font-extrabold text-xs sm:text-sm text-[#E9C349] tabular-nums">
            {event.price.toLocaleString('fr-FR')} FCFA
          </span>
          <button className="btn-gold-glow px-3.5 py-1.5 rounded-xl font-heading font-bold text-xs tracking-wider uppercase">
            Réserver
          </button>
        </div>
      </div>
    );
  }

  // Grid variant
  return (
    <div
      onClick={() => onSelect(event)}
      className="glass-panel rounded-2xl overflow-hidden flex flex-col cursor-pointer hover:border-[#8A2BE2]/50 hover:translate-y-[-2px] transition-all group shadow-lg"
    >
      <div className="h-44 sm:h-48 relative overflow-hidden">
        <img
          src={event.posterUrl}
          alt={event.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A1A] via-transparent to-transparent" />
        
        <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between z-10">
          <span className="bg-[#1C1B1B]/80 backdrop-blur-md text-[#E9C349] border border-[#E9C349]/30 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
            {event.category}
          </span>
          <span className="bg-[#E9C349] text-[#241A00] font-heading font-extrabold text-xs px-2.5 py-0.5 rounded-md tabular-nums">
            {event.price.toLocaleString('fr-FR')} FCFA
          </span>
        </div>

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
          <div className="flex items-center gap-1.5">
            <img
              src={event.promoter.avatar}
              alt={event.promoter.name}
              className="w-5 h-5 rounded-full object-cover"
            />
            <span className="text-[11px] text-gray-400 truncate max-w-[100px]">
              {event.promoter.name}
            </span>
          </div>

          <button className="btn-primary-glow px-3 py-1 rounded-lg text-xs font-bold font-heading">
            Réserver
          </button>
        </div>
      </div>
    </div>
  );
};
