import { createClient } from '@supabase/supabase-js';

// Configuration Supabase avec variables d'environnement Vercel et clés de secours résilientes
const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://jgvuzlchemqcfygsylln.supabase.co';

const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  'sb_publishable_TX1CK_Ahwd5hUwTwRAagpg_4c2UwyDj';

const SITE_URL = 'https://billetterie.thiesdn.site';
const DEFAULT_LOGO = `${SITE_URL}/logo-tight.png`;
const DEFAULT_TITLE = 'Thiès Days and Nights — Billetterie Officielle';
const DEFAULT_DESC =
  'Réservez vos billets pour les meilleurs événements à Thiès, Mbour, Saly et Dakar.';

function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Optimise l'affiche pour WhatsApp :
 * WhatsApp REFUSE catégoriquement toute image de plus de 300 Ko ou supérieure à 1200x630.
 * Cette fonction garantit une URL absolue HTTPS et un poids compressé sous 250 Ko.
 */
function getOptimizedOgImageUrl(rawUrl: string | null | undefined): string {
  if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return DEFAULT_LOGO;
  }
  const trimmed = rawUrl.trim();

  // 1. Assurer une URL absolue HTTPS
  let absoluteUrl = trimmed;
  if (trimmed.startsWith('//')) {
    absoluteUrl = `https:${trimmed}`;
  } else if (trimmed.startsWith('/')) {
    absoluteUrl = `${SITE_URL}${trimmed}`;
  } else if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    absoluteUrl = `${SITE_URL}/${trimmed}`;
  }

  // 2. Si c'est déjà le logo officiel ou une image locale interne
  if (
    absoluteUrl.includes('logo-tight.png') ||
    absoluteUrl.includes('billetterie.thiesdn.site/logo')
  ) {
    return absoluteUrl;
  }

  // 3. Spécificité Imgur :
  // Imgur bloque les proxies tiers comme wsrv.nl (erreur 429 Rate Limited),
  // mais fournit nativement le suffixe 'h' (Huge 1024x1024, ~200 Ko) ou 'l' (Large 640x640, ~98 Ko).
  // La version 'h' garantit une image < 300 Ko lue directement par WhatsApp sans blocage !
  const imgurMatch = absoluteUrl.match(
    /^https?:\/\/i\.imgur\.com\/([a-zA-Z0-9]+)(\.[a-zA-Z0-9]+)$/
  );
  if (imgurMatch) {
    const id = imgurMatch[1];
    const ext = imgurMatch[2];
    if (!/[hlmtsb]$/.test(id)) {
      return `https://i.imgur.com/${id}h${ext}`;
    }
    return absoluteUrl;
  }

  // 4. Spécificité Unsplash :
  if (absoluteUrl.includes('images.unsplash.com')) {
    const cleanUrl = absoluteUrl.split('?')[0];
    return `${cleanUrl}?w=1200&h=630&fit=crop&q=80&auto=format`;
  }

  // 5. Autres hébergeurs d'images distantes :
  // Relais via wsrv.nl pour convertir en JPEG 1200x630 optimisé sous 200 Ko
  try {
    const cleanForWsrv = absoluteUrl.replace(/^https?:\/\//, '');
    return `https://wsrv.nl/?url=${encodeURIComponent(cleanForWsrv)}&w=1200&h=630&fit=cover&output=jpg&q=80`;
  } catch {
    return absoluteUrl;
  }
}

