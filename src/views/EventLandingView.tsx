import React, { useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  ShieldCheck,
  Ticket,
  Compass,
  CheckCircle2,
  HelpCircle,
  ExternalLink,
  Award,
  Sparkles,
  Phone,
  Share2,
} from 'lucide-react';
import { EventItem } from '../types';
import { getOptimizedImageUrl } from '../utils/imageOptimizer';
import { SafeImage } from '../components/SafeImage';
import { EventCard } from '../components/EventCard';
import { ShareUtmButtons } from '../components/ShareUtmButtons';
import { extractUtmParamsFromUrl, trackEventAnalytics } from '../services/supabase';
import {
  CITY_GUIDES,
  SITE_URL,
  applySeoMetadata,
  buildAnswerFirstSummary,
  buildEventFaqSchema,
  buildEventQAs,
  buildEventSchema,
  getCitySlug,
  getCityUrlPath,
  getEventUrlPath,
} from '../utils/seo';

interface EventLandingViewProps {
  event: EventItem | null;
  allEvents: EventItem[];
  isLoading?: boolean;
  onBuyTicket: (event: EventItem) => void;
  onNavigatePath: (path: string) => void;
  onSelectOtherEvent: (event: EventItem) => void;
}

export const EventLandingView: React.FC<EventLandingViewProps> = ({
  event,
  allEvents,
  isLoading = false,
  onBuyTicket,
  onNavigatePath,
  onSelectOtherEvent,
}) => {
  const heroImageUrl = useMemo(
    () => (event ? getOptimizedImageUrl(event.posterUrl, 800, 78) : ''),
    [event]
  );

  const answerFirstText = useMemo(
    () => (event ? buildAnswerFirstSummary(event) : ''),
    [event]
  );

  const qas = useMemo(() => (event ? buildEventQAs(event) : []), [event]);

  const sameCityEvents = useMemo(() => {
    if (!event) return [];
    const targetCitySlug = getCitySlug(event.city);
    return allEvents
      .filter(
        (e) =>
          e &&
          e.id !== event.id &&
          String(e.status || '').toLowerCase() === 'approved' &&
          !e.isDeleted &&
          getCitySlug(e.city) === targetCitySlug
      )
      .slice(0, 4);
  }, [allEvents, event]);

  const otherApprovedEvents = useMemo(() => {
    if (!event || sameCityEvents.length > 0) return [];
    return allEvents
      .filter(
        (e) =>
          e &&
          e.id !== event.id &&
          String(e.status || '').toLowerCase() === 'approved' &&
          !e.isDeleted
      )
      .slice(0, 4);
  }, [allEvents, event, sameCityEvents.length]);

  useEffect(() => {
    if (!event) return;
    const eventPath = getEventUrlPath(event);
    const cityPath = getCityUrlPath(event.city);
    const citySlug = getCitySlug(event.city);
    const cityLabel = CITY_GUIDES[citySlug]?.cityName || event.city || 'Thiès';

    const breadcrumbSchema: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: `Événements à ${cityLabel}`, item: `${SITE_URL}${cityPath}` },
        { '@type': 'ListItem', position: 3, name: event.title, item: `${SITE_URL}${eventPath}` },
      ],
    };

    applySeoMetadata({
      title: `Billets ${event.title} - ${cityLabel} - Thiesdn`,
      description: `Réservez vos billets officiels pour ${event.title} le ${event.date} au ${event.venue} (${cityLabel}) dès ${event.price.toLocaleString('fr-FR')} FCFA via Wave & Orange Money.`,
      canonicalPath: eventPath,
      ogImage: heroImageUrl || event.posterUrl,
      ogType: 'website',
      preloadHeroImage: heroImageUrl || undefined,
      schemas: [
        buildEventSchema(event, heroImageUrl),
        buildEventFaqSchema(event),
        breadcrumbSchema,
      ],
    });
  }, [event, heroImageUrl]);

  const trackedLandingEventIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!event?.id) return;
    if (trackedLandingEventIdRef.current === event.id) return;
    trackedLandingEventIdRef.current = event.id;
    const utm = extractUtmParamsFromUrl();
    trackEventAnalytics({
      eventId: event.id,
      action: 'click',
      city: event.city,
      utmSource: utm.utmSource,
      utmMedium: utm.utmMedium,
      utmCampaign: utm.utmCampaign,
    });
  }, [event?.id, event?.city]);

  if (isLoading && !event) {
    return (
      <div className="max-w-4xl mx-auto py-8 space-y-6 animate-pulse pb-[calc(80px+env(safe-area-inset-bottom))]">
        <div className="h-8 w-40 bg-white/5 rounded-xl" />
        <div className="aspect-[16/9] w-full bg-white/5 rounded-3xl" />
        <div className="h-32 w-full bg-white/5 rounded-3xl" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="max-w-3xl mx-auto py-14 text-center space-y-5 glass-panel p-8 rounded-3xl border border-white/10 pb-[calc(80px+env(safe-area-inset-bottom))]">
        <Ticket className="w-12 h-12 text-[#E9C349] mx-auto" />
        <h1 className="font-heading text-2xl font-extrabold text-white">
          Événement introuvable ou terminé
        </h1>
        <p className="text-sm text-[#E5E2E1] max-w-md mx-auto">
          Cet événement n’est plus disponible à la vente. Découvrez les prochains concerts, galas et soirées à Thiès, Dakar, Saly et Mbour.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <a
            href="/explorer"
            onClick={(e) => {
              e.preventDefault();
              onNavigatePath('/explorer');
            }}
            className="btn-gold-glow px-5 py-3 rounded-2xl font-heading font-extrabold text-xs uppercase tracking-wider inline-flex items-center gap-2"
          >
            <Compass className="w-4 h-4 text-[#241A00]" />
            <span>Explorer les événements</span>
          </a>
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onNavigatePath('/');
            }}
            className="px-5 py-3 rounded-2xl bg-transparent border border-white/20 text-white font-heading font-bold text-xs uppercase tracking-wider inline-flex items-center gap-2 hover:bg-white/5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retour à l’accueil</span>
          </a>
        </div>
      </div>
    );
  }

  const citySlug = getCitySlug(event.city);
  const cityPath = getCityUrlPath(event.city);
  const cityLabel = CITY_GUIDES[citySlug]?.cityName || event.city || 'Thiès';
  const activeTiers = (event.tiers || []).filter((t) => t.isActive !== false);
  const relatedList = sameCityEvents.length > 0 ? sameCityEvents : otherApprovedEvents;

  return (
    <article className="max-w-4xl mx-auto space-y-8 pb-[calc(80px+env(safe-area-inset-bottom))] animate-in fade-in duration-300">
      {/* Fil d'Ariane SEO (Breadcrumb) */}
      <nav aria-label="Fil d'Ariane" className="flex flex-wrap items-center gap-2 text-xs text-gray-300">
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
          href={cityPath}
          onClick={(e) => {
            e.preventDefault();
            onNavigatePath(cityPath);
          }}
          className="hover:text-[#E9C349] transition-colors"
        >
          Événements {cityLabel}
        </a>
        <span>/</span>
        <span className="text-white font-semibold truncate max-w-[220px] sm:max-w-md">
          {event.title}
        </span>
      </nav>

      {/* En-tête Hero LCP + Answer-First GEO */}
      <header className="glass-panel rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
        <div className="relative aspect-[16/9] w-full bg-gradient-to-br from-[#1c122c] via-[#121118] to-[#0A0A0A] overflow-hidden">
          <SafeImage
            src={heroImageUrl}
            rawSrc={event.posterUrl}
            alt={`Affiche officielle ${event.title} à ${cityLabel}`}
            priority={true}
            width={800}
            height={450}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-black/40 to-transparent" />
          <div className="absolute top-4 left-4 flex flex-wrap gap-2">
            <span className="px-3 py-1 rounded-full bg-[#1C1B1B]/90 border border-[#E9C349]/40 text-[#E9C349] text-xs font-extrabold uppercase tracking-wider">
              {event.category}
            </span>
            <span className="px-3 py-1 rounded-full bg-[#8A2BE2]/90 text-white text-xs font-bold uppercase tracking-wider">
              {cityLabel}
            </span>
          </div>
          <div className="absolute bottom-4 inset-x-4 sm:inset-x-6 space-y-2">
            <h1 className="font-heading text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight drop-shadow-lg">
              {event.title} — {cityLabel}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-[#E5E2E1]">
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <Calendar className="w-4 h-4 text-[#DCB8FF]" />
                {event.date} à {event.time}
              </span>
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <MapPin className="w-4 h-4 text-[#E9C349]" />
                {event.venue}{event.quartier ? ` (${event.quartier})` : ''}, {cityLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Bloc GEO Answer-First + CTA Conversion Immédiate */}
        <div className="p-5 sm:p-7 space-y-5 bg-[#121118]/90">
          <div className="p-4 rounded-2xl bg-[#1A1822] border border-[#8A2BE2]/30 space-y-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[#E9C349]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Informations Essentielles</span>
            </span>
            <p className="text-sm sm:text-base text-[#E5E2E1] leading-relaxed font-medium">
              {answerFirstText}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
            <div>
              <p className="text-xs uppercase font-bold text-gray-300 tracking-wider">
                Tarif Billetterie Officielle
              </p>
              <p className="font-heading text-2xl font-black text-[#E9C349] tabular-nums">
                Dès {event.price.toLocaleString('fr-FR')} FCFA
              </p>
            </div>
            <button
              type="button"
              onClick={() => onBuyTicket(event)}
              className="btn-gold-glow px-6 py-4 rounded-2xl font-heading font-extrabold text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl cursor-pointer"
            >
              <Ticket className="w-4 h-4 text-[#241A00]" />
              <span>Acheter un billet maintenant</span>
            </button>
          </div>

          {/* Barre de Partage Social avec UTM */}
          <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-heading font-bold text-[#DCB8FF] uppercase tracking-wider">
              <Share2 className="w-4 h-4 text-[#E9C349]" />
              <span>Partager cet événement</span>
            </span>
            <ShareUtmButtons
              event={event}
              baseShareUrl={`${SITE_URL}${getEventUrlPath(event)}`}
            />
          </div>
        </div>
      </header>

      {/* Formules & Tarifs détaillés */}
      {activeTiers.length > 0 && (
        <section className="glass-panel rounded-3xl p-5 sm:p-7 border border-white/10 space-y-4">
          <h2 className="font-heading text-xl font-extrabold text-white">
            Catégories de Billets & Tarifs (FCFA)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {activeTiers.map((tier) => (
              <div
                key={tier.id}
                className="p-4 rounded-2xl bg-[#18171E] border border-white/10 flex flex-col justify-between gap-3"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-heading font-bold text-base text-white">{tier.name}</h3>
                    <span className="font-heading font-black text-base text-[#E9C349] tabular-nums">
                      {Number(tier.price).toLocaleString('fr-FR')} FCFA
                    </span>
                  </div>
                  {tier.description && (
                    <p className="text-xs text-[#E5E2E1] leading-relaxed">{tier.description}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onBuyTicket(event)}
                  className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-heading font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Réserver cette formule
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Section E-E-A-T : Organisateur Vérifié & Preuves d'Authenticité */}
      <section className="glass-panel rounded-3xl p-5 sm:p-7 border border-emerald-500/25 bg-[#111514]/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            {event.promoter?.avatar ? (
              <img
                src={getOptimizedImageUrl(event.promoter.avatar, 120, 80)}
                alt={event.promoter.name}
                width={48}
                height={48}
                loading="lazy"
                decoding="async"
                className="w-12 h-12 rounded-full object-cover border-2 border-[#E9C349]"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-[#8A2BE2]/25 border border-[#8A2BE2]/40 flex items-center justify-center">
                <Award className="w-6 h-6 text-[#E9C349]" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-heading font-extrabold text-base sm:text-lg text-white">
                  {event.promoter?.name && event.promoter.name.toLowerCase() !== 'utilisateur'
                    ? event.promoter.name
                    : 'Organisateur Partenaire Thièsdn'}
                </h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Organisateur Vérifié</span>
                </span>
              </div>
              <p className="text-xs text-gray-300 mt-0.5">
                Événement officiellement publié et contrôlé sur Thièsdn Billetterie ({cityLabel}, Sénégal)
              </p>
            </div>
          </div>

          {event.whatsappContact && (
            <a
              href={`https://wa.me/${event.whatsappContact.replace(/[^0-9]/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold self-start sm:self-auto"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Contacter l’organisateur</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-2xl bg-black/30 border border-white/5 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white">Billet QR Unique Certifié</p>
              <p className="text-[#E5E2E1] mt-0.5">
                Chaque pass possède une signature cryptographique invalidée dès le premier scan à l’entrée.
              </p>
            </div>
          </div>
          <div className="p-3.5 rounded-2xl bg-black/30 border border-white/5 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[#E9C349] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white">Paiement Officiel Wave & OM</p>
              <p className="text-[#E5E2E1] mt-0.5">
                Règlement vérifié en FCFA avec émission immédiate du reçu PDF et du pass mobile.
              </p>
            </div>
          </div>
          <div className="p-3.5 rounded-2xl bg-black/30 border border-white/5 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[#DCB8FF] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white">Support Local Sénégal</p>
              <p className="text-[#E5E2E1] mt-0.5">
                Assistance directe à Thiès (Grand Standing) au +221 77 458 74 74 en cas de besoin.
              </p>
            </div>
          </div>
        </div>

        {event.longDescription && (
          <div className="p-4 rounded-2xl bg-black/30 border border-white/5 text-sm text-[#E5E2E1] leading-relaxed whitespace-pre-line">
            {event.longDescription}
          </div>
        )}
      </section>

      {/* Structure Sémantique GEO : Questions / Réponses (H2 / H3) */}
      <section className="glass-panel rounded-3xl p-5 sm:p-7 border border-white/10 space-y-4">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-[#E9C349]" />
          <h2 className="font-heading text-xl font-extrabold text-white">
            Questions Fréquentes sur {event.title}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {qas.map((qa, idx) => (
            <div
              key={idx}
              className="p-4 rounded-2xl bg-[#18171E] border border-white/5 space-y-1.5"
            >
              <h3 className="font-heading font-bold text-sm text-[#DCB8FF]">
                {qa.question}
              </h3>
              <p className="text-xs sm:text-sm text-[#E5E2E1] leading-relaxed">
                {qa.answer}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Maillage Interne : Autres événements dans la même ville + Explorer */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="font-heading text-xl font-extrabold text-white">
            {sameCityEvents.length > 0
              ? `Autres événements à ${cityLabel}`
              : 'Autres événements recommandés au Sénégal'}
          </h2>
          <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
            <a
              href={cityPath}
              onClick={(e) => {
                e.preventDefault();
                onNavigatePath(cityPath);
              }}
              className="text-[#E9C349] hover:underline"
            >
              Guide événements {cityLabel} →
            </a>
            <a
              href="/explorer"
              onClick={(e) => {
                e.preventDefault();
                onNavigatePath('/explorer');
              }}
              className="text-[#DCB8FF] hover:underline inline-flex items-center gap-1"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Explorer les événements</span>
            </a>
          </div>
        </div>

        {relatedList.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {relatedList.map((rel) => (
              <EventCard
                key={rel.id}
                event={rel}
                variant="grid"
                onSelect={onSelectOtherEvent}
                onNavigateEventUrl={(path) => onNavigatePath(path)}
              />
            ))}
          </div>
        )}

        {/* Liens rapides inter-villes */}
        <div className="pt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-gray-300 font-semibold mr-1">Guides par ville :</span>
          {Object.values(CITY_GUIDES).map((cg) => (
            <a
              key={cg.slug}
              href={`/evenements/${cg.slug}`}
              onClick={(e) => {
                e.preventDefault();
                onNavigatePath(`/evenements/${cg.slug}`);
              }}
              className={`px-3 py-1.5 rounded-full border transition-colors ${
                cg.slug === citySlug
                  ? 'bg-[#8A2BE2]/25 border-[#8A2BE2]/50 text-white font-bold'
                  : 'bg-white/5 border-white/10 text-gray-300 hover:text-white hover:border-white/25'
              }`}
            >
              Événements {cg.cityName}
            </a>
          ))}
        </div>
      </section>
    </article>
  );
};

export default EventLandingView;
