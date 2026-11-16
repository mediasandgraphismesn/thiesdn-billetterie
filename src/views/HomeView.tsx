import React, { useState, useEffect } from 'react';
import { Search, TrendingUp, ChevronRight, Calendar, MapPin } from 'lucide-react';
import { EventItem, CATEGORIES } from '../types';
import { EventCard } from '../components/EventCard';
import { EventCardSkeleton } from '../components/EventCardSkeleton';
import { getEventEndDatetime } from '../services/supabase';
import { getOptimizedImageUrl } from '../utils/imageOptimizer';
import { CITY_GUIDES, applySeoMetadata, buildLocalBusinessSchema, buildWebSiteSchema } from '../utils/seo';

interface HomeViewProps {
  events: EventItem[];
  isLoading?: boolean;
  isPromoterView?: boolean;
  currentUserId?: string;
  currentRole?: string;
  onSelectEvent: (event: EventItem) => void;
  onNavigatePath?: (path: string) => void;
  onManageEvent?: (event: EventItem) => void;
  onNavigateToExplore: () => void;
  onNavigateToCreate: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  events,
  isLoading = false,
  isPromoterView = false,
  currentUserId,
  currentRole,
  onSelectEvent,
  onNavigatePath,
  onManageEvent,
  onNavigateToExplore,
  onNavigateToCreate,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Liste sécurisée garantie non-nulle
  const safeEvents = Array.isArray(events) ? events.filter(Boolean) : [];

  // Filtrer les événements approuvés
  const approvedEvents = safeEvents.filter(
    (e) => e && String(e.status || '').toLowerCase() === 'approved'
  );

  // Séparation dynamique : un événement n'est considéré "passé" que si maintenant > date_debut + fin_estimée
  // Ainsi les soirées nocturnes qui traversent minuit (ex: KMOU JANGO) restent actives et "En cours" le lendemain matin
  const now = Date.now();
  const activeEvents = approvedEvents.filter((e) => {
    try {
      const end = getEventEndDatetime(e).getTime();
      return isNaN(end) ? true : now <= end;
    } catch {
      return true;
    }
  });

  // Si en vue promoteur, afficher tous ses événements (même en attente de modération)
  // Sinon filtrer sur les événements actifs/approuvés pour le public
  const displayPool = isPromoterView
    ? safeEvents
    : activeEvents.length > 0
    ? activeEvents
    : approvedEvents;

  const filteredEvents = displayPool.filter((e) => {
    if (!e) return false;
    const q = (searchQuery || '').toLowerCase();
    const titleMatch = e.title ? e.title.toLowerCase().includes(q) : false;
    const venueMatch = e.venue ? e.venue.toLowerCase().includes(q) : false;
    const promoterMatch = e.promoter?.name ? e.promoter.name.toLowerCase().includes(q) : false;
    const matchesSearch = !q || titleMatch || venueMatch || promoterMatch;

    const matchesCategory =
      selectedCategory === 'All' || e.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const featuredEvents = displayPool.filter((e) => e && e.featured);
  const upcomingEvents = filteredEvents.slice(0, 8);
  const lcpEvent = featuredEvents[0] || upcomingEvents[0];
  const lcpImageUrl = lcpEvent ? getOptimizedImageUrl(lcpEvent.posterUrl, 800, 80) : undefined;

  useEffect(() => {
    if (isPromoterView) return;
    applySeoMetadata({
      title: 'Thiès Days and Nights — Billetterie Officielle Sénégal (Thiès, Dakar, Saly)',
      description:
        'Réservez vos billets officiels de concerts, galas et soirées VIP à Thiès, Dakar, Saly et Mbour. Paiement sécurisé Wave & Orange Money en FCFA avec pass QR certifié.',
      canonicalPath: '/',
      preloadHeroImage: lcpImageUrl,
      schemas: [buildLocalBusinessSchema(), buildWebSiteSchema()],
    });
  }, [isPromoterView, lcpImageUrl]);

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-300">
      {/* Search Bar matching Image 2 */}
      <div className="relative">
        <div className="relative flex items-center bg-[#1A1A1A] border border-white/10 rounded-2xl px-4 py-3.5 focus-within:border-[#8A2BE2] focus-within:shadow-[0_0_15px_rgba(138,43,226,0.25)] transition-all">
          <Search className="w-5 h-5 text-gray-300 mr-3 flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un événement, artiste, lieu..."
            className="w-full bg-transparent border-none outline-none text-sm text-white placeholder:text-gray-300/75 focus:ring-0 p-0"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs text-gray-300 hover:text-white px-2"
            >
              Effacer
            </button>
          )}
        </div>
      </div>

