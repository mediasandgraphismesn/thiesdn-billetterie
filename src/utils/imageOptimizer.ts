/**
 * Optimiseur d'images haute performance pour mobile et PWA (Thièsdn Billetterie).
 * 
 * RÈGLE D'OR :
 * - Imgur bloque strictement images.weserv.nl (HTTP 429 Too Many Requests -> 404).
 *   Imgur fournit nativement des suffixes de miniatures ultra-rapides et légers :
 *   'm' (medium 320x320), 'l' (large 640x640), 'h' (huge 1024x1024).
 * - Unsplash fournit ses propres paramètres d'optimisation natifs (?w=...&q=...&auto=format).
 * - Les autres URLs distantes sont optimisées en WebP via weserv.
 * - Les Data URLs et assets locaux sont toujours servis directement.
 */
export function getOptimizedImageUrl(url?: string, width = 800, quality = 78): string {
  if (!url) return '';

  const cleanUrl = url.trim();

  // 1. Data URLs (QR Codes base64, canvas) -> pas de conversion
  if (cleanUrl.startsWith('data:image/')) {
    return cleanUrl;
  }

  // 2. Fichiers locaux du dossier public (ex: /logo-tight.png)
  if (cleanUrl.startsWith('/') || cleanUrl.startsWith('./')) {
    return cleanUrl;
  }

  // 3. Spécificité Imgur : BANNIR WESERV, utiliser les suffixes natifs Imgur en WebP
  const imgurMatch = cleanUrl.match(/^https?:\/\/(?:i\.)?imgur\.com\/([a-zA-Z0-9]+)(\.[a-zA-Z0-9]+)?$/i);
  if (imgurMatch) {
    const rawId = imgurMatch[1];

    // Déterminer le suffixe de miniature selon la largeur demandée
    let suffix = 'l'; // large par défaut (640px)
    if (width <= 320) {
      suffix = 'm'; // medium (320px, ~13 Ko en WebP)
    } else if (width <= 640) {
      suffix = 'l'; // large (640px, ~38 Ko en WebP)
    } else {
      suffix = 'h'; // huge (1024px)
    }

    // Si l'ID a déjà un suffixe (s, m, l, h, t, b), le remplacer par le suffixe adapté
    const baseId = rawId.length === 8 && /[smlhtb]$/i.test(rawId) ? rawId.slice(0, 7) : rawId;
    return `https://i.imgur.com/${baseId}${suffix}.webp`;
  }

  // 4. Spécificité Unsplash : Paramètres natifs Unsplash CDN en WebP
  if (cleanUrl.includes('images.unsplash.com')) {
    const baseUrl = cleanUrl.split('?')[0];
    return `${baseUrl}?w=${width}&q=${quality}&fm=webp&auto=format&fit=crop`;
  }

  // 5. Déjà optimisé via weserv -> garantir output=webp
  if (cleanUrl.includes('images.weserv.nl') || cleanUrl.includes('wsrv.nl')) {
    return cleanUrl.includes('output=') ? cleanUrl : `${cleanUrl}&output=webp`;
  }

  // 6. Autres URL distantes (Supabase Storage, CDN tiers) -> Conversion WebP adaptative
  if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
    return `https://images.weserv.nl/?url=${encodeURIComponent(cleanUrl)}&w=${width}&q=${quality}&output=webp&we`;
  }

  return cleanUrl;
}
