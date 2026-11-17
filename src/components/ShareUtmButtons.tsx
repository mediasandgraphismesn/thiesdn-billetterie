import React, { useState } from 'react';
import { Share2, Facebook, Copy, Check } from 'lucide-react';
import { EventItem } from '../types';
import { buildEventShareUrl, trackEventAnalytics } from '../services/supabase';

interface ShareUtmButtonsProps {
  event: EventItem;
  baseShareUrl: string;
  isSalesUpcoming?: boolean;
  compact?: boolean;
}

const XTwitterIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

export const ShareUtmButtons: React.FC<ShareUtmButtonsProps> = ({
  event,
  baseShareUrl,
  isSalesUpcoming = false,
  compact = false,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);

  const whatsappUrl = buildEventShareUrl(baseShareUrl, 'whatsapp');
  const facebookUrl = buildEventShareUrl(baseShareUrl, 'facebook');
  const twitterUrl = buildEventShareUrl(baseShareUrl, 'twitter');
  const copyUrl = buildEventShareUrl(baseShareUrl, 'copy');

  const whatsappText =
    `🎟️ *${event.title}* à ${event.city || 'Thiès'} !\n\n` +
    `📅 *Date :* ${event.date} à ${event.time}\n` +
    `📍 *Lieu :* ${event.venue}${event.quartier ? ` (${event.quartier})` : ''}, ${event.city}\n` +
    `💰 *Tarif :* À partir de ${event.price.toLocaleString('fr-FR')} FCFA\n\n` +
    `⚡ ${
      isSalesUpcoming
        ? 'Les ventes ouvrent très bientôt ! Rejoignez la liste prioritaire ici :'
        : 'Réservez votre pass officiel 100% sécurisé via Wave en 1 clic :'
    }\n` +
    `👉 ${whatsappUrl}`;

  const waHref = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;
  const fbHref = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(facebookUrl)}`;
  const twHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    `${event.title} — ${event.date} à ${event.venue} (${event.city})`
  )}&url=${encodeURIComponent(twitterUrl)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2200);
    } catch {}
    trackEventAnalytics({
      eventId: event.id,
      action: 'share_copy_link',
      city: event.city,
      source: 'site',
      utmSource: 'direct',
      utmMedium: 'copy',
      utmCampaign: null,
    });
  };

  return (
    <div className={`flex flex-wrap items-center ${compact ? 'gap-1.5' : 'gap-2'}`}>
      <a
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() =>
          trackEventAnalytics({
            eventId: event.id,
            action: 'share_whatsapp',
            city: event.city,
            source: 'social',
            utmSource: 'whatsapp',
            utmMedium: 'social',
            utmCampaign: 'partage_event',
          })
        }
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/35 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition-all"
        title="Partager sur WhatsApp"
      >
        <Share2 className="w-3.5 h-3.5" />
        <span>WhatsApp</span>
      </a>

      <a
        href={fbHref}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() =>
          trackEventAnalytics({
            eventId: event.id,
            action: 'share_facebook',
            city: event.city,
            source: 'social',
            utmSource: 'facebook',
            utmMedium: 'social',
            utmCampaign: 'partage_event',
          })
        }
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/35 border border-blue-500/40 text-blue-300 text-xs font-bold transition-all"
        title="Partager sur Facebook"
      >
        <Facebook className="w-3.5 h-3.5" />
        <span>Facebook</span>
      </a>

      <a
        href={twHref}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() =>
          trackEventAnalytics({
            eventId: event.id,
            action: 'share_twitter',
            city: event.city,
            source: 'social',
            utmSource: 'twitter',
            utmMedium: 'social',
            utmCampaign: 'partage_event',
          })
        }
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold transition-all"
        title="Partager sur X (Twitter)"
      >
        <XTwitterIcon className="w-3.5 h-3.5" />
        <span>X / Twitter</span>
      </a>

      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#8A2BE2]/20 hover:bg-[#8A2BE2]/35 border border-[#8A2BE2]/40 text-[#DCB8FF] text-xs font-bold transition-all cursor-pointer"
        title="Copier le lien de l'événement"
      >
        {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        <span>{copiedLink ? 'Lien copié !' : 'Copier le lien'}</span>
      </button>
    </div>
  );
};
