import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://jgvuzlchemqcfygsylln.supabase.co';

const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  'sb_publishable_TX1CK_Ahwd5hUwTwRAagpg_4c2UwyDj';

const SITE_URL = 'https://billetterie.thiesdn.site';

function slugify(value: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function escapeXml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export default async function handler(_req: any, res: any) {
  const staticUrls = [
    { loc: `${SITE_URL}/`, changefreq: 'daily', priority: '1.0' },
    { loc: `${SITE_URL}/explorer`, changefreq: 'daily', priority: '0.9' },
    { loc: `${SITE_URL}/evenements/thies`, changefreq: 'daily', priority: '0.9' },
    { loc: `${SITE_URL}/evenements/dakar`, changefreq: 'daily', priority: '0.9' },
    { loc: `${SITE_URL}/evenements/saly`, changefreq: 'daily', priority: '0.85' },
    { loc: `${SITE_URL}/evenements/mbour`, changefreq: 'daily', priority: '0.85' },
    { loc: `${SITE_URL}/showcase`, changefreq: 'weekly', priority: '0.7' },
    { loc: `${SITE_URL}/cgv`, changefreq: 'monthly', priority: '0.5' },
  ];

  const eventUrls: { loc: string; lastmod?: string; changefreq: string; priority: string }[] = [];

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .ilike('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(200);

    if (!error && Array.isArray(data)) {
      for (const row of data) {
        if (!row?.id || row.is_deleted || row.deleted_at) continue;
        const slug = slugify(row.title || 'evenement');
        const path = slug
          ? `/evenement/${slug}--${encodeURIComponent(row.id)}`
          : `/evenement/${encodeURIComponent(row.id)}`;
        const lastmodRaw = row.created_at;
        const lastmod = lastmodRaw ? new Date(lastmodRaw).toISOString().split('T')[0] : undefined;
        eventUrls.push({
          loc: `${SITE_URL}${path}`,
          lastmod,
          changefreq: 'daily',
          priority: '0.9',
        });
      }
    }
  } catch (err) {
    console.error('Erreur génération sitemap Supabase:', err);
  }

  const allUrls = [...staticUrls, ...eventUrls];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls
  .map(
    (entry) => `  <url>
    <loc>${escapeXml(entry.loc)}</loc>${
      'lastmod' in entry && entry.lastmod ? `\n    <lastmod>${escapeXml(entry.lastmod)}</lastmod>` : ''
    }
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=900, stale-while-revalidate=3600');
  return res.status(200).send(xml);
}
