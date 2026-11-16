import React, { useEffect, useMemo } from 'react';
import { ArrowLeft, Compass, HelpCircle, MapPin, ShieldCheck, Sparkles } from 'lucide-react';
import { EventItem } from '../types';
import { EventCard } from '../components/EventCard';
import {
  CITY_GUIDES,
  applySeoMetadata,
  buildCityGuideSchema,
  getCitySlug,
  getEventUrlPath,
} from '../utils/seo';

interface CityGuideViewProps {
  citySlug: string;
  events: EventItem[];
  isLoading?: boolean;
  onSelectEvent: (event: EventItem) => void;
  onNavigatePath: (path: string) => void;
}

export const CityGuideView: React.FC<CityGuideViewProps> = ({
  citySlug,
  events,
  isLoading = false,
  onSelectEvent,
  onNavigatePath,
}) => {
  const normalizedSlug = getCitySlug(citySlug);
  const cityMeta = CITY_GUIDES[normalizedSlug] || CITY_GUIDES.thies;

  const cityEvents = useMemo(() => {
    return events.filter((e) => {
      if (!e || e.isDeleted) return false;
      const status = String(e.status || '').toLowerCase();
      if (status !== 'approved') return false;
      return getCitySlug(e.city) === cityMeta.slug;
    });
  }, [events, cityMeta.slug]);

  useEffect(() => {
    applySeoMetadata({
      title: cityMeta.title,
      description: cityMeta.metaDescription,
      canonicalPath: `/evenements/${cityMeta.slug}`,
      schemas: buildCityGuideSchema(cityMeta, cityEvents),
    });
  }, [cityMeta, cityEvents]);

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-[calc(80px+env(safe-area-inset-bottom))] animate-in fade-in duration-300">
      {/* Breadcrumb */}
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-2 text-xs text-gray-300">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            onNavigatePath('/');
          }}
          className="inline-flex items-center gap-1 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-[#E9C349]" />
          <span>Accueil</span>
        </a>
        <span>/</span>
        <a
          href="/explorer"
          onClick={(e) => {
            e.preventDefault();
            onNavigatePath('/explorer');
          }}
          className="hover:text-white transition-colors"
        >
          Explorer
        </a>
        <span>/</span>
        <span className="text-white font-semibold">{cityMeta.cityName}</span>
      </nav>

      {/* En-tête SEO Local + Answer-First GEO */}
      <header className="glass-panel rounded-3xl p-6 sm:p-8 border border-[#8A2BE2]/30 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E9C349]/15 border border-[#E9C349]/35 text-[#E9C349] text-xs font-extrabold uppercase tracking-wider">
            <MapPin className="w-3.5 h-3.5" />
            <span>Guide Billetterie • {cityMeta.cityName}</span>
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-xs font-bold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Wave & Orange Money</span>
          </span>
        </div>

        <h1 className="font-heading text-2xl sm:text-4xl font-black text-white tracking-tight">
          {cityMeta.h1}
        </h1>

        <div className="p-4 rounded-2xl bg-[#18171E] border border-white/10 space-y-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[#DCB8FF]">
            <Sparkles className="w-3.5 h-3.5 text-[#E9C349]" />
            <span>En Bref</span>
          </span>
          <p className="text-sm sm:text-base text-[#E5E2E1] leading-relaxed">
            {cityMeta.answerFirstIntro}
          </p>
        </div>

        <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-[#E5E2E1]">
          {cityMeta.highlights.map((item, i) => (
            <li
              key={i}
              className="p-3 rounded-xl bg-black/30 border border-white/5 font-medium"
            >
              ✓ {item}
            </li>
          ))}
        </ul>
      </header>

      {/* Liste des événements de la ville */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-heading text-xl sm:text-2xl font-extrabold text-white">
            Prochains Événements à {cityMeta.cityName} ({cityEvents.length})
          </h2>
          <a
            href="/explorer"
            onClick={(e) => {
              e.preventDefault();
              onNavigatePath('/explorer');
            }}
            className="text-xs font-bold text-[#DCB8FF] hover:text-white inline-flex items-center gap-1"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Tout explorer</span>
          </a>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-pulse">
            {[1, 2].map((i) => (
              <div key={i} className="h-64 rounded-2xl bg-white/5 border border-white/5" />
            ))}
          </div>
        ) : cityEvents.length === 0 ? (
          <div className="glass-panel rounded-3xl p-8 text-center space-y-3 border border-white/10">
            <p className="text-sm text-[#E5E2E1]">
              Aucun événement programmé pour le moment à {cityMeta.cityName}. Consultez les événements dans les villes voisines ou sur tout le Sénégal.
            </p>
            <a
              href="/explorer"
              onClick={(e) => {
                e.preventDefault();
                onNavigatePath('/explorer');
              }}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl btn-gold-glow font-heading font-extrabold text-xs uppercase tracking-wider"
            >
              <Compass className="w-4 h-4 text-[#241A00]" />
              <span>Explorer tous les événements</span>
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {cityEvents.map((evt, idx) => (
              <EventCard
                key={evt.id}
                event={evt}
                variant="grid"
                priority={idx === 0}
                onSelect={onSelectEvent}
                onNavigateEventUrl={(path) => onNavigatePath(path || getEventUrlPath(evt))}
              />
            ))}
          </div>
        )}
      </section>

      {/* FAQ Ville (H2 / H3 pour GEO) */}
      <section className="glass-panel rounded-3xl p-6 sm:p-8 border border-white/10 space-y-4">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-[#E9C349]" />
          <h2 className="font-heading text-xl font-extrabold text-white">
            Questions Fréquentes — Billetterie à {cityMeta.cityName}
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {cityMeta.faqs.map((faq, idx) => (
            <div key={idx} className="p-4 rounded-2xl bg-[#18171E] border border-white/5 space-y-1.5">
              <h3 className="font-heading font-bold text-sm text-[#DCB8FF]">{faq.question}</h3>
              <p className="text-xs sm:text-sm text-[#E5E2E1] leading-relaxed">{faq.answer}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Maillage Inter-Villes */}
      <section className="glass-panel rounded-3xl p-5 border border-white/10 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-bold uppercase tracking-wider text-gray-300">
          Autres villes au Sénégal :
        </span>
        <div className="flex flex-wrap gap-2">
          {Object.values(CITY_GUIDES).map((other) => (
            <a
              key={other.slug}
              href={`/evenements/${other.slug}`}
              onClick={(e) => {
                e.preventDefault();
                onNavigatePath(`/evenements/${other.slug}`);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors ${
                other.slug === cityMeta.slug
                  ? 'bg-[#8A2BE2] border-[#8A2BE2] text-white'
                  : 'bg-white/5 border-white/10 text-[#E5E2E1] hover:bg-white/10'
              }`}
            >
              Événements {other.cityName}
            </a>
          ))}
        </div>
      </section>
    </div>
  );
};

export default CityGuideView;
