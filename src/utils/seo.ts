import { EventItem } from '../types';

export const SITE_URL = 'https://billetterie.thiesdn.site';
export const DEFAULT_SEO_IMAGE = `${SITE_URL}/logo-tight.png`;

export const OFFICIAL_NAP = {
  name: 'Thièsdn Billetterie',
  legalName: 'Thiès Days and Nights — Billetterie Officielle',
  streetAddress: 'Grand Standing',
  addressLocality: 'Thiès',
  addressRegion: 'Thiès',
  addressCountry: 'SN',
  fullAddress: 'Grand Standing, Thiès, Sénégal',
  telephone: '+221 77 458 74 74',
  email: 'contact@mgartswork.site',
  googleMapsUrl: 'https://maps.app.goo.gl/NmftZjQ1fEU3eFZk9',
  facebookUrl: 'https://www.facebook.com/Thiesdn',
  instagramUrl: 'https://www.instagram.com/thies_dn',
  tiktokUrl: 'https://tiktok.com/@thiesdn',
  youtubeUrl: 'https://youtube.com/@thiesdn',
  latitude: 14.791005,
  longitude: -16.93586,
};

export interface CityGuideMeta {
  slug: string;
  cityName: string;
  title: string;
  metaDescription: string;
  h1: string;
  answerFirstIntro: string;
  highlights: string[];
  faqs: { question: string; answer: string }[];
}

