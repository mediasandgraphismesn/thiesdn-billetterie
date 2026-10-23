export interface CalendarEventData {
  title: string;
  dateStr: string; // e.g. "25 Décembre 2026" or ISO
  timeStr?: string; // e.g. "20:00"
  venue: string;
  city?: string;
  tierName?: string;
  qrCode?: string;
  holderName?: string;
  description?: string;
}

const MONTH_MAP: Record<string, number> = {
  janvier: 0,
  février: 1,
  fevrier: 1,
  mars: 2,
  avril: 3,
  mai: 4,
  juin: 5,
  juillet: 6,
  août: 7,
  aout: 7,
  septembre: 8,
  octobre: 9,
  novembre: 10,
  décembre: 11,
  decembre: 11,
};

/**
 * Parse une date d'événement (en français ou ISO) et retourne les dates de début et de fin.
 */
export const parseEventDates = (
  dateStr: string,
  timeStr: string = '20:00',
  durationHours: number = 4
): { startDate: Date; endDate: Date } => {
  let startDate = new Date();

  // 1. Tenter un parsing ISO direct
  const isoAttempt = new Date(dateStr);
  if (!isNaN(isoAttempt.getTime()) && dateStr.includes('-')) {
    startDate = isoAttempt;
  } else {
    // 2. Parser le format français "25 Décembre 2026"
    const match = dateStr.match(/(\d{1,2})\s+([a-zA-ZÀ-ÿ]+)\s+(\d{4})/i);
    if (match) {
      const day = parseInt(match[1], 10);
      const monthName = match[2].toLowerCase().trim();
      const year = parseInt(match[3], 10);
      const month = MONTH_MAP[monthName] ?? 11; // Décembre par défaut

      let hours = 20;
      let minutes = 0;
      const timeMatch = timeStr.match(/(\d{1,2})[h:H](\d{2})?/);
      if (timeMatch) {
        hours = parseInt(timeMatch[1], 10);
        minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      }

      startDate = new Date(year, month, day, hours, minutes);
    }
  }

  // Si invalide, repli sur 25 Décembre 2026 à 20h
  if (isNaN(startDate.getTime())) {
    startDate = new Date(2026, 11, 25, 20, 0);
  }

  // Date de fin : début + durée (par défaut 4 heures)
  const endDate = new Date(startDate.getTime() + durationHours * 60 * 60 * 1000);

  return { startDate, endDate };
};

/**
 * Formate une date en chaîne UTC pour Google & ICS (YYYYMMDDTHHmmssZ)
 */
export const formatToUtcString = (date: Date): string => {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
};

/**
 * Génère le lien direct Google Agenda
 */
export const getGoogleCalendarUrl = (data: CalendarEventData): string => {
  const { startDate, endDate } = parseEventDates(data.dateStr, data.timeStr);
  const startUtc = formatToUtcString(startDate);
  const endUtc = formatToUtcString(endDate);

  const location = `${data.venue}${data.city ? `, ${data.city}` : ''}`;
  const details = [
    data.description || `Événement exclusif réservé sur Thièsdn Billetterie.`,
    data.tierName ? `Formule : ${data.tierName}` : '',
    data.holderName ? `Titulaire : ${data.holderName}` : '',
    data.qrCode ? `Pass QR : ${data.qrCode}` : '',
    `Plateforme officielle : https://thiesdn.mgartswork.site/`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: data.title,
    dates: `${startUtc}/${endUtc}`,
    location,
    details,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

/**
 * Génère le lien direct Outlook Calendar Web
 */
export const getOutlookCalendarUrl = (data: CalendarEventData): string => {
  const { startDate, endDate } = parseEventDates(data.dateStr, data.timeStr);
  const location = `${data.venue}${data.city ? `, ${data.city}` : ''}`;
  const details = [
    data.description || `Événement réservé sur Thièsdn Billetterie.`,
    data.tierName ? `Formule : ${data.tierName}` : '',
    data.holderName ? `Titulaire : ${data.holderName}` : '',
    data.qrCode ? `Pass QR : ${data.qrCode}` : '',
    `Site web : https://thiesdn.mgartswork.site/`,
  ]
    .filter(Boolean)
    .join('\n');

  const params = new URLSearchParams({
    subject: data.title,
    body: details,
    location,
    startdt: startDate.toISOString(),
    enddt: endDate.toISOString(),
  });

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
};

/**
 * Génère et télécharge un fichier universel .ics (Apple Calendar, Mac, iPhone, Outlook desktop, Android)
 */
export const downloadIcsFile = (data: CalendarEventData): void => {
  const { startDate, endDate } = parseEventDates(data.dateStr, data.timeStr);
  const startUtc = formatToUtcString(startDate);
  const endUtc = formatToUtcString(endDate);
  const nowUtc = formatToUtcString(new Date());

  const location = `${data.venue}${data.city ? `, ${data.city}` : ''}`;
  const details = [
    data.description || 'Événement officiel sur Thièsdn Billetterie.',
    data.tierName ? `Formule : ${data.tierName}` : '',
    data.holderName ? `Titulaire : ${data.holderName}` : '',
    data.qrCode ? `Billet QR Code : ${data.qrCode}` : '',
    'Site officiel : https://thiesdn.mgartswork.site/',
  ]
    .filter(Boolean)
    .join('\\n');

  // Format RFC 5545 iCalendar standard
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Thiesdn Billetterie//DAW Digital Arts Work//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:thiesdn-${Date.now()}@thiesdn.mgartswork.site`,
    `DTSTAMP:${nowUtc}`,
    `DTSTART:${startUtc}`,
    `DTEND:${endUtc}`,
    `SUMMARY:${data.title.replace(/[,;]/g, ' ')}`,
    `DESCRIPTION:${details}`,
    `LOCATION:${location.replace(/[,;]/g, ' ')}`,
    'URL:https://thiesdn.mgartswork.site/',
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  const cleanTitle = data.title.replace(/[^a-zA-Z0-9]/g, '_');
  a.href = url;
  a.download = `Evenement-Thiesdn-${cleanTitle}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};
