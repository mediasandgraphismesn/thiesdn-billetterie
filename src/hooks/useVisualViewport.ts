import { useEffect, useState } from 'react';

interface VisualViewportMetrics {
  height: number;
  offsetTop: number;
  keyboardOffset: number;
}

/**
 * Suit la hauteur réelle du viewport visible sur iOS Safari / PWA
 * afin de maintenir les barres d'action sticky au-dessus du clavier virtuel.
 */
export function useVisualViewport(enabled: boolean): VisualViewportMetrics {
  const [metrics, setMetrics] = useState<VisualViewportMetrics>(() => {
    if (typeof window === 'undefined') {
      return { height: 800, offsetTop: 0, keyboardOffset: 0 };
    }
    const vv = window.visualViewport;
    const height = vv ? vv.height : window.innerHeight;
    const offsetTop = vv ? vv.offsetTop : 0;
    const keyboardOffset = vv
      ? Math.max(0, window.innerHeight - (vv.height + vv.offsetTop))
      : 0;
    return { height, offsetTop, keyboardOffset };
  });

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const update = () => {
      const vv = window.visualViewport;
      const height = vv ? vv.height : window.innerHeight;
      const offsetTop = vv ? vv.offsetTop : 0;
      const keyboardOffset = vv
        ? Math.max(0, window.innerHeight - (vv.height + vv.offsetTop))
        : 0;
      setMetrics({ height, offsetTop, keyboardOffset });
    };

    update();
    const vv = window.visualViewport;
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    window.addEventListener('resize', update);

    return () => {
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [enabled]);

  return metrics;
}
