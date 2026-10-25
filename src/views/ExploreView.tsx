import React, { useState } from 'react';
import {
  Search,
  MapPin,
  Calendar,
  Filter,
  SlidersHorizontal,
  Compass,
  Layers,
} from 'lucide-react';
import { EventItem, CATEGORIES, SENEGAL_CITIES } from '../types';
import { THIES_QUARTIERS_BY_ZONE } from '../data/thiesQuartiers';
import { EventCard } from '../components/EventCard';
import { MapView } from '../components/MapView';

interface ExploreViewProps {
  events: EventItem[];
  onSelectEvent: (event: EventItem) => void;
}

export const ExploreView: React.FC<ExploreViewProps> = ({
  events,
  onSelectEvent,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState('All');
  const [selectedQuartier, setSelectedQuartier] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedSort, setSelectedSort] = useState<'date' | 'price-asc' | 'price-desc'>('date');
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');

  const approvedEvents = events.filter((e) => e.status === 'approved');

  const filteredEvents = approvedEvents
    .filter((e) => {
      const matchesSearch =
        e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.venue.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.quartier && e.quartier.toLowerCase().includes(searchQuery.toLowerCase())) ||
        e.promoter.name.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCity = selectedCity === 'All' || e.city === selectedCity;
      const matchesQuartier =
        selectedCity !== 'Thiès' || selectedQuartier === 'All' || e.quartier === selectedQuartier;
      const matchesCat = selectedCategory === 'All' || e.category === selectedCategory;

      return matchesSearch && matchesCity && matchesQuartier && matchesCat;
    })
    .sort((a, b) => {
      if (selectedSort === 'price-asc') return a.price - b.price;
      if (selectedSort === 'price-desc') return b.price - a.price;
      const timeA = a.datetimeIso ? new Date(a.datetimeIso).getTime() : 0;
      const timeB = b.datetimeIso ? new Date(b.datetimeIso).getTime() : 0;
      return (isNaN(timeA) ? 0 : timeA) - (isNaN(timeB) ? 0 : timeB);
    });

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Explorer les Événements au Sénégal
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Découvrez les meilleures soirées, galas et festivals à Thiès, Mbour, Saly et Dakar
          </p>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1 bg-[#1C1B1B] p-1 rounded-xl border border-white/10 self-start sm:self-auto">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'grid'
                ? 'bg-[#8A2BE2] text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Grille ({filteredEvents.length})
          </button>
          <button
            onClick={() => setViewMode('map')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              viewMode === 'map'
                ? 'bg-[#8A2BE2] text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            Carte Sénégal
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass-panel p-4 rounded-2xl space-y-3">
        {/* Search */}
        <div className="relative flex items-center bg-[#131313] border border-white/10 rounded-xl px-4 py-2.5 focus-within:border-[#8A2BE2]">
          <Search className="w-4 h-4 text-gray-400 mr-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par nom de soirée, artiste, club à Thiès, Saly, Dakar..."
            className="w-full bg-transparent border-none outline-none text-sm text-white placeholder-gray-500 focus:ring-0 p-0"
          />
        </div>

        {/* City & Category Filter Chips */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {/* City Chips for Senegal */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {SENEGAL_CITIES.map((city) => (
              <button
                key={city}
                onClick={() => {
                  setSelectedCity(city);
                  if (city !== 'Thiès') setSelectedQuartier('All');
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all inline-flex items-center gap-1.5 ${
                  selectedCity === city
                    ? 'bg-[#E9C349] text-[#241A00] font-bold shadow-md'
                    : 'bg-[#181818] text-gray-300 hover:bg-[#252525] border border-white/5'
                }`}
              >
                {city !== 'All' && <MapPin className="w-3 h-3 text-[#E9C349]" />}
                <span>{city === 'All' ? 'Toutes Régions' : city}</span>
              </button>
            ))}
          </div>

          {/* Thiès 33 Quartiers Filter */}
          {selectedCity === 'Thiès' && (
            <div className="flex items-center gap-2 w-full pt-2 border-t border-white/5">
              <span className="text-xs text-[#DCB8FF] font-bold flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#E9C349]" />
                Quartier (33) :
              </span>
              <select
                value={selectedQuartier}
                onChange={(e) => setSelectedQuartier(e.target.value)}
                className="bg-[#181818] border border-[#8A2BE2]/40 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-[#E9C349] cursor-pointer"
              >
                <option value="All">Tous les 33 quartiers de Thiès</option>
                <optgroup label="📍 Thiès Ouest (11 quartiers)" className="bg-[#1A1A1A] text-[#DCB8FF] font-bold">
                  {THIES_QUARTIERS_BY_ZONE['Thiès Ouest'].map((q) => (
                    <option key={q.name} value={q.name} className="bg-[#1F1F1F] text-white">
                      {q.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="📍 Thiès Est (11 quartiers)" className="bg-[#1A1A1A] text-[#DCB8FF] font-bold">
                  {THIES_QUARTIERS_BY_ZONE['Thiès Est'].map((q) => (
                    <option key={q.name} value={q.name} className="bg-[#1F1F1F] text-white">
                      {q.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="📍 Thiès Nord (11 quartiers)" className="bg-[#1A1A1A] text-[#DCB8FF] font-bold">
                  {THIES_QUARTIERS_BY_ZONE['Thiès Nord'].map((q) => (
                    <option key={q.name} value={q.name} className="bg-[#1F1F1F] text-white">
                      {q.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          )}

          {/* Sort Selector */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-400">Trier par:</span>
            <select
              value={selectedSort}
              onChange={(e) => setSelectedSort(e.target.value as any)}
              className="bg-[#181818] border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-[#8A2BE2] cursor-pointer"
            >
              <option value="date">Date la plus proche</option>
              <option value="price-asc">Prix croissant (FCFA)</option>
              <option value="price-desc">Prix décroissant (VIP Prestige)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Interactive Leaflet Dark Map View */}
      {viewMode === 'map' && (
        <MapView
          events={filteredEvents}
          selectedCity={selectedCity}
          onSelectCity={(city) => {
            setSelectedCity(city);
            if (city !== 'Thiès') setSelectedQuartier('All');
          }}
          onSelectEvent={onSelectEvent}
        />
      )}

      {/* Grid of Events */}
      {filteredEvents.length === 0 ? (
        <div className="glass-panel p-12 rounded-3xl text-center space-y-3 border border-white/10 col-span-full">
          <div className="w-12 h-12 rounded-2xl bg-[#E9C349]/10 text-[#E9C349] flex items-center justify-center mx-auto border border-[#E9C349]/20">
            <Calendar className="w-6 h-6" />
          </div>
          <h3 className="font-heading font-bold text-base text-white">Aucun événement disponible pour le moment</h3>
          <p className="text-gray-400 text-xs max-w-md mx-auto">
            Revenez bientôt pour découvrir les prochains événements officiels ou modifiez vos filtres de recherche.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              variant="grid"
              onSelect={onSelectEvent}
            />
          ))}
        </div>
      )}
    </div>
  );
};