export const CITY_GUIDES: Record<string, CityGuideMeta> = {
  thies: {
    slug: 'thies',
    cityName: 'Thiès',
    title: 'Événements & Billetterie à Thiès — Concerts, Galas & Soirées | Thiesdn',
    metaDescription:
      'Réservez vos billets en ligne à Thiès (Grand Standing, Escale, Randoulène) pour les meilleurs concerts, galas et soirées VIP. Paiement rapide Wave et Orange Money.',
    h1: 'Événements & Billetterie Officielle à Thiès',
    answerFirstIntro:
      'Thièsdn Billetterie est la plateforme de référence à Thiès pour réserver vos billets de concerts, galas, soirées VIP et festivals au Sénégal. Basée à Grand Standing, Thiès, notre billetterie permet l’achat instantané par Wave et Orange Money avec réception immédiate d’un pass QR officiel certifié.',
    highlights: [
      'Quartiers couverts : Grand Standing, Escale, Randoulène, Hersent, Cité Lamy',
      'Points de vente physiques agréés dans 33 quartiers de Thiès',
      'Pass QR sécurisé à usage unique validé à l’entrée',
    ],
    faqs: [
      {
        question: 'Comment acheter un billet de concert ou de gala à Thiès ?',
        answer:
          'Sélectionnez votre événement à Thiès sur Thièsdn Billetterie, choisissez votre formule Standard ou VIP, puis réglez en FCFA via Wave Sénégal ou Orange Money. Votre pass QR officiel est activé immédiatement dans votre portefeuille.',
      },
      {
        question: 'Où trouver des billets papier officiels à Thiès ?',
        answer:
          'Des billets physiques sécurisés par QR Code nominatif sont disponibles auprès de nos guichets partenaires agréés à Grand Standing, Escale, Randoulène et Cité Lamy, avec activation en temps réel par le vendeur.',
      },
      {
        question: 'Quels types d’événements sont disponibles à Thiès ?',
        answer:
          'Vous retrouvez les galas de prestige, concerts Mbalax et urbains, soirées club, after-works et festivals culturels organisés dans les meilleurs lieux de Thiès.',
      },
    ],
  },
  dakar: {
    slug: 'dakar',
    cityName: 'Dakar',
    title: 'Événements & Billetterie à Dakar — Concerts, VIP & Galas | Thiesdn',
    metaDescription:
      'Achetez vos billets pour les concerts, soirées VIP et festivals à Dakar (Almadies, Plateau, Ngor, Corniche) via Wave et Orange Money sur Thièsdn Billetterie.',
    h1: 'Événements & Billetterie Officielle à Dakar',
    answerFirstIntro:
      'Thièsdn Billetterie propose l’achat de billets officiels pour les concerts, galas de prestige, showcases et soirées VIP à Dakar. Commandez vos places en FCFA depuis votre mobile via Wave ou Orange Money et recevez votre pass QR infalsifiable en quelques secondes.',
    highlights: [
      'Zones couvertes : Almadies, Plateau, Ngor, Point E, Corniche Ouest',
      'Paiement mobile instantané Wave & Orange Money en FCFA',
      'Accès coupe-file par scan QR haute vitesse à l’entrée',
    ],
    faqs: [
      {
        question: 'Comment réserver une table ou un billet VIP à Dakar ?',
        answer:
          'Ouvrez la fiche de l’événement à Dakar sur Thièsdn, sélectionnez la catégorie VIP ou Lounge, indiquez votre numéro WhatsApp et validez votre paiement Wave ou Orange Money pour recevoir votre pass nominatif.',
      },
      {
        question: 'Puis-je transférer un billet Dakar à un ami ?',
        answer:
          'Oui. Depuis votre portefeuille « Mes Billets », vous pouvez assigner gratuitement un pass à un proche qui recevra son propre QR Code personnel sécurisé.',
      },
      {
        question: 'Les billets achetés sur Thièsdn sont-ils vérifiés ?',
        answer:
          'Chaque billet génère un code QR cryptographique unique contrôlé aux portes par les stations de scan officielles de l’organisateur, empêchant toute photocopie.',
      },
    ],
  },
  saly: {
    slug: 'saly',
    cityName: 'Saly',
    title: 'Événements & Billetterie à Saly — Beach Parties, Festivals & Clubs | Thiesdn',
    metaDescription:
      'Billetterie officielle des soirées, festivals plage, pool parties et concerts à Saly Portudal et sur la Petite Côte. Paiement Wave & Orange Money en FCFA.',
    h1: 'Événements & Billetterie Officielle à Saly & Petite Côte',
    answerFirstIntro:
      'Thièsdn Billetterie centralise les meilleurs événements à Saly Portudal : festivals plage, pool parties, dîners-galas en hôtel et soirées clubs sur la Petite Côte. Réservez vos préventes en FCFA par Wave ou Orange Money avec pass QR immédiat sur iPhone et Android.',
    highlights: [
      'Saly Portudal, Saly Niakhniakhal, Somone & Ngaparou',
      'Préventes sécurisées à tarif préférentiel avant le jour J',
      'Assistance directe WhatsApp avec le support local Sénégal',
    ],
    faqs: [
      {
        question: 'Quels événements ont lieu à Saly ce mois-ci ?',
        answer:
          'Saly accueille toute l’année des festivals jazz, beach parties, pool parties et soirées lounges. Consultez la liste ci-dessous ou explorez la carte interactive pour voir les dates disponibles.',
      },
      {
        question: 'Comment payer ma prévente pour une soirée à Saly ?',
        answer:
          'Choisissez votre billet sur Thièsdn, renseignez votre nom et téléphone, puis réglez directement via Wave ou Orange Money sans carte bancaire.',
      },
      {
        question: 'Le pass fonctionne-t-il sans connexion Internet à l’entrée ?',
        answer:
          'Oui. Vous pouvez télécharger votre QR Code au format PNG ou PDF A4 avant de vous rendre à l’événement à Saly pour un scan instantané même hors connexion.',
      },
    ],
  },
  mbour: {
    slug: 'mbour',
    cityName: 'Mbour',
    title: 'Événements & Billetterie à Mbour — Concerts & Soirées | Thiesdn',
    metaDescription:
      'Trouvez et réservez vos billets d’événements, concerts et soirées culturelles à Mbour en FCFA avec Wave et Orange Money sur Thièsdn Billetterie.',
    h1: 'Événements & Billetterie Officielle à Mbour',
    answerFirstIntro:
      'Thièsdn Billetterie vous permet d’acheter en ligne vos billets de concerts, soirées culturelles et galas à Mbour et sur la Petite Côte. Réglez facilement en FCFA via Wave ou Orange Money et présentez votre pass QR sécurisé à l’entrée.',
    highlights: [
      'Mbour centre, bord de mer et axes Saly / Warang',
      'Validation transparente et reçus PDF téléchargeables',
      'Pass QR compatible tous smartphones',
    ],
    faqs: [
      {
        question: 'Comment acheter des billets pour un concert à Mbour ?',
        answer:
          'Sélectionnez votre spectacle à Mbour sur Thièsdn, choisissez le nombre de places et validez le paiement Wave ou Orange Money pour recevoir votre pass électronique.',
      },
      {
        question: 'Y a-t-il des frais cachés lors de l’achat en FCFA ?',
        answer:
          'Non, le tarif affiché en FCFA sur chaque formule inclut le service de billetterie sécurisée sans mauvaise surprise au moment du paiement.',
      },
      {
        question: 'Que faire si je change de téléphone avant l’événement ?',
        answer:
          'Votre pass reste accessible à tout moment via votre lien privé, par e-mail ou en PDF A4 téléchargé depuis votre espace client.',
      },
    ],
  },
};

