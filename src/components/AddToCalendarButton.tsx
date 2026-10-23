import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, Download, ExternalLink } from 'lucide-react';
import {
  CalendarEventData,
  getGoogleCalendarUrl,
  getOutlookCalendarUrl,
  downloadIcsFile,
} from '../services/calendar';

interface AddToCalendarButtonProps {
  eventData: CalendarEventData;
  className?: string;
  variant?: 'primary' | 'secondary' | 'compact';
}

export const AddToCalendarButton: React.FC<AddToCalendarButtonProps> = ({
  eventData,
  className = '',
  variant = 'primary',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Fermeture automatique au clic en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleAppleIcs = () => {
    downloadIcsFile(eventData);
    setIsOpen(false);
  };

  const buttonStyles = {
    primary:
      'bg-[#E9C349] hover:bg-[#d4ad39] text-[#131313] font-heading font-extrabold shadow-lg shadow-[#E9C349]/20',
    secondary:
      'bg-[#1C1B1B] hover:bg-[#2A2A2A] text-white border border-white/10 hover:border-[#E9C349]/40',
    compact:
      'bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/5 text-xs py-1.5 px-3',
  };

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition-all ${buttonStyles[variant]}`}
      >
        <Calendar className="w-4 h-4 text-current" />
        <span>Ajouter au calendrier</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 bottom-full mb-2 sm:bottom-auto sm:top-full sm:mt-2 w-64 bg-[#1A1A1A] border border-white/10 rounded-2xl p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3 py-2 border-b border-white/5 text-[10px] uppercase font-bold text-gray-400 tracking-wider">
            Choisir votre calendrier
          </div>

          <div className="space-y-1 pt-1">
            {/* Google Agenda */}
            <a
              href={getGoogleCalendarUrl(eventData)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-between p-2.5 rounded-xl hover:bg-white/5 text-xs text-white transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-[10px]">
                  G
                </div>
                <span>Google Agenda</span>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-gray-500 group-hover:text-white" />
            </a>

            {/* Apple Calendar / iCal (.ics) */}
            <button
              type="button"
              onClick={handleAppleIcs}
              className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-white/5 text-xs text-white transition-colors group text-left"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-[#E9C349]/20 text-[#E9C349] flex items-center justify-center font-bold text-[10px]">
                  
                </div>
                <div>
                  <span className="block">Apple Calendar (iCal)</span>
                  <span className="text-[10px] text-gray-400">Fichier universel .ics</span>
                </div>
              </div>
              <Download className="w-3.5 h-3.5 text-gray-500 group-hover:text-[#E9C349]" />
            </button>

            {/* Outlook Calendar Web */}
            <a
              href={getOutlookCalendarUrl(eventData)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-between p-2.5 rounded-xl hover:bg-white/5 text-xs text-white transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-[10px]">
                  O
                </div>
                <span>Outlook Calendar</span>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-gray-500 group-hover:text-white" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
