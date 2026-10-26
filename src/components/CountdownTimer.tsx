import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface CountdownTimerProps {
  targetDate: string | Date;
  onExpire?: () => void;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({
  targetDate,
  onExpire,
  size = 'md',
  label = 'Ouverture officielle des ventes dans :',
  className = '',
}) => {
  const calculateTimeRemaining = (): TimeRemaining => {
    const target = typeof targetDate === 'string' ? new Date(targetDate).getTime() : targetDate.getTime();
    const now = Date.now();
    const diff = target - now;

    if (isNaN(target) || diff <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / 1000 / 60) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    return { days, hours, minutes, seconds, isExpired: false };
  };

  const [timeLeft, setTimeLeft] = useState<TimeRemaining>(calculateTimeRemaining());

  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = calculateTimeRemaining();
      setTimeLeft(remaining);
      if (remaining.isExpired) {
        clearInterval(timer);
        if (onExpire) onExpire();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  const pad = (n: number) => String(n).padStart(2, '0');

  // Variations selon la taille (sm pour EventCard, md/lg pour EventDetailModal)
  if (size === 'sm') {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/80 border border-[#8A2BE2]/50 text-[#E9C349] font-mono text-[11px] font-bold shadow-md shadow-[#8A2BE2]/20 backdrop-blur-md ${className}`}>
        <Clock className="w-3 h-3 text-[#DCB8FF] animate-pulse" />
        <span>
          {timeLeft.days > 0 ? `${timeLeft.days}j ` : ''}
          {pad(timeLeft.hours)}h {pad(timeLeft.minutes)}m {pad(timeLeft.seconds)}s
        </span>
      </div>
    );
  }

  const isLg = size === 'lg';

  return (
    <div className={`rounded-2xl bg-gradient-to-br from-[#1A1820]/90 to-[#121118]/95 border border-[#8A2BE2]/40 p-4 sm:p-5 shadow-xl shadow-[#8A2BE2]/10 backdrop-blur-md text-center ${className}`}>
      {label && (
        <div className="flex items-center justify-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-[#E9C349] animate-pulse" />
          <span className="text-xs uppercase tracking-widest font-heading font-extrabold text-[#DCB8FF]">
            {label}
          </span>
        </div>
      )}

      <div className="grid grid-cols-4 gap-2 sm:gap-3 max-w-sm sm:max-w-md mx-auto">
        {/* Jours */}
        <div className="flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-xl bg-[#0D0C10] border border-white/10 shadow-inner group hover:border-[#8A2BE2]/60 transition-all">
          <span className={`font-mono font-black text-[#E9C349] tracking-tight ${isLg ? 'text-2xl sm:text-4xl' : 'text-xl sm:text-2xl'}`}>
            {pad(timeLeft.days)}
          </span>
          <span className="text-[9px] sm:text-[10px] uppercase font-bold text-gray-400 tracking-wider mt-0.5">
            Jours
          </span>
        </div>

        {/* Heures */}
        <div className="flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-xl bg-[#0D0C10] border border-white/10 shadow-inner group hover:border-[#8A2BE2]/60 transition-all">
          <span className={`font-mono font-black text-[#E9C349] tracking-tight ${isLg ? 'text-2xl sm:text-4xl' : 'text-xl sm:text-2xl'}`}>
            {pad(timeLeft.hours)}
          </span>
          <span className="text-[9px] sm:text-[10px] uppercase font-bold text-gray-400 tracking-wider mt-0.5">
            Heures
          </span>
        </div>

        {/* Minutes */}
        <div className="flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-xl bg-[#0D0C10] border border-white/10 shadow-inner group hover:border-[#8A2BE2]/60 transition-all">
          <span className={`font-mono font-black text-[#E9C349] tracking-tight ${isLg ? 'text-2xl sm:text-4xl' : 'text-xl sm:text-2xl'}`}>
            {pad(timeLeft.minutes)}
          </span>
          <span className="text-[9px] sm:text-[10px] uppercase font-bold text-gray-400 tracking-wider mt-0.5">
            Minutes
          </span>
        </div>

        {/* Secondes */}
        <div className="flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-xl bg-[#0D0C10] border border-[#8A2BE2]/40 shadow-inner group hover:border-[#8A2BE2] transition-all">
          <span className={`font-mono font-black text-[#E9C349] tracking-tight animate-pulse ${isLg ? 'text-2xl sm:text-4xl' : 'text-xl sm:text-2xl'}`}>
            {pad(timeLeft.seconds)}
          </span>
          <span className="text-[9px] sm:text-[10px] uppercase font-bold text-[#DCB8FF] tracking-wider mt-0.5">
            Secondes
          </span>
        </div>
      </div>
    </div>
  );
};
