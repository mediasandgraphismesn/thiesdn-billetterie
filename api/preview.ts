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

function resolveAbsoluteUrl(url: string | null | undefined): string {
  if (!url || typeof url !== 'string' || !url.trim()) return DEFAULT_LOGO;
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  if (trimmed.startsWith('/')) {
    return `${SITE_URL}${trimmed}`;
  }
  return `${SITE_URL}/${trimmed}`;
}

export default async function handler(req: any, res: any) {
  // Support à la fois des requêtes GET directes et des paramètres de requête
  const eventId = (req.query?.id || req.query?.event || '').toString().trim();

  let title = DEFAULT_TITLE;
  let description = DEFAULT_DESC;
  let imageUrl = DEFAULT_LOGO;
  let targetUrl = SITE_URL;

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
        title = event.title
          ? `${event.title} — Thiès Days and Nights`
          : DEFAULT_TITLE;

        const dateStr = event.event_date ? ` • ${event.event_date}` : '';
        const placeStr = event.lieu || event.city ? ` à ${event.lieu || event.city}` : '';
        const priceStr = event.prix_standard ? ` dès ${Number(event.prix_standard).toLocaleString('fr-FR')} FCFA` : '';

        if (event.description && event.description.trim()) {
          description = `${event.description.trim().substring(0, 240)}${placeStr}${dateStr}`;
        } else {
          description = `Réservez votre place pour ${event.title}${placeStr}${dateStr}${priceStr} sur la billetterie officielle.`;
        }

        imageUrl = resolveAbsoluteUrl(event.affiche_url);
        targetUrl = `${SITE_URL}/?event=${encodeURIComponent(eventId)}`;
      }
    } catch (err) {
      console.error('Erreur API preview serverless:', err);
      // Fallback gracieux sur le site par défaut
    }
  }

  const safeTitle = escapeHtml(title);
  const safeDesc = escapeHtml(description);
  const safeImage = escapeHtml(imageUrl);
  const safeTargetUrl = escapeHtml(targetUrl);
  const canonicalUrl = eventId
    ? `${SITE_URL}/api/preview?id=${encodeURIComponent(eventId)}`
    : SITE_URL;
  const safeCanonicalUrl = escapeHtml(canonicalUrl);

  const html = `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDesc}" />

    <!-- Open Graph / Facebook / WhatsApp -->
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

    <!-- Redirection automatique pour les visiteurs humains -->
    <meta http-equiv="refresh" content="0;url=${safeTargetUrl}" />

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
        max-width: 420px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.6);
      }
      .poster {
        width: 100%;
        height: 200px;
        object-fit: cover;
        border-radius: 12px;
        margin-bottom: 20px;
      }
      h1 {
        font-size: 1.1rem;
        margin-bottom: 10px;
        color: #FFF;
      }
      p {
        font-size: 0.85rem;
        color: #AAA;
        line-height: 1.4;
        margin-bottom: 20px;
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
    <div class="card">
      <img src="${safeImage}" alt="${safeTitle}" class="poster" />
      <h1>${safeTitle}</h1>
      <p>${safeDesc}</p>
      <a href="${safeTargetUrl}" class="btn">Accéder à la billetterie &rarr;</a>
    </div>

    <script>
      // Redirection instantanée côté navigateur
      try {
        window.location.replace(${JSON.stringify(targetUrl)});
      } catch (e) {
        window.location.href = ${JSON.stringify(targetUrl)};
      }
    </script>
  </body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader(
    'Cache-Control',
    'public, max-age=60, s-maxage=300, stale-while-revalidate=86400'
  );
  return res.status(200).send(html);
}
