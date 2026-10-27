/**
 * Optimiseur d'images haute performance pour mobile et PWA.
 * Transforme automatiquement les affiches et avatars distants en WebP ultra-léger via proxy CDN mondial,
 * tout en préservant les Data URLs base64 et assets locaux publics.
 */
export function getOptimizedImageUrl(url?: string, width = 800, quality = 80): string {
  if (!url) return '';

  const cleanUrl = url.trim();

  // 1. Data URLs (ex: QR Codes base64, canvas exports) -> pas de conversion proxy
  if (cleanUrl.startsWith('data:image/')) {
    return cleanUrl;
  }

  // 2. Fichiers locaux du dossier public (ex: /logo-tight.png, /poster-kmou-jango.jpg)
  if (cleanUrl.startsWith('/') || cleanUrl.startsWith('./')) {
    return cleanUrl;
  }

  // 3. Déjà optimisé via weserv
  if (cleanUrl.includes('images.weserv.nl')) {
    return cleanUrl;
  }

  // 4. URL distantes (Supabase Storage, Unsplash, Imgur, etc.) -> Conversion WebP adaptative
  if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
    return `https://images.weserv.nl/?url=${encodeURIComponent(cleanUrl)}&w=${width}&q=${quality}&output=webp`;
  }

  return cleanUrl;
}
