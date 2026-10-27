import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ShieldCheck,
  Users,
  QrCode,
  Download,
  Plus,
  FileSpreadsheet,
  Share2,
  Printer,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Phone,
  Mail,
  Building,
  Sparkles,
  Newspaper,
  Copy,
  Check,
  Send,
  X,
  ExternalLink,
  RefreshCw,
  Eye,
} from 'lucide-react';
import QRCode from 'qrcode';
import {
  Accreditation,
  AccreditationType,
  AccreditationStatus,
  EventItem,
  UserProfile,
} from '../types';
import {
  getStoredAccreditations,
  fetchAccreditationsFromSupabase,
  createAccreditation,
  createBulkAccreditations,
} from '../services/supabase';
import { AccreditationBadgeModal } from '../components/AccreditationBadgeModal';

interface AccreditationsViewProps {
  currentRole: 'user' | 'promoter' | 'admin' | 'sales_agent' | 'artist';
  userProfile?: UserProfile;
  events?: EventItem[];
  defaultEventId?: string;
  onBack?: () => void;
}

export const AccreditationsView: React.FC<AccreditationsViewProps> = ({
  currentRole,
  userProfile,
  events = [],
  defaultEventId,
  onBack,
}) => {
  const [accreditations, setAccreditations] = useState<Accreditation[]>(getStoredAccreditations());
  const [selectedEventId, setSelectedEventId] = useState<string>(
    defaultEventId || (events[0]?.id ?? 'all')
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filtres & Recherche
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | AccreditationType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'scanned' | 'validated'>('all');

  // Modales
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [previewAccreditation, setPreviewAccreditation] = useState<Accreditation | null>(null);
  const [badgeQrDataUrl, setBadgeQrDataUrl] = useState<string>('');

  // Formulaire d'ajout individuel
  const [newType, setNewType] = useState<AccreditationType>('staff');
  const [newHolderName, setNewHolderName] = useState('');
  const [newHolderPhone, setNewHolderPhone] = useState('');
  const [newHolderEmail, setNewHolderEmail] = useState('');
  const [newOrganization, setNewOrganization] = useState('');
  const [newEventId, setNewEventId] = useState<string>(
    defaultEventId || (events[0]?.id ?? 'evt-soiree-prestige')
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formSuccessMessage, setFormSuccessMessage] = useState<string | null>(null);

  // Formulaire Import CSV
  const [csvContent, setCsvContent] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [csvImportResult, setCsvImportResult] = useState<{ success: boolean; count: number; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchronisation des accréditations
  const reloadAccreditations = async () => {
    setIsRefreshing(true);
    const filterId = selectedEventId === 'all' ? undefined : selectedEventId;
    const res = await fetchAccreditationsFromSupabase(filterId);
    if (res.accreditations && res.accreditations.length > 0) {
      setAccreditations(res.accreditations);
    } else {
      setAccreditations(getStoredAccreditations());
    }
    setIsRefreshing(false);
  };

  useEffect(() => {
    reloadAccreditations();
  }, [selectedEventId]);

  // Si l'utilisateur est 'artist', il ne peut pas émettre de badges presse
  const canIssuePresse = currentRole === 'promoter' || currentRole === 'admin';

  // Événement sélectionné pour le titre
  const currentEvent = useMemo(() => {
    if (selectedEventId === 'all') return null;
    return events.find((e) => e.id === selectedEventId) || null;
  }, [events, selectedEventId]);

  // Génération du QR Code lors de l'ouverture du badge
  useEffect(() => {
    if (previewAccreditation) {
      QRCode.toDataURL(previewAccreditation.qrCode, {
        width: 360,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      })
        .then((url) => setBadgeQrDataUrl(url))
        .catch((err) => console.error('Erreur génération QR Code badge:', err));
    } else {
      setBadgeQrDataUrl('');
    }
  }, [previewAccreditation]);

  // Filtrage des accréditations
  const filteredAccreditations = useMemo(() => {
    return accreditations.filter((acc) => {
      // Filtre Événement
      if (selectedEventId !== 'all' && acc.eventId !== selectedEventId) {
        return false;
      }

      // Filtre Type
      if (typeFilter !== 'all' && acc.type !== typeFilter) {
        return false;
      }

      // Filtre Statut
      if (statusFilter !== 'all') {
        if (statusFilter === 'scanned' && acc.status !== 'scanned') return false;
        if (statusFilter === 'validated' && acc.status === 'scanned') return false;
      }

      // Recherche textuelle
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = acc.holderName.toLowerCase().includes(q);
        const matchPhone = acc.holderPhone.toLowerCase().includes(q);
        const matchOrg = (acc.organization || '').toLowerCase().includes(q);
        const matchQr = acc.qrCode.toLowerCase().includes(q);
        return matchName || matchPhone || matchOrg || matchQr;
      }

      return true;
    });
  }, [accreditations, selectedEventId, typeFilter, statusFilter, searchQuery]);

  // Statistiques en temps réel (Cockpit)
  const stats = useMemo(() => {
    const list = selectedEventId === 'all'
      ? accreditations
      : accreditations.filter((a) => a.eventId === selectedEventId);

    const total = list.length;
    const staffCount = list.filter((a) => a.type === 'staff').length;
    const inviteCount = list.filter((a) => a.type === 'invite').length;
    const presseCount = list.filter((a) => a.type === 'presse').length;
    const scanned = list.filter((a) => a.status === 'scanned').length;
    const pending = total - scanned;
    const attendanceRate = total > 0 ? Math.round((scanned / total) * 100) : 0;

    return { total, staffCount, inviteCount, presseCount, scanned, pending, attendanceRate };
  }, [accreditations, selectedEventId]);

  // Copier le code QR
  const handleCopyCode = (qrCode: string) => {
    navigator.clipboard.writeText(qrCode);
    setCopiedId(qrCode);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Envoi WhatsApp avec lien wa.me pré-rempli
  const handleSendWhatsApp = (acc: Accreditation) => {
    const cleanPhone = acc.holderPhone.replace(/[^0-9]/g, '');
    const phoneWithCountry = cleanPhone.startsWith('221') ? cleanPhone : `221${cleanPhone}`;
    const badgeLabel =
      acc.type === 'staff'
        ? 'ACCÈS STAFF TECHNIQUE'
        : acc.type === 'invite'
        ? 'INVITÉ VIP / GUEST LIST'
        : 'PRESSE & MÉDIA OFFICIEL';

    const message =
      `*THIÈSDN BILLETTERIE — ACCRÉDITATION OFFICIELLE*\n\n` +
      `Bonjour *${acc.holderName}*,\n` +
      `Voici votre badge d'accès officiel pour l'événement : *${acc.eventTitle}*.\n\n` +
      `🏷️ *Type d'accès :* ${badgeLabel}\n` +
      (acc.organization ? `🏢 *Organisation :* ${acc.organization}\n` : '') +
      `🔑 *Code QR Unique :* ${acc.qrCode}\n\n` +
      `📌 *Consignes d'entrée :*\n` +
      `Veuillez présenter ce code à l'entrée dédiée munie du scanner.\n` +
      `Ce badge est nominatif, strictement personnel et à usage unique.\n\n` +
      `À très bientôt sur Thièsdn Billetterie !`;

    const url = `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  // Création individuelle
  const handleCreateIndividual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHolderName.trim() || !newHolderPhone.trim()) return;

    setIsSubmitting(true);
    const targetEvent = events.find((ev) => ev.id === newEventId) || events[0];

    const res = await createAccreditation({
      eventId: targetEvent ? targetEvent.id : 'evt-soiree-prestige',
      eventTitle: targetEvent ? targetEvent.title : 'Nuit du Baobab Prestige',
      type: newType,
      holderName: newHolderName.trim(),
      holderPhone: newHolderPhone.trim(),
      holderEmail: newHolderEmail.trim() || undefined,
      organization: newOrganization.trim() || undefined,
      createdBy: userProfile?.id || '',
      createdByName: userProfile?.name || 'Production Thièsdn',
      createdByRole: currentRole === 'artist' ? 'artist' : 'promoter',
    });

    setIsSubmitting(false);

    if (res.success && res.accreditation) {
      setFormSuccessMessage(`Accréditation ${newType.toUpperCase()} générée avec succès pour ${res.accreditation.holderName}.`);
      setAccreditations((prev) => [res.accreditation!, ...prev]);
      // Reset form
      setNewHolderName('');
      setNewHolderPhone('');
      setNewHolderEmail('');
      setNewOrganization('');
      setTimeout(() => {
        setFormSuccessMessage(null);
        setShowAddModal(false);
      }, 1500);
    }
  };

  // Traitement du CSV
  const handleProcessCsv = async () => {
    if (!csvContent.trim()) return;
    setIsImporting(true);

    const lines = csvContent
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const itemsToCreate: Array<Partial<Accreditation>> = [];
    const targetEvent = events.find((ev) => ev.id === newEventId) || events[0];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Ignorer la ligne d'en-tête éventuelle
      if (i === 0 && line.toLowerCase().includes('nom')) continue;

      // Découpage virgule ou point-virgule
      const parts = line.includes(';') ? line.split(';') : line.split(',');
      if (parts.length >= 2) {
        const holderName = parts[0]?.trim();
        const holderPhone = parts[1]?.trim();
        let type: AccreditationType = 'staff';
        const rawType = (parts[2] || '').toLowerCase().trim();
        if (rawType.includes('invit') || rawType.includes('vip') || rawType.includes('guest')) {
          type = 'invite';
        } else if (rawType.includes('press') || rawType.includes('media')) {
          type = canIssuePresse ? 'presse' : 'invite';
        } else {
          type = 'staff';
        }

        const organization = parts[3]?.trim();

        if (holderName && holderPhone) {
          itemsToCreate.push({
            eventId: targetEvent ? targetEvent.id : 'evt-soiree-prestige',
            eventTitle: targetEvent ? targetEvent.title : 'Nuit du Baobab Prestige',
            type,
            holderName,
            holderPhone,
            organization,
            createdBy: userProfile?.id || '',
            createdByName: userProfile?.name || 'Production',
            createdByRole: currentRole === 'artist' ? 'artist' : 'promoter',
          });
        }
      }
    }

    if (itemsToCreate.length === 0) {
      setCsvImportResult({
        success: false,
        count: 0,
        message: 'Aucune ligne valide détectée. Vérifiez le format (nom, telephone, type, organisation).',
      });
      setIsImporting(false);
      return;
    }

    const res = await createBulkAccreditations(itemsToCreate);
    setIsImporting(false);

    if (res.success) {
      setAccreditations((prev) => [...res.created, ...prev]);
      setCsvImportResult({
        success: true,
        count: res.created.length,
        message: `${res.created.length} accréditation(s) importée(s) et générée(s) avec succès !`,
      });
      setTimeout(() => {
        setShowCsvModal(false);
        setCsvContent('');
        setCsvImportResult(null);
      }, 1800);
    }
  };

  // Chargement fichier CSV local
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setCsvContent(text);
      }
    };
    reader.readAsText(file);
  };

  // Exporter la liste pour la sécurité (format CSV)
  const handleExportSecurityCsv = () => {
    const list = filteredAccreditations;
    if (list.length === 0) return;

    const headers = [
      'CODE_ACC',
      'TYPE',
      'NOM_TITULAIRE',
      'TELEPHONE',
      'ORGANISATION_ROLE',
      'STATUT',
      'HEURE_SCAN',
      'EMIS_PAR',
    ];

    const rows = list.map((a) => [
      `"${a.qrCode}"`,
      `"${a.type.toUpperCase()}"`,
      `"${a.holderName.replace(/"/g, '""')}"`,
      `"${a.holderPhone}"`,
      `"${(a.organization || '').replace(/"/g, '""')}"`,
      `"${a.status === 'scanned' ? 'SCANNE / ENTREE OK' : 'ATTENDU'}"`,
      `"${a.scannedAt ? new Date(a.scannedAt).toLocaleTimeString('fr-FR') : '-'}"`,
      `"${(a.createdByName || '').replace(/"/g, '""')}"`,
    ]);

    const csvData = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const eventName = currentEvent?.title?.replace(/[^a-zA-Z0-9]/g, '_') || 'Thiesdn';
    link.download = `Accreditations_Securite_${eventName}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Impression directe du badge (CSS print)
  const handlePrintBadge = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-300">
      {/* HEADER AVEC TITRE ET SÉLECTION D'ÉVÉNEMENT */}
      <div className="glass-panel p-5 sm:p-6 rounded-3xl border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase bg-[#8A2BE2]/20 text-[#DCB8FF] border border-[#8A2BE2]/30 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#E9C349]" />
              Module d'Accréditations
            </span>
            <span className="text-xs text-gray-400">• Thièsdn 2027</span>
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl font-black text-white tracking-tight">
            Staff, Invités VIP & Presse
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Émission des badges nominatifs, import CSV et contrôle d’accès sécurité
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Sélecteur d'événement */}
          {events.length > 0 && (
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="bg-[#1C1B1B] border border-white/10 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-[#8A2BE2]"
            >
              <option value="all">Tous les événements</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={reloadAccreditations}
            disabled={isRefreshing}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 transition-all flex items-center gap-1 text-xs"
            title="Rafraîchir"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#8A2BE2]' : ''}`} />
          </button>
        </div>
      </div>

      {/* 4 CARTES KPIS EN TEMPS RÉEL */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Accréditations */}
        <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-white/10 relative overflow-hidden">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Badges</span>
            <div className="p-2 rounded-xl bg-[#8A2BE2]/20 text-[#DCB8FF]">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="font-heading text-2xl sm:text-3xl font-black text-white">
            {stats.total}
          </p>
          <div className="mt-2 flex flex-wrap gap-1 text-[10px] font-bold">
            <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">
              {stats.staffCount} Staff
            </span>
            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
              {stats.inviteCount} Invités
            </span>
            <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300">
              {stats.presseCount} Presse
            </span>
          </div>
        </div>

        {/* Scannés à l'Entrée */}
        <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-emerald-500/20 bg-emerald-950/10 relative overflow-hidden">
          <div className="flex items-center justify-between text-emerald-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Scannés / Entrés</span>
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="font-heading text-2xl sm:text-3xl font-black text-emerald-300">
            {stats.scanned}
          </p>
          <p className="text-[11px] text-emerald-400/80 font-semibold mt-1">
            {stats.attendanceRate}% de présence à la porte
          </p>
        </div>

        {/* Non Scannés / Attendus */}
        <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-amber-500/20 bg-amber-950/10 relative overflow-hidden">
          <div className="flex items-center justify-between text-amber-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Attendus / Porte</span>
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="font-heading text-2xl sm:text-3xl font-black text-amber-300">
            {stats.pending}
          </p>
          <p className="text-[11px] text-amber-400/80 font-semibold mt-1">
            Badges en attente de présentation
          </p>
        </div>

        {/* Action Rapide Sécurité */}
        <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-[#E9C349]/30 bg-[#E9C349]/5 relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-[#E9C349] mb-1">
              <span className="text-xs font-bold uppercase tracking-wider">Secours Sécurité</span>
              <Download className="w-4 h-4" />
            </div>
            <p className="text-xs text-gray-300 mt-1">
              Export hors-ligne imprimable en cas de coupure réseau
            </p>
          </div>
          <button
            onClick={handleExportSecurityCsv}
            className="mt-3 w-full py-2 px-3 rounded-xl bg-[#E9C349] hover:bg-[#d8b23c] text-black font-heading font-extrabold text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Exporter CSV Sécurité
          </button>
        </div>
      </div>

      {/* ACTIONS PRINCIPALES : CRÉATION INDIVIDUELLE & IMPORT CSV */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary-glow px-4 py-2.5 rounded-xl font-heading font-extrabold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg"
          >
            <Plus className="w-4 h-4" />
            Nouvelle Accréditation
          </button>

          <button
            onClick={() => setShowCsvModal(true)}
            className="px-4 py-2.5 rounded-xl bg-[#1C1B1B] hover:bg-[#252525] border border-white/10 text-white font-heading font-extrabold text-xs uppercase tracking-wider flex items-center gap-2 transition-all"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#8A2BE2]" />
            Import CSV en Masse
          </button>
        </div>

        <button
          onClick={handleExportSecurityCsv}
          className="px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-gray-300 flex items-center gap-2 justify-center transition-all"
        >
          <Printer className="w-4 h-4 text-[#E9C349]" />
          Liste Imprimable Entrées
        </button>
      </div>

      {/* BARRE DE RECHERCHE ET FILTRES */}
      <div className="glass-panel p-4 rounded-2xl border border-white/10 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Input recherche */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par nom, téléphone, organisation, code ACC-..."
              className="w-full bg-[#141414] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#8A2BE2]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filtres Type */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                typeFilter === 'all'
                  ? 'bg-white text-black shadow-md'
                  : 'bg-white/5 text-gray-400 hover:text-white'
              }`}
            >
              Tous ({accreditations.length})
            </button>
            <button
              onClick={() => setTypeFilter('staff')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                typeFilter === 'staff'
                  ? 'bg-[#8A2BE2] text-white shadow-md'
                  : 'bg-purple-950/30 text-purple-300 hover:bg-purple-900/40'
              }`}
            >
              Staff ({stats.staffCount})
            </button>
            <button
              onClick={() => setTypeFilter('invite')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                typeFilter === 'invite'
                  ? 'bg-[#E9C349] text-black shadow-md'
                  : 'bg-amber-950/30 text-amber-300 hover:bg-amber-900/40'
              }`}
            >
              Invités VIP ({stats.inviteCount})
            </button>
            <button
              onClick={() => setTypeFilter('presse')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                typeFilter === 'presse'
                  ? 'bg-[#0284C7] text-white shadow-md'
                  : 'bg-sky-950/30 text-sky-300 hover:bg-sky-900/40'
              }`}
            >
              Presse ({stats.presseCount})
            </button>
          </div>

          {/* Filtres Statut */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold ${
                statusFilter === 'all' ? 'text-white border-b-2 border-[#8A2BE2]' : 'text-gray-400'
              }`}
            >
              Tous statuts
            </button>
            <button
              onClick={() => setStatusFilter('validated')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold ${
                statusFilter === 'validated' ? 'text-amber-300 border-b-2 border-amber-400' : 'text-gray-400'
              }`}
            >
              Attendus
            </button>
            <button
              onClick={() => setStatusFilter('scanned')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold ${
                statusFilter === 'scanned' ? 'text-emerald-300 border-b-2 border-emerald-400' : 'text-gray-400'
              }`}
            >
              Scannés
            </button>
          </div>
        </div>
      </div>

      {/* LISTE / TABLEAU DES ACCRÉDITATIONS */}
      {filteredAccreditations.length === 0 ? (
        <div className="glass-panel p-12 rounded-3xl border border-white/10 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-gray-400">
            <Users className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Aucune accréditation trouvée</h3>
            <p className="text-sm text-gray-400 mt-1 max-w-md mx-auto">
              {searchQuery || typeFilter !== 'all' || statusFilter !== 'all'
                ? 'Aucun résultat ne correspond à vos filtres actuels.'
                : 'Commencez par ajouter une accréditation individuelle ou importez une liste CSV.'}
            </p>
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="btn-primary-glow px-4 py-2 rounded-xl text-xs font-bold uppercase"
            >
              Créer la 1ère accréditation
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAccreditations.map((acc) => {
            const isScanned = acc.status === 'scanned';
            return (
              <div
                key={acc.id}
                className={`glass-panel p-4 sm:p-5 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  isScanned
                    ? 'border-emerald-500/20 bg-emerald-950/5'
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                {/* Colonne Gauche : Badge Type & Infos Titulaire */}
                <div className="flex items-start gap-3.5">
                  {/* Pastille Icone Type */}
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg ${
                      acc.type === 'staff'
                        ? 'bg-purple-950/60 border border-[#8A2BE2]/50 text-[#DCB8FF]'
                        : acc.type === 'invite'
                        ? 'bg-amber-950/60 border border-[#E9C349]/50 text-[#FFE58F]'
                        : 'bg-sky-950/60 border border-sky-500/50 text-sky-200'
                    }`}
                  >
                    {acc.type === 'staff' && <ShieldCheck className="w-6 h-6 text-[#8A2BE2]" />}
                    {acc.type === 'invite' && <Sparkles className="w-6 h-6 text-[#E9C349]" />}
                    {acc.type === 'presse' && <Newspaper className="w-6 h-6 text-sky-400" />}
                  </div>

                  <div>
                    {/* Badge Rôle */}
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      {acc.type === 'staff' && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-[#8A2BE2]/20 text-[#DCB8FF] border border-[#8A2BE2]/40">
                          ACCÈS STAFF
                        </span>
                      )}
                      {acc.type === 'invite' && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-[#E9C349]/20 text-[#FFE58F] border border-[#E9C349]/40">
                          INVITÉ VIP
                        </span>
                      )}
                      {acc.type === 'presse' && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-sky-500/20 text-sky-300 border border-sky-500/40">
                          PRESSE & MÉDIA
                        </span>
                      )}

                      {/* Statut Entrée */}
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase flex items-center gap-1 ${
                          isScanned
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-white/5 text-gray-400 border border-white/10'
                        }`}
                      >
                        {isScanned ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" /> Scanné à{' '}
                            {new Date(acc.scannedAt || '').toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3" /> Non scanné
                          </>
                        )}
                      </span>
                    </div>

                    {/* Nom et organisation */}
                    <h3 className="font-heading font-extrabold text-base text-white">
                      {acc.holderName}
                    </h3>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400 mt-1">
                      {acc.organization && (
                        <span className="flex items-center gap-1 text-[#E9C349] font-medium">
                          <Building className="w-3.5 h-3.5" />
                          {acc.organization}
                        </span>
                      )}
                      <span className="flex items-center gap-1 font-mono">
                        <Phone className="w-3 h-3 text-gray-500" />
                        {acc.holderPhone}
                      </span>
                      {acc.holderEmail && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3 text-gray-500" />
                          {acc.holderEmail}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Colonne Droite : Code QR & Boutons d'Action */}
                <div className="flex flex-wrap items-center justify-between md:justify-end gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-white/5">
                  {/* Badge Code QR cliquable */}
                  <button
                    onClick={() => handleCopyCode(acc.qrCode)}
                    title="Cliquer pour copier le code"
                    className="px-3 py-1.5 rounded-xl bg-black/40 hover:bg-black/60 border border-white/10 font-mono text-xs text-purple-300 font-bold flex items-center gap-1.5 transition-all"
                  >
                    <QrCode className="w-3.5 h-3.5 text-[#E9C349]" />
                    {acc.qrCode}
                    {copiedId === acc.qrCode ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3 text-gray-500" />
                    )}
                  </button>

                  {/* Bouton Voir Badge Nocturnal Elegance */}
                  <button
                    onClick={() => setPreviewAccreditation(acc)}
                    className="px-3 py-1.5 rounded-xl bg-[#8A2BE2]/20 hover:bg-[#8A2BE2]/30 text-[#DCB8FF] border border-[#8A2BE2]/40 text-xs font-bold flex items-center gap-1.5 transition-all"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Voir Badge
                  </button>

                  {/* Bouton WhatsApp direct */}
                  <button
                    onClick={() => handleSendWhatsApp(acc)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition-all"
                  >
                    <Send className="w-3.5 h-3.5" />
                    WhatsApp
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODALE PRÉVISUALISATION DU BADGE NOCTURNAL ELEGANCE AVEC LOGO CENTRÉ */}
      {/* ==================================================================== */}
      <AccreditationBadgeModal
        accreditation={previewAccreditation}
        isOpen={!!previewAccreditation}
        onClose={() => setPreviewAccreditation(null)}
        onSendWhatsApp={handleSendWhatsApp}
      />

      {/* ==================================================================== */}
      {/* MODALE D'AJOUT INDIVIDUEL                                            */}
      {/* ==================================================================== */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-[#111111] border border-white/20 rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <span className="text-[11px] font-black uppercase text-[#E9C349] tracking-wider">
                Création Sécurisée
              </span>
              <h2 className="font-heading text-2xl font-black text-white mt-0.5">
                Nouvelle Accréditation
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Émet un badge nominatif avec QR Code vérifiable à la porte
              </p>
            </div>

            {formSuccessMessage && (
              <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-500 text-emerald-200 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                {formSuccessMessage}
              </div>
            )}

            <form onSubmit={handleCreateIndividual} className="space-y-4">
              {/* Choix Événement */}
              {events.length > 0 && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                    Événement concerné
                  </label>
                  <select
                    value={newEventId}
                    onChange={(e) => setNewEventId(e.target.value)}
                    className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#8A2BE2]"
                  >
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.title} ({ev.city})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Choix Type Accréditation */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                  Type d'accès
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewType('staff')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                      newType === 'staff'
                        ? 'bg-[#8A2BE2]/20 border-[#8A2BE2] text-white'
                        : 'bg-[#181818] border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4 text-[#8A2BE2]" />
                    Staff
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewType('invite')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                      newType === 'invite'
                        ? 'bg-[#E9C349]/20 border-[#E9C349] text-[#FFE58F]'
                        : 'bg-[#181818] border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 text-[#E9C349]" />
                    Invité VIP
                  </button>

                  <button
                    type="button"
                    disabled={!canIssuePresse}
                    onClick={() => setNewType('presse')}
                    title={!canIssuePresse ? 'Réservé au promoteur ou admin' : ''}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                      !canIssuePresse
                        ? 'opacity-40 cursor-not-allowed bg-[#141414] border-white/5 text-gray-500'
                        : newType === 'presse'
                        ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                        : 'bg-[#181818] border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    <Newspaper className="w-4 h-4 text-sky-400" />
                    Presse
                  </button>
                </div>
                {!canIssuePresse && (
                  <p className="text-[10px] text-gray-500 mt-1 italic">
                    Note : Seul le promoteur principal peut délivrer des accréditations presse.
                  </p>
                )}
              </div>

              {/* Nom & Prénom */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                  Nom & Prénom du Titulaire *
                </label>
                <input
                  type="text"
                  required
                  value={newHolderName}
                  onChange={(e) => setNewHolderName(e.target.value)}
                  placeholder="Ex: Cheikh Tidiane Diop"
                  className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#8A2BE2]"
                />
              </div>

              {/* Téléphone WhatsApp */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                  Numéro de Téléphone (WhatsApp) *
                </label>
                <input
                  type="text"
                  required
                  value={newHolderPhone}
                  onChange={(e) => setNewHolderPhone(e.target.value)}
                  placeholder="Ex: +221 77 123 45 67"
                  className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#8A2BE2]"
                />
              </div>

              {/* Organisation / Rôle */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                  Organisation ou Rôle
                </label>
                <input
                  type="text"
                  value={newOrganization}
                  onChange={(e) => setNewOrganization(e.target.value)}
                  placeholder="Ex: Régie Son, Mairie de Thiès, RTS 1, Danseur..."
                  className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#8A2BE2]"
                />
              </div>

              {/* Email (Optionnel) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                  Adresse Email (Optionnel)
                </label>
                <input
                  type="email"
                  value={newHolderEmail}
                  onChange={(e) => setNewHolderEmail(e.target.value)}
                  placeholder="Ex: contact@organisation.sn"
                  className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#8A2BE2]"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="w-1/3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 text-xs font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-2/3 btn-primary-glow py-2.5 rounded-xl font-heading font-extrabold text-xs uppercase tracking-wider text-white flex items-center justify-center gap-2"
                >
                  {isSubmitting ? 'Génération...' : 'Émettre le Badge'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODALE IMPORT CSV EN MASSE                                           */}
      {/* ==================================================================== */}
      {showCsvModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl bg-[#111111] border border-white/20 rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl">
            <button
              onClick={() => setShowCsvModal(false)}
              className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <span className="text-[11px] font-black uppercase text-[#8A2BE2] tracking-wider">
                Import Rapide en Lot
              </span>
              <h2 className="font-heading text-2xl font-black text-white mt-0.5">
                Import CSV Accréditations
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Chargez un fichier ou collez votre liste pour générer tous les badges d’un coup
              </p>
            </div>

            {/* Instruction du Format */}
            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-1 text-xs">
              <p className="font-bold text-[#E9C349]">Format attendu (séparateur virgule ou point-virgule) :</p>
              <p className="font-mono text-gray-300 text-[11px]">
                nom, telephone, type, organisation
              </p>
              <p className="text-[10px] text-gray-400">
                Types autorisés : <code className="text-purple-300 font-bold">staff</code>,{' '}
                <code className="text-amber-300 font-bold">invite</code>,{' '}
                <code className="text-sky-300 font-bold">presse</code>.
              </p>
            </div>

            {csvImportResult && (
              <div
                className={`p-4 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                  csvImportResult.success
                    ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200'
                    : 'bg-red-950/80 border-red-500 text-red-200'
                }`}
              >
                {csvImportResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                )}
                {csvImportResult.message}
              </div>
            )}

            {/* Upload Fichier */}
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-2 transition-all"
              >
                <FileSpreadsheet className="w-4 h-4 text-[#8A2BE2]" />
                Choisir un fichier .CSV
              </button>
              <span className="text-xs text-gray-400">ou collez directement le texte ci-dessous :</span>
            </div>

            {/* Zone de Texte CSV */}
            <div>
              <textarea
                rows={6}
                value={csvContent}
                onChange={(e) => setCsvContent(e.target.value)}
                placeholder={`Mamadou Ndiaye, +221 77 111 22 33, staff, Régie Éclairage\nAïda Ba, +221 78 222 33 44, invite, Mairie de Thiès\nOumar Sow, +221 76 333 44 55, presse, Thiès TV`}
                className="w-full bg-[#181818] border border-white/10 rounded-2xl p-4 text-xs font-mono text-gray-200 placeholder-gray-600 focus:outline-none focus:border-[#8A2BE2]"
              />
            </div>

            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={() => setShowCsvModal(false)}
                className="w-1/3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 text-xs font-bold"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isImporting || !csvContent.trim()}
                onClick={handleProcessCsv}
                className="w-2/3 btn-primary-glow py-2.5 rounded-xl font-heading font-extrabold text-xs uppercase tracking-wider text-white flex items-center justify-center gap-2"
              >
                {isImporting ? 'Génération des Badges...' : 'Générer les Accréditations'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
