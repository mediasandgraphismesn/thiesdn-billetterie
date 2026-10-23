import { EventItem, UserProfile, UserTicket, NotificationItem } from '../types';

export const INITIAL_USER: UserProfile = {
  id: '',
  name: 'Mbaye Gueye',
  username: 'mbaye.gueye',
  email: 'mediasandgraphisme.sn@gmail.com',
  phone: '+221 77 458 74 74',
  city: 'Thiès',
  address: 'Grand Standing, Thiès',
  quartier: 'Grand Standing',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600&auto=format&fit=crop',
  isVip: false,
  role: 'user',
  isEmailConfirmed: false,
  termsAccepted: true,
  termsAcceptedAt: '2026-10-01T12:00:00Z',
  termsVersion: 'v1.0',
  connectedAccounts: {
    facebook: false,
    instagram: false,
    tiktok: false,
  },
  privacySettings: {
    publicProfile: false,
    biometricLogin: false,
    emailNotifications: true,
  },
};

export const INITIAL_EVENTS: EventItem[] = [];

export const INITIAL_TICKETS: UserTicket[] = [];

export const INITIAL_NOTIFICATIONS: NotificationItem[] = [];

export const CATEGORIES: { label: string; value: string; icon: string }[] = [
  { label: 'Tous', value: 'All', icon: 'auto_awesome' },
  { label: 'Galas & Prestige', value: 'Gala', icon: 'celebration' },
  { label: 'Concerts & Mbalax', value: 'Concert', icon: 'music_note' },
  { label: 'Festivals Plage', value: 'Festival', icon: 'festival' },
  { label: 'Nightlife & Clubs', value: 'Boîte de nuit', icon: 'nightlife' },
  { label: 'VIP Lounge', value: 'VIP Lounge', icon: 'local_bar' },
  { label: 'Culture & After-work', value: 'Culture', icon: 'groups' },
];

export const SENEGAL_CITIES = ['All', 'Thiès', 'Mbour', 'Saly', 'Dakar'];
