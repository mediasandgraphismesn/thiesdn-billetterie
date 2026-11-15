/**
 * Étire dynamiquement l'histogramme de luminance RGBA (sans allocation répétitive)
 * afin d'améliorer le décodage QR sur les captures ou prises de vue sombres/peu contrastées.
 */
let contrastScratch = new Uint8ClampedArray(0);

export function enhanceContrastForLowLight(source: Uint8ClampedArray): Uint8ClampedArray {
  if (contrastScratch.length !== source.length) {
    contrastScratch = new Uint8ClampedArray(source.length);
  }

  let minLum = 255;
  let maxLum = 0;

  for (let i = 0; i < source.length; i += 16) {
    const lum = (source[i] * 77 + source[i + 1] * 150 + source[i + 2] * 29) >> 8;
    if (lum < minLum) minLum = lum;
    if (lum > maxLum) maxLum = lum;
  }

  const span = maxLum - minLum;
  if (span <= 8 || (minLum < 35 && maxLum > 220)) {
    contrastScratch.set(source);
    return contrastScratch;
  }

  const scale = 255 / span;
  for (let i = 0; i < source.length; i += 4) {
    const lum = (source[i] * 77 + source[i + 1] * 150 + source[i + 2] * 29) >> 8;
    const norm = Math.max(0, Math.min(255, (lum - minLum) * scale)) | 0;
    contrastScratch[i] = norm;
    contrastScratch[i + 1] = norm;
    contrastScratch[i + 2] = norm;
    contrastScratch[i + 3] = 255;
  }

  return contrastScratch;
}