export function slugifyText(value: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function getCitySlug(city?: string): string {
  const normalized = slugifyText(city || 'thies');
  if (CITY_GUIDES[normalized]) return normalized;
  if (normalized.includes('dakar')) return 'dakar';
  if (normalized.includes('saly')) return 'saly';
  if (normalized.includes('mbour')) return 'mbour';
  return 'thies';
}

export function getCityUrlPath(city?: string): string {
  return `/evenements/${getCitySlug(city)}`;
}

/**
 * Construit un chemin SEO lisible pour un événement :
 * /evenement/<slug-titre>--<id> (permet l'extraction fiable de l'ID exact quel que soit le format UUID ou slug).
 */
export function getEventUrlPath(event: Pick<EventItem, 'id' | 'title'>): string {
  const titleSlug = slugifyText(event.title || 'evenement');
  if (!titleSlug) return `/evenement/${encodeURIComponent(event.id)}`;
  return `/evenement/${titleSlug}--${encodeURIComponent(event.id)}`;
}

export function extractEventIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/(?:evenement|event)\/([^/?#]+)/i);
  if (!match || !match[1]) return null;
  const raw = decodeURIComponent(match[1]).trim();
  const doubleDashIdx = raw.lastIndexOf('--');
  if (doubleDashIdx !== -1) {
    return raw.slice(doubleDashIdx + 2).trim() || null;
  }
  return raw || null;
}

/**
 * Formate une date ISO 8601 stricte avec fuseau horaire Sénégal (+00:00).
 */
export function toIso8601WithOffset(datetimeIso?: string, fallbackDate?: string, fallbackTime?: string): string {
  const raw = (datetimeIso || '').trim();
  if (raw) {
    if (/([Zz]|[+-]\d{2}:\d{2})$/.test(raw)) {
      return raw.replace(/Z$/i, '+00:00');
    }
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().replace(/\.\d{3}Z$/, '+00:00');
    }
  }
  if (fallbackDate) {
    const timePart = (fallbackTime || '22:00').trim();
    const candidate = new Date(`${fallbackDate} ${timePart} GMT+0000`);
    if (!Number.isNaN(candidate.getTime())) {
      return candidate.toISOString().replace(/\.\d{3}Z$/, '+00:00');
    }
  }
  return new Date().toISOString().replace(/\.\d{3}Z$/, '+00:00');
}

/**
 * Génère une description GEO "Answer-First" factuelle et directement citable par Gemini / ChatGPT / AI Overviews.
 */
export function buildAnswerFirstSummary(event: EventItem): string {
  const categoryLabel = (event.category || 'événement').toLowerCase();
  const organizer =
    event.promoter?.name && event.promoter.name.toLowerCase() !== 'utilisateur'
      ? ` organisé par ${event.promoter.name}`
      : '';
  const quartierPart = event.quartier ? ` (${event.quartier})` : '';
  const priceText =
    event.price > 0
      ? `Les billets sont disponibles en ligne dès ${event.price.toLocaleString('fr-FR')} FCFA via Wave Sénégal et Orange Money.`
      : 'L’entrée est accessible sur réservation officielle en ligne.';

  const customLead =
    event.description && event.description.trim().length >= 30
      ? ` ${event.description.trim()}`
      : '';

  return `${event.title} est un ${categoryLabel}${organizer} se déroulant le ${event.date} à ${event.time} au ${event.venue}${quartierPart} à ${event.city}. ${priceText}${customLead}`;
}

export function buildEventQAs(event: EventItem): { question: string; answer: string }[] {
  const tiers = event.tiers && event.tiers.length > 0 ? event.tiers : null;
  const minPrice = tiers
    ? Math.min(...tiers.map((t) => Number(t.price) || 0))
    : event.price;
  const maxPrice = tiers
    ? Math.max(...tiers.map((t) => Number(t.price) || 0))
    : event.price;
  const tierNames = tiers ? tiers.map((t) => `${t.name} (${Number(t.price).toLocaleString('fr-FR')} FCFA)`).join(', ') : `Standard (${event.price.toLocaleString('fr-FR')} FCFA)`;

  const quartierPart = event.quartier ? ` dans le quartier ${event.quartier}` : '';

  return [
    {
      question: `Qu'est-ce que ${event.title} à ${event.city} ?`,
      answer: `${event.title} est un événement de type ${event.category} prévu le ${event.date} à ${event.time} au ${event.venue}${quartierPart}, à ${event.city}. Produit par ${event.promoter?.name || 'un organisateur vérifié Thièsdn'}, l'accès est garanti par un pass QR officiel unique.`,
    },
    {
      question: `Quels sont les tarifs des billets pour ${event.title} ?`,
      answer:
        minPrice === maxPrice
          ? `Le tarif officiel pour ${event.title} est de ${minPrice.toLocaleString('fr-FR')} FCFA (${tierNames}). Les places sont limitées et disponibles en prévente sécurisée sur Thièsdn Billetterie.`
          : `Les billets pour ${event.title} démarrent à ${minPrice.toLocaleString('fr-FR')} FCFA et montent jusqu'à ${maxPrice.toLocaleString('fr-FR')} FCFA selon la formule choisie : ${tierNames}.`,
    },
    {
      question: `Comment acheter un billet avec Wave ou Orange Money ?`,
      answer: `Cliquez sur « Acheter un billet », choisissez votre catégorie puis renseignez votre nom et votre numéro mobile sénégalais. Payez en un clic avec Wave ou Orange Money pour recevoir votre QR Code certifié et votre billet PDF A4.`,
    },
    {
      question: `Où et quand se déroule ${event.title} ?`,
      answer: `L'événement se tient au ${event.venue}${quartierPart}, à ${event.city} (Sénégal), le ${event.date} à partir de ${event.time}. Présentez votre pass QR sur smartphone ou imprimé directement au contrôle d'entrée.`,
    },
  ];
}

export function buildLocalBusinessSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${SITE_URL}/#localbusiness`,
    name: OFFICIAL_NAP.name,
    alternateName: OFFICIAL_NAP.legalName,
    description:
      'Billetterie officielle au Sénégal pour concerts, galas, soirées VIP et festivals à Thiès, Dakar, Saly et Mbour. Paiement sécurisé Wave & Orange Money et pass QR certifié.',
    url: SITE_URL,
    logo: DEFAULT_SEO_IMAGE,
    image: DEFAULT_SEO_IMAGE,
    telephone: OFFICIAL_NAP.telephone,
    email: OFFICIAL_NAP.email,
    priceRange: 'FCFA (XOF)',
    currenciesAccepted: 'XOF',
    paymentAccepted: 'Wave, Orange Money, Cash',
    address: {
      '@type': 'PostalAddress',
      streetAddress: OFFICIAL_NAP.streetAddress,
      addressLocality: OFFICIAL_NAP.addressLocality,
      addressRegion: OFFICIAL_NAP.addressRegion,
      addressCountry: OFFICIAL_NAP.addressCountry,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: OFFICIAL_NAP.latitude,
      longitude: OFFICIAL_NAP.longitude,
    },
    hasMap: OFFICIAL_NAP.googleMapsUrl,
    areaServed: [
      { '@type': 'City', name: 'Thiès' },
      { '@type': 'City', name: 'Dakar' },
      { '@type': 'City', name: 'Saly' },
      { '@type': 'City', name: 'Mbour' },
    ],
    sameAs: [
      OFFICIAL_NAP.googleMapsUrl,
      OFFICIAL_NAP.facebookUrl,
      OFFICIAL_NAP.instagramUrl,
      OFFICIAL_NAP.tiktokUrl,
      OFFICIAL_NAP.youtubeUrl,
    ],
  };
}

