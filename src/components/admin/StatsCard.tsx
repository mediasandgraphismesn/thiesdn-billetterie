import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  badge?: string;
  badgeColor?: string;
  glowColor?: 'purple' | 'gold' | 'emerald' | 'rose';
  onClick?: () => void;
  alert?: boolean;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  badge,
  badgeColor,
  glowColor = 'purple',
  onClick,
  alert = false,
}) => {
  const getGlowClasses = () => {
    switch (glowColor) {
      case 'gold':
        return 'hover:border-[#E9C349]/50 shadow-[0_4px_20px_rgba(233,195,73,0.1)]';
      case 'emerald':
        return 'hover:border-emerald-500/50 shadow-[0_4px_20px_rgba(16,185,129,0.1)]';
      case 'rose':
        return 'hover:border-rose-500/50 shadow-[0_4px_20px_rgba(244,63,94,0.15)]';
      default:
        return 'hover:border-[#8A2BE2]/50 shadow-[0_4px_20px_rgba(138,43,226,0.1)]';
    }
  };

  const getIconContainerStyle = () => {
    switch (glowColor) {
      case 'gold':
        return 'bg-[#E9C349]/15 text-[#E9C349] border border-[#E9C349]/30';
      case 'emerald':
        return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
      case 'rose':
        return 'bg-rose-500/20 text-rose-400 border border-rose-500/30';
      default:
        return 'bg-[#8A2BE2]/15 text-[#DCB8FF] border border-[#8A2BE2]/30';
    }
  };

  return (
    <div
      onClick={onClick}
      className={`glass-panel p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden ${
        onClick ? 'cursor-pointer hover:scale-[1.02]' : ''
      } ${getGlowClasses()} ${alert ? 'border-rose-500/60 bg-[#241315]' : 'border-white/10'}`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
          {title}
        </span>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 ${getIconContainerStyle()}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      <div className="space-y-1">
        <div className="text-2xl sm:text-3xl font-extrabold text-white font-heading tracking-tight">
          {value}
        </div>
        {subtitle && (
          <p className="text-xs text-gray-400 flex items-center gap-1.5 font-medium">
            {badge && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeColor || 'bg-white/10 text-white'}`}>
                {badge}
              </span>
            )}
            <span>{subtitle}</span>
          </p>
        )}
      </div>

      {alert && (
        <div className="absolute top-0 right-0 w-2 h-full bg-rose-500 animate-pulse" />
      )}
    </div>
  );
};