      {/* Category Pills matching Image 2 */}
      <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat.value;
          return (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold font-heading tracking-wide transition-all ${
                isSelected
                  ? 'bg-[#8A2BE2] text-white shadow-lg shadow-[#8A2BE2]/30 scale-105'
                  : 'bg-[#1C1B1B] text-[#CFC2D7] hover:bg-[#2A2A2A] border border-white/5'
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Featured Events Horizontal Scroll Section : Masquée pendant chargement ou si 0 résultat pour éviter tout CLS */}
      {!isLoading && featuredEvents.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#E9C349]" />
              <h2 className="font-heading text-xl sm:text-2xl font-bold text-white tracking-tight">
                Événements à la Une
              </h2>
            </div>
            <button
              onClick={onNavigateToExplore}
              className="text-xs font-bold text-[#DCB8FF] hover:text-white flex items-center gap-1 transition-colors"
            >
              <span>Voir tout</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Horizontal Carousel */}
          <div className="flex gap-4 overflow-x-auto pb-3 pt-1 scrollbar-none snap-x snap-mandatory">
            {featuredEvents.map((event, idx) => (
              <div key={event.id} className="snap-start flex-shrink-0">
                <EventCard
                  event={event}
                  variant="featured"
                  priority={idx === 0}
                  onSelect={onSelectEvent}
                  onNavigateEventUrl={(path) => onNavigatePath?.(path)}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Upcoming Near You Section matching Image 2 */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-xl sm:text-2xl font-bold text-white tracking-tight">
            {isPromoterView ? 'Mes Événements Organisés' : 'Événements à Venir'}
          </h2>
          <span className="text-xs text-gray-300 font-medium">
            {isLoading
              ? 'Chargement...'
              : `${upcomingEvents.length} événement${upcomingEvents.length > 1 ? 's' : ''}`}
          </span>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, idx) => (
              <EventCardSkeleton key={`upcoming-skel-${idx}`} variant="list" />
            ))}
          </div>
        ) : displayPool.length === 0 ? (
          isPromoterView ? (
            <div className="glass-panel p-10 sm:p-14 rounded-3xl text-center space-y-4 border border-white/10">
              <div className="w-14 h-14 rounded-2xl bg-[#8A2BE2]/20 text-[#DCB8FF] flex items-center justify-center mx-auto border border-[#8A2BE2]/30">
                <Calendar className="w-7 h-7 text-[#E9C349]" />
              </div>
              <div className="space-y-1">
                <h3 className="font-heading font-bold text-lg text-white">
                  Vous n'avez pas encore d'événement organisé
                </h3>
                <p className="text-[#E5E2E1] text-xs max-w-md mx-auto">
                  Créez votre premier événement pour débloquer la vente de vos billets en ligne, votre réseau de points de vente physiques et vos scanners d'accès.
                </p>
              </div>
              <div className="pt-2">
                <button
                  onClick={onNavigateToCreate}
                  className="btn-gold-glow py-3 px-6 rounded-2xl font-heading font-extrabold text-xs tracking-wider uppercase cursor-pointer"
                >
                  Créer mon premier événement
                </button>
              </div>
            </div>
          ) : (
            <div className="glass-panel p-12 rounded-3xl text-center space-y-3 border border-white/10">
              <div className="w-12 h-12 rounded-2xl bg-[#E9C349]/10 text-[#E9C349] flex items-center justify-center mx-auto border border-[#E9C349]/20">
                <Calendar className="w-6 h-6" />
              </div>
              <h3 className="font-heading font-bold text-base text-white">Aucun événement disponible pour le moment</h3>
              <p className="text-[#E5E2E1] text-xs max-w-md mx-auto">
                Revenez bientôt pour découvrir les prochains événements officiels à Thiès, Mbour, Saly et Dakar.
              </p>
            </div>
          )
        ) : upcomingEvents.length === 0 ? (
          <div className="glass-panel p-10 rounded-2xl text-center space-y-3">
            <p className="text-[#E5E2E1] text-sm">
              Aucun événement ne correspond à votre recherche.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('All');
              }}
              className="px-4 py-2 rounded-xl bg-[#8A2BE2]/20 text-[#DCB8FF] text-xs font-bold hover:bg-[#8A2BE2]/40 transition-colors"
            >
              Réinitialiser les filtres
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingEvents.map((event, idx) => (
              <EventCard
                key={event.id}
                event={event}
                variant="list"
                priority={featuredEvents.length === 0 && idx === 0}
                onSelect={onSelectEvent}
                onNavigateEventUrl={(path) => onNavigatePath?.(path)}
                currentUserId={currentUserId}
                currentRole={currentRole}
                isOwnerPromoter={isPromoterView}
                onManageEvent={onManageEvent}
              />
            ))}
          </div>
        )}
      </section>

      {/* Maillage SEO Local : Guides par Ville (Sénégal) */}
      {!isPromoterView && (
        <section aria-label="Guides billetterie par ville au Sénégal" className="glass-panel rounded-3xl p-5 border border-white/10 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="font-heading text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#E9C349]" />
              <span>Billetterie Officielle par Ville au Sénégal</span>
            </h2>
            <a
              href="/explorer"
              onClick={(e) => {
                e.preventDefault();
                if (onNavigatePath) onNavigatePath('/explorer');
                else onNavigateToExplore();
              }}
              className="text-xs font-bold text-[#DCB8FF] hover:text-white transition-colors"
            >
              Explorer la carte →
            </a>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {Object.values(CITY_GUIDES).map((cg) => (
              <a
                key={cg.slug}
                href={`/evenements/${cg.slug}`}
                onClick={(e) => {
                  if (onNavigatePath) {
                    e.preventDefault();
                    onNavigatePath(`/evenements/${cg.slug}`);
                  }
                }}
                className="px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#E9C349]/40 text-xs font-heading font-bold text-[#E5E2E1] hover:text-white flex items-center justify-between transition-all"
              >
                <span>Événements {cg.cityName}</span>
                <ChevronRight className="w-3.5 h-3.5 text-[#E9C349]" />
              </a>
            ))}
          </div>
        </section>
      )}

      {/* VIP Promotion Banner (Masquée pour les promoteurs déjà certifiés) */}
      {!isPromoterView && (
        <div className="glass-panel-gold rounded-3xl p-6 relative overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left z-10">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#E9C349]">
              Club Privé Thiesdn
            </span>
            <h3 className="font-heading text-lg sm:text-xl font-bold text-white">
              Devenez Promoteur Officiel
            </h3>
            <p className="text-xs text-gray-300 max-w-md">
              Publiez vos soirées, vendez vos billets en ligne en FCFA avec Wave/Orange Money et gérez vos accès VIP.
            </p>
          </div>

          <button
            onClick={onNavigateToCreate}
            className="btn-gold-glow py-3 px-6 rounded-2xl font-heading font-extrabold text-xs tracking-wider uppercase flex-shrink-0 z-10"
          >
            Créer un Événement
          </button>
        </div>
      )}
    </div>
  );
};