export function buildWebSiteSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    name: 'Thièsdn Billetterie',
    url: SITE_URL,
    inLanguage: 'fr-SN',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/explorer?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

export function buildEventSchema(event: EventItem, imageUrl?: string): Record<string, unknown> {
  const startIso = toIso8601WithOffset(event.datetimeIso, event.date, event.time);
  const startDateObj = new Date(startIso);
  const endDateObj = new Date(startDateObj.getTime() + 6 * 3600 * 1000);
  const endIso = !Number.isNaN(endDateObj.getTime())
    ? endDateObj.toISOString().replace(/\.\d{3}Z$/, '+00:00')
    : startIso;

  const eventUrl = `${SITE_URL}${getEventUrlPath(event)}`;
  const activeTiers = (event.tiers || []).filter((t) => t.isActive !== false);

  const offers =
    activeTiers.length > 0
      ? activeTiers.map((tier) => ({
          '@type': 'Offer',
          name: tier.name,
          price: Number(tier.price) || 0,
          priceCurrency: 'XOF',
          availability:
            Number(tier.available) > 0
              ? 'https://schema.org/InStock'
              : 'https://schema.org/SoldOut',
          validFrom: event.salesOpenAt
            ? toIso8601WithOffset(event.salesOpenAt)
            : startIso,
          url: eventUrl,
        }))
      : {
          '@type': 'Offer',
          name: 'Billet Standard',
          price: Number(event.price) || 0,
          priceCurrency: 'XOF',
          availability:
            event.salesActive === false
              ? 'https://schema.org/SoldOut'
              : 'https://schema.org/InStock',
          url: eventUrl,
        };

  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    '@id': `${eventUrl}#event`,
    name: event.title,
    description: buildAnswerFirstSummary(event),
    startDate: startIso,
    endDate: endIso,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    image: [imageUrl || event.posterUrl || DEFAULT_SEO_IMAGE],
    url: eventUrl,
    location: {
      '@type': 'Place',
      name: event.venue,
      address: {
        '@type': 'PostalAddress',
        streetAddress: event.quartier ? `${event.venue}, ${event.quartier}` : event.venue,
        addressLocality: event.city || 'Thiès',
        addressCountry: 'SN',
      },
      ...(event.coordinates
        ? {
            geo: {
              '@type': 'GeoCoordinates',
              latitude: event.coordinates.lat,
              longitude: event.coordinates.lng,
            },
          }
        : {}),
    },
    organizer: {
      '@type': 'Organization',
      name:
        event.promoter?.name && event.promoter.name.toLowerCase() !== 'utilisateur'
          ? event.promoter.name
          : OFFICIAL_NAP.name,
      url: SITE_URL,
    },
    offers,
  };
}

