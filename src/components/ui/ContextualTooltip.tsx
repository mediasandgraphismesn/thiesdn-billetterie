import React, { useState } from 'react';
import { HelpCircle, ShieldAlert } from 'lucide-react';

interface ContextualTooltipProps {
  title: string;
  reason: string;
  remedy: string;
  variant?: 'info' | 'rbac';
  align?: 'left' | 'right';
}

/**
 * Infobulle contextuelle (survol + focus/clic tactile) expliquant pourquoi
 * une carte est vide ou restreinte (RBAC) et comment y remédier.
 */
export const ContextualTooltip: React.FC<ContextualTooltipProps> = ({
  title,
  reason,
  remedy,
  variant = 'info',
  align = 'right',
}) => {
  const [open, setOpen] = useState(false);

  const Icon = variant === 'rbac' ? ShieldAlert : HelpCircle;
  const badgeStyle =
    variant === 'rbac'
      ? 'bg-rose-500/15 text-rose-300 border-rose-500/40 hover:bg-rose-500/25'
      : 'bg-[#8A2BE2]/15 text-[#DCB8FF] border-[#8A2BE2]/40 hover:bg-[#8A2BE2]/25';

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-label={title}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold transition-colors cursor-pointer ${badgeStyle}`}
      >
        <Icon className="w-3.5 h-3.5 shrink-0" />
        <span>{variant === 'rbac' ? 'Accès RBAC' : 'Pourquoi ?'}</span>
      </button>

      {open && (
        <div
          role="tooltip"
          className={`absolute top-full mt-2 z-50 w-72 sm:w-80 p-3.5 rounded-2xl bg-[#121118] border border-[#E9C349]/40 shadow-2xl text-left space-y-2 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-heading font-extrabold text-[#E9C349]">
            <Icon className="w-4 h-4 shrink-0" />
            <span>{title}</span>
          </div>
          <p className="text-[11px] text-white leading-relaxed">
            <strong className="text-[#DCB8FF]">Cause : </strong>
            {reason}
          </p>
          <p className="text-[11px] text-emerald-300 leading-relaxed border-t border-white/10 pt-1.5">
            <strong>Action recommandée : </strong>
            {remedy}
          </p>
        </div>
      )}
    </div>
  );
};
