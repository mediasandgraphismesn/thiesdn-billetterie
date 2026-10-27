import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidthClass?: string;
  showCloseButton?: boolean;
  className?: string;
  title?: string;
}

/**
 * Shell unifié pour toutes les modales de Thièsdn Billetterie.
 * - Fond certifié #0A0A0A / #121118 (bannissement du #171717).
 * - Mobile-first plein écran avec support env(safe-area-inset-*).
 * - Desktop centré et arrondi avec bordure élégante.
 * - Bouton de fermeture tactile accessible 44x44 px.
 */
export const ModalShell: React.FC<ModalShellProps> = ({
  isOpen,
  onClose,
  children,
  maxWidthClass = 'sm:max-w-2xl',
  showCloseButton = true,
  className = '',
  title,
}) => {
  // Fermeture par touche Escape et blocage du défilement d'arrière-plan
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Fenêtre modale'}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
    >
      {/* Conteneur principal de la modale */}
      <div
        className={`relative w-full h-full sm:h-auto sm:max-h-[90dvh] ${maxWidthClass} bg-[#0A0A0A] border-0 sm:border sm:border-white/10 rounded-none sm:rounded-3xl overflow-y-auto overflow-x-hidden shadow-2xl flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] ${className}`}
      >
        {/* Bouton Fermer discret 44x44 px */}
        {showCloseButton && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la modale"
            className="absolute top-3 right-3 sm:top-4 sm:right-4 z-40 w-11 h-11 min-h-[44px] min-w-[44px] rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/15 text-white/80 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-lg active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {children}
      </div>
    </div>
  );
};

export default ModalShell;