export function buildEventFaqSchema(event: EventItem): Record<string, unknown> {
  const qas = buildEventQAs(event);
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: qas.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

export function buildCityGuideSchema(
  cityMeta: CityGuideMeta,
  cityEvents: EventItem[]
): Record<string, unknown>[] {
  const cityUrl = `${SITE_URL}/evenements/${cityMeta.slug}`;
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      '@id': `${cityUrl}#collection`,
      name: cityMeta.h1,
      description: cityMeta.metaDescription,
      url: cityUrl,
      inLanguage: 'fr-SN',
      about: {
        '@type': 'City',
        name: cityMeta.cityName,
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `Événements à ${cityMeta.cityName}`,
      itemListElement: cityEvents.slice(0, 20).map((evt, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: `${SITE_URL}${getEventUrlPath(evt)}`,
        name: evt.title,
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: cityMeta.faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Accueil',
          item: SITE_URL,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: `Événements à ${cityMeta.cityName}`,
          item: cityUrl,
        },
      ],
    },
  ];
}

function upsertMetaTag(attr: 'name' | 'property', key: string, content: string): void {
  if (typeof document === 'undefined') return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonicalLink(href: string): void {
  if (typeof document === 'undefined') return;
  let link = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

export function applySeoMetadata(options: {
  title: string;
  description: string;
  canonicalPath?: string;
  ogImage?: string;
  ogType?: string;
  schemas?: Record<string, unknown>[];
  preloadHeroImage?: string;
}): void {
  if (typeof document === 'undefined') return;

  const canonicalUrl = options.canonicalPath
    ? `${SITE_URL}${options.canonicalPath.startsWith('/') ? options.canonicalPath : `/${options.canonicalPath}`}`
    : SITE_URL;
  const ogImg = options.ogImage || DEFAULT_SEO_IMAGE;

  document.title = options.title;
  upsertMetaTag('name', 'description', options.description);
  upsertMetaTag('property', 'og:title', options.title);
  upsertMetaTag('property', 'og:description', options.description);
  upsertMetaTag('property', 'og:url', canonicalUrl);
  upsertMetaTag('property', 'og:image', ogImg);
  upsertMetaTag('property', 'og:type', options.ogType || 'website');
  upsertMetaTag('name', 'twitter:title', options.title);
  upsertMetaTag('name', 'twitter:description', options.description);
  upsertMetaTag('name', 'twitter:image', ogImg);
  upsertCanonicalLink(canonicalUrl);

  // Préchargement dynamique de l'image Hero LCP
  if (options.preloadHeroImage) {
    let preload = document.head.querySelector('link[data-dynamic-lcp-preload="true"]') as HTMLLinkElement | null;
    if (!preload) {
      preload = document.createElement('link');
      preload.setAttribute('rel', 'preload');
      preload.setAttribute('as', 'image');
      preload.setAttribute('fetchpriority', 'high');
      preload.setAttribute('data-dynamic-lcp-preload', 'true');
      document.head.appendChild(preload);
    }
    preload.setAttribute('href', options.preloadHeroImage);
  }

  // Injection JSON-LD dynamique nettoyée à chaque changement de vue
  document.head.querySelectorAll('script[data-dynamic-seo-ld="true"]').forEach((node) => node.remove());
  if (options.schemas && options.schemas.length > 0) {
    for (const schema of options.schemas) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-dynamic-seo-ld', 'true');
      script.textContent = JSON.stringify(schema);
      document.head.appendChild(script);
    }
  }
}