export default async function handler(req: any, res: any) {
  // Support à la fois des requêtes /api/preview?id=... et des rewrites /event/:id
  let eventId = (req.query?.id || req.query?.event || '').toString().trim();
  if (!eventId && req.url) {
    const urlMatch = req.url.match(/\/event\/([a-zA-Z0-9_-]+)/i);
    if (urlMatch && urlMatch[1]) {
      eventId = urlMatch[1].trim();
    }
  }

  const userAgent = String(req.headers?.['user-agent'] || '').toLowerCase();
  const isCrawlerBot =
    /(googlebot|bingbot|yandex|baiduspider|duckduckbot|slurp|applebot|gptbot|oai-searchbot|chatgpt-user|claudebot|anthropic-ai|perplexitybot|google-extended|facebookexternalhit|whatsapp|twitterbot|linkedinbot|slackbot|discordbot|telegrambot|crawler|spider|bot)/i.test(
      userAgent
    );

  let title = DEFAULT_TITLE;
  let description = DEFAULT_DESC;
  let imageUrl = DEFAULT_LOGO;
  let targetUrl = SITE_URL;
  let eventRecord: Record<string, any> | null = null;

  if (eventId) {
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false },
      });

      const { data: event, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .maybeSingle();

      if (!error && event) {
        eventRecord = event;
        const cityLabel = event.city || 'Thiès';
        title = event.title
          ? `Billets ${event.title} - ${cityLabel} - Thiesdn`
          : DEFAULT_TITLE;

        const dateStr = event.event_date ? ` le ${event.event_date}` : '';
        const placeStr =
          event.lieu || event.city ? ` au ${event.lieu || event.city}` : '';
        const priceStr = event.prix_standard
          ? ` dès ${Number(event.prix_standard).toLocaleString('fr-FR')} FCFA`
          : '';

        if (event.description && event.description.trim()) {
          description = `${event.title} se déroule${dateStr}${placeStr} (${cityLabel}). ${event.description.trim().substring(0, 220)}${priceStr}.`;
        } else {
          description = `Réservez votre place pour ${event.title}${dateStr}${placeStr} (${cityLabel})${priceStr} sur la billetterie officielle Thièsdn via Wave et Orange Money.`;
        }

        // Optimisation stricte de l'affiche pour WhatsApp (< 300 Ko garanti)
        imageUrl = getOptimizedOgImageUrl(event.affiche_url);
        const slugTitle = String(event.title || 'evenement')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 60);
        targetUrl = slugTitle
          ? `${SITE_URL}/evenement/${slugTitle}--${encodeURIComponent(eventId)}`
          : `${SITE_URL}/evenement/${encodeURIComponent(eventId)}`;
      }
    } catch (err) {
      console.error('Erreur API preview serverless:', err);
    }
  }

  const safeTitle = escapeHtml(title);
  const safeDesc = escapeHtml(description);
  const safeImage = escapeHtml(imageUrl);
  const safeTargetUrl = escapeHtml(targetUrl);
  const canonicalUrl = eventRecord ? targetUrl : eventId ? `${SITE_URL}/event/${encodeURIComponent(eventId)}` : SITE_URL;
  const safeCanonicalUrl = escapeHtml(canonicalUrl);

  const startIso = eventRecord?.datetime_iso
    ? String(eventRecord.datetime_iso).replace(/Z$/i, '+00:00')
    : new Date().toISOString().replace(/\.\d{3}Z$/, '+00:00');
  const organizerName = eventRecord?.organizer_name || 'Thièsdn Billetterie';
  const venueName = eventRecord?.lieu || 'Thiès';
  const cityName = eventRecord?.city || 'Thiès';
  const basePrice = Number(eventRecord?.prix_standard) || 0;

  const eventJsonLd = eventRecord
    ? JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Event',
        name: eventRecord.title || title,
        description,
        startDate: startIso,
        eventStatus: 'https://schema.org/EventScheduled',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        image: [imageUrl],
        url: canonicalUrl,
        location: {
          '@type': 'Place',
          name: venueName,
          address: {
            '@type': 'PostalAddress',
            streetAddress: venueName,
            addressLocality: cityName,
            addressCountry: 'SN',
          },
        },
        organizer: {
          '@type': 'Organization',
          name: organizerName,
          url: SITE_URL,
        },
        offers: {
          '@type': 'Offer',
          price: basePrice,
          priceCurrency: 'XOF',
          availability: 'https://schema.org/InStock',
          url: canonicalUrl,
        },
      })
    : '';

  const botRedirectMeta = isCrawlerBot
    ? ''
    : `<meta http-equiv="refresh" content="0;url=${safeTargetUrl}" />`;
  const botRedirectScript = isCrawlerBot
    ? ''
    : `<script>
      try {
        window.location.replace(${JSON.stringify(targetUrl)});
      } catch (e) {
        window.location.href = ${JSON.stringify(targetUrl)};
      }
    </script>`;

  const html = `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDesc}" />
    <link rel="canonical" href="${safeCanonicalUrl}" />

    <!-- Open Graph / WhatsApp / Facebook -->
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Thiès Days and Nights" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDesc}" />
    <meta property="og:image" content="${safeImage}" />
    <meta property="og:image:secure_url" content="${safeImage}" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${safeTitle}" />
    <meta property="og:url" content="${safeCanonicalUrl}" />
    <meta property="og:locale" content="fr_FR" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDesc}" />
    <meta name="twitter:image" content="${safeImage}" />

    ${eventJsonLd ? `<script type="application/ld+json">${eventJsonLd}</script>` : ''}
    ${botRedirectMeta}

    <style>
      body {
        margin: 0;
        background-color: #0F0F0F;
        color: #E5E2E1;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        text-align: center;
        padding: 20px;
      }
      .card {
        background: #171717;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 20px;
        padding: 30px;
        max-width: 520px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.6);
      }
      .poster {
        width: 100%;
        height: 220px;
        object-fit: cover;
        border-radius: 12px;
        margin-bottom: 20px;
      }
      h1 {
        font-size: 1.25rem;
        margin-bottom: 10px;
        color: #FFF;
      }
      h2 {
        font-size: 0.95rem;
        margin-top: 16px;
        color: #E9C349;
      }
      p {
        font-size: 0.9rem;
        color: #E5E2E1;
        line-height: 1.5;
        margin-bottom: 16px;
      }
      .btn {
        display: inline-block;
        background: #E9C349;
        color: #241A00;
        text-decoration: none;
        padding: 12px 24px;
        border-radius: 10px;
        font-weight: bold;
        font-size: 0.9rem;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <img src="${safeImage}" alt="${safeTitle}" class="poster" />
      <h1>${safeTitle}</h1>
      <p>${safeDesc}</p>
      ${
        eventRecord
          ? `<section>
        <h2>Comment acheter un billet ?</h2>
        <p>Réservez directement votre place en FCFA via Wave Sénégal ou Orange Money sur Thièsdn Billetterie et recevez votre pass QR officiel certifié.</p>
        <h2>Lieu et organisateur</h2>
        <p>Lieu : ${escapeHtml(venueName)}, ${escapeHtml(cityName)}. Organisé par ${escapeHtml(organizerName)}.</p>
      </section>`
          : ''
      }
      <a href="${safeTargetUrl}" class="btn">Accéder à la billetterie &rarr;</a>
    </main>
    ${botRedirectScript}
  </body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader(
    'Cache-Control',
    'public, max-age=60, s-maxage=300, stale-while-revalidate=86400'
  );
  return res.status(200).send(html);
}
