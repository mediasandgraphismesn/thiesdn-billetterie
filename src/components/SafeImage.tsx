import React, { useState } from 'react';
import { Ticket } from 'lucide-react';

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string | null;
  rawSrc?: string | null;
  alt: string;
  className?: string;
  fallbackClassName?: string;
}

/**
 * Composant SafeImage anti-fuite alt & résilient multi-sources.
 * Si l'URL principale échoue (ex: blocage CDN ou 404), il tente rawSrc si fourni.
 * Si tout échoue ou que src est vide, affiche un placeholder nocturne premium #121118/#2a1450
 * avec icône Ticket dorée sans JAMAIS faire fuiter de texte alt brut cassé.
 */
export const SafeImage: React.FC<SafeImageProps> = ({
  src,
  rawSrc,
  alt,
  className = '',
  fallbackClassName = '',
  ...rest
}) => {
  const [currentSrc, setCurrentSrc] = useState<string | null | undefined>(src);
  const [hasError, setHasError] = useState<boolean>(!src);
  const [hasTriedRaw, setHasTriedRaw] = useState<boolean>(false);

  // Mettre à jour si la prop src change
  React.useEffect(() => {
    setCurrentSrc(src);
    setHasError(!src);
    setHasTriedRaw(false);
  }, [src]);

  const handleError = () => {
    // Si on a une URL brute différente et qu'on ne l'a pas encore essayée
    if (rawSrc && rawSrc !== currentSrc && !hasTriedRaw) {
      setHasTriedRaw(true);
      setCurrentSrc(rawSrc);
      return;
    }
    setHasError(true);
  };

  if (!currentSrc || hasError) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#1c122c] via-[#121118] to-[#0A0A0A] border border-white/5 select-none ${fallbackClassName} ${className}`}
      >
        <div className="p-3 rounded-2xl bg-white/5 border border-[#E9C349]/20 shadow-inner flex items-center justify-center">
          <Ticket className="w-8 h-8 text-[#E9C349]/80" />
        </div>
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={handleError}
      className={`${className} object-cover`}
      {...rest}
    />
  );
};

export default SafeImage;
