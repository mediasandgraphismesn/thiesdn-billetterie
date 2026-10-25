import React, { useState } from 'react';
import {
  Search,
  Filter,
  Calendar,
  MapPin,
  Clock,
  User,
  Edit3,
  Trash2,
  Archive,
  ArchiveRestore,
  PlusCircle,
  AlertTriangle,
  CheckCircle2,
  X,
  Save,
  Eye,
  ExternalLink,
  Layers,
  Sparkles,
} from 'lucide-react';
import { EventItem, EventStatus, CATEGORIES, SENEGAL_CITIES } from '../types';
import {
  deleteEventFromSupabase,
  updateEventStatusInSupabase,
  updateEventInSupabase,
} from '../services/supabase';

interface EventsManagementViewProps {
  events: EventItem[];
  onRefreshEvents: () => Promise<void>;
  onNavigateCreate: () => void;
  onPreviewEvent: (event: EventItem) => void;
}

export const EventsManagementView: React.FC<EventsManagementViewProps> = ({
  events,
  onRefreshEvents,
  onNavigateCreate,
  onPreviewEvent,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'all' | EventStatus>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Modal d'édition
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // État local du formulaire d'édition
  const [editForm, setEditForm] = useState({
    title: '',
    category: 'Gala',
    date: '',
    time: '20:00',
    venue: '',
    city: 'Thiès',
    quartier: '',
    price: 3500,
    posterUrl: '',
    status: 'approved' as EventStatus,
    description: '',
    longDescription: '',
    waveLinkPrevente: '',
    waveLinkJourJ: '',
    waveLinkVip: '',
  });

  // Modal de suppression
  const [deletingEvent, setDeletingEvent] = useState<EventItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Notifications toast
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Filtrage des événements
  const filteredEvents = events.filter((e) => {
    if (selectedStatus !== 'all' && e.status !== selectedStatus) return false;
    if (selectedCategory !== 'All' && e.category !== selectedCategory) return false;
    if (!searchQuery.trim()) return true;

    const q = searchQuery.toLowerCase();
    return (
      e.title.toLowerCase().includes(q) ||
      e.city.toLowerCase().includes(q) ||
      e.venue.toLowerCase().includes(q) ||
      (e.promoter?.name && e.promoter.name.toLowerCase().includes(q))
    );
  });

  // Compteurs
  const countAll = events.length;
  const countApproved = events.filter((e) => e.status === 'approved').length;
  const countPending = events.filter((e) => e.status === 'pending').length;
  const countRejected = events.filter((e) => e.status === 'rejected').length;
  const countArchived = events.filter((e) => e.status === 'archived').length;

  // Ouvrir la modale d'édition pré-remplie
  const handleOpenEdit = (event: EventItem) => {
    setEditingEvent(event);
    setEditError(null);
    setEditForm({
      title: event.title,
      category: event.category,
      date: event.date,
      time: event.time,
      venue: event.venue,
      city: event.city,
      quartier: event.quartier || '',
      price: event.price,
      posterUrl: event.posterUrl,
      status: event.status,
      description: event.description || '',
      longDescription: event.longDescription || '',
      waveLinkPrevente: event.waveLinkPrevente || '',
      waveLinkJourJ: event.waveLinkJourJ || '',
      waveLinkVip: event.waveLinkVip || '',
    });
  };

  // Sauvegarder la modification
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent) return;

    setIsSavingEdit(true);
    setEditError(null);

    const res = await updateEventInSupabase(editingEvent.id, {
      title: editForm.title,
      category: editForm.category,
      date: editForm.date,
      time: editForm.time,
      venue: editForm.venue,
      city: editForm.city,
      quartier: editForm.quartier,
      price: Number(editForm.price) || 0,
      posterUrl: editForm.posterUrl,
      status: editForm.status,
      description: editForm.description,
      longDescription: editForm.longDescription,
      waveLinkPrevente: editForm.waveLinkPrevente,
      waveLinkJourJ: editForm.waveLinkJourJ,
      waveLinkVip: editForm.waveLinkVip,
    });

    setIsSavingEdit(false);

    if (!res.success) {
      setEditError(res.error || 'Erreur lors de la mise à jour.');
      return;
    }

    setEditingEvent(null);
    await onRefreshEvents();
    showToast(`Événement "${editForm.title}" mis à jour avec succès !`);
  };

  // Archiver / Désarchiver un événement
  const handleToggleArchive = async (event: EventItem) => {
    const isCurrentlyArchived = event.status === 'archived';
    const newStatus: EventStatus = isCurrentlyArchived ? 'approved' : 'archived';

    const res = await updateEventStatusInSupabase(event.id, newStatus);
    if (!res.success) {
      showToast(res.error || "Erreur lors du changement de statut d'archivage.", 'error');
      return;
    }

    await onRefreshEvents();
    showToast(
      isCurrentlyArchived
        ? `Événement "${event.title}" restauré et désormais public (statut approuvé).`
        : `Événement "${event.title}" archivé (retiré du site public, conservé en base).`
    );
  };

  // Supprimer définitivement un événement
  const handleConfirmDelete = async () => {
    if (!deletingEvent) return;

    setIsDeleting(true);
    const res = await deleteEventFromSupabase(deletingEvent.id);
    setIsDeleting(false);

    if (!res.success) {
      showToast(res.error || 'Erreur lors de la suppression.', 'error');
      setDeletingEvent(null);
      return;
    }

    const title = deletingEvent.title;
    setDeletingEvent(null);
    await onRefreshEvents();
    showToast(`Événement "${title}" supprimé définitivement de Supabase.`);
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-300">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border text-sm font-semibold transition-all ${
            toastMessage.type === 'success'
              ? 'bg-[#181818] text-emerald-400 border-emerald-500/30 shadow-emerald-950/40'
              : 'bg-[#181818] text-rose-400 border-rose-500/30 shadow-rose-950/40'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header View */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#141414] p-6 rounded-3xl border border-white/10 shadow-xl">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-[#8A2BE2]/30 to-[#E9C349]/20 text-[#E9C349] border border-[#E9C349]/30">
              Console Super Admin
            </span>
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-white mt-1">
            Gestion Complète des Événements
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Catalogue unifié de tous les événements en base • Modification en direct, suppression et archivage
          </p>
        </div>

        <button
          onClick={onNavigateCreate}
          className="btn-primary-glow px-5 py-3 rounded-2xl font-heading font-bold text-xs tracking-wider flex items-center justify-center gap-2 text-white shrink-0 self-start md:self-auto"
        >
          <PlusCircle className="w-4 h-4 text-[#E9C349]" />
          <span>Créer un Nouvel Événement</span>
        </button>
      </div>

      {/* Filtres & Recherche */}
      <div className="bg-[#181818] p-4 sm:p-5 rounded-3xl border border-white/10 space-y-4">
        {/* Ligne 1 : Statuts */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedStatus('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              selectedStatus === 'all'
                ? 'bg-white text-black shadow-md'
                : 'bg-white/5 text-gray-400 hover:text-white border border-white/5'
            }`}
          >
            Tous ({countAll})
          </button>
          <button
            onClick={() => setSelectedStatus('approved')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              selectedStatus === 'approved'
                ? 'bg-emerald-500 text-white shadow-md'
                : 'bg-white/5 text-emerald-400/80 hover:text-emerald-300 border border-emerald-500/20'
            }`}
          >
            ✅ Approuvés ({countApproved})
          </button>
          <button
            onClick={() => setSelectedStatus('pending')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              selectedStatus === 'pending'
                ? 'bg-amber-500 text-black font-extrabold shadow-md'
                : 'bg-white/5 text-amber-400/80 hover:text-amber-300 border border-amber-500/20'
            }`}
          >
            ⏳ En attente ({countPending})
          </button>
          <button
            onClick={() => setSelectedStatus('rejected')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              selectedStatus === 'rejected'
                ? 'bg-rose-500 text-white shadow-md'
                : 'bg-white/5 text-rose-400/80 hover:text-rose-300 border border-rose-500/20'
            }`}
          >
            ❌ Rejetés ({countRejected})
          </button>
          <button
            onClick={() => setSelectedStatus('archived')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              selectedStatus === 'archived'
                ? 'bg-slate-600 text-white shadow-md'
                : 'bg-white/5 text-gray-400 hover:text-white border border-white/5'
            }`}
          >
            📦 Archivés ({countArchived})
          </button>
        </div>

        {/* Ligne 2 : Recherche & Catégorie */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-white/5">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par titre, ville, promoteur..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#111111] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#8A2BE2]"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-colors ${
                  selectedCategory === cat.value
                    ? 'bg-[#8A2BE2] text-white shadow-sm'
                    : 'bg-[#111111] text-gray-400 hover:text-white border border-white/5'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grille des Événements */}
      {filteredEvents.length === 0 ? (
        <div className="glass-panel p-12 rounded-3xl text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-white/5 text-gray-400 flex items-center justify-center mx-auto border border-white/10">
            <Layers className="w-8 h-8" />
          </div>
          <div>
            <h3 className="font-heading text-lg font-bold text-white">
              Aucun événement trouvé
            </h3>
            <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
              Aucun événement ne correspond à vos filtres actuels.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredEvents.map((event) => {
            const isArchived = event.status === 'archived';
            const isPending = event.status === 'pending';
            const isApproved = event.status === 'approved';
            const isRejected = event.status === 'rejected';

            return (
              <div
                key={event.id}
                className={`glass-panel rounded-3xl p-5 border transition-all flex flex-col justify-between group ${
                  isArchived
                    ? 'border-white/5 opacity-75 bg-[#141414]/60'
                    : 'border-white/10 hover:border-[#8A2BE2]/50 bg-[#161616]'
                }`}
              >
                <div className="space-y-4">
                  {/* Top Image + Badges */}
                  <div className="relative w-full h-44 rounded-2xl overflow-hidden bg-black/40">
                    <img
                      src={event.posterUrl}
                      alt={event.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                    {/* Statut Badge */}
                    <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                      {isApproved && (
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/90 text-white text-[10px] font-black uppercase tracking-wider backdrop-blur-md shadow-md">
                          ✅ Approuvé
                        </span>
                      )}
                      {isPending && (
                        <span className="px-2.5 py-1 rounded-lg bg-amber-500/90 text-black text-[10px] font-black uppercase tracking-wider backdrop-blur-md shadow-md">
                          ⏳ En attente
                        </span>
                      )}
                      {isRejected && (
                        <span className="px-2.5 py-1 rounded-lg bg-rose-500/90 text-white text-[10px] font-black uppercase tracking-wider backdrop-blur-md shadow-md">
                          ❌ Rejeté
                        </span>
                      )}
                      {isArchived && (
                        <span className="px-2.5 py-1 rounded-lg bg-slate-700/90 text-gray-200 text-[10px] font-black uppercase tracking-wider backdrop-blur-md shadow-md">
                          📦 Archivé
                        </span>
                      )}
                    </div>

                    {/* Catégorie */}
                    <div className="absolute top-3 right-3">
                      <span className="px-2.5 py-1 rounded-lg bg-black/70 border border-white/20 text-[#DCB8FF] text-[10px] font-bold backdrop-blur-md">
                        {event.category}
                      </span>
                    </div>

                    {/* Prix */}
                    <div className="absolute bottom-3 right-3">
                      <span className="px-3 py-1 rounded-xl bg-black/80 border border-[#E9C349]/40 text-[#E9C349] font-heading font-black text-xs backdrop-blur-md">
                        {event.priceLabel || `${event.price.toLocaleString('fr-FR')} FCFA`}
                      </span>
                    </div>
                  </div>

                  {/* Infos Événement */}
                  <div className="space-y-2">
                    <h3 className="font-heading text-lg font-extrabold text-white line-clamp-1 group-hover:text-[#E9C349] transition-colors">
                      {event.title}
                    </h3>

                    <div className="flex flex-col gap-1 text-xs text-gray-300">
                      <div className="flex items-center gap-1.5 text-gray-300">
                        <Calendar className="w-3.5 h-3.5 text-[#E9C349] shrink-0" />
                        <span>{event.date} à {event.time}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-400">
                        <MapPin className="w-3.5 h-3.5 text-[#8A2BE2] shrink-0" />
                        <span className="truncate">{event.venue}, {event.city}</span>
                      </div>
                    </div>

                    {/* Promoteur */}
                    <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                          <User className="w-3.5 h-3.5 text-gray-400" />
                        </div>
                        <span className="text-gray-300 truncate font-semibold">
                          {event.promoter?.name || 'Promoteur ThièsDN'}
                        </span>
                      </div>
                      <button
                        onClick={() => onPreviewEvent(event)}
                        className="text-[11px] text-[#DCB8FF] hover:underline flex items-center gap-1 shrink-0 ml-2 font-medium"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Aperçu</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* 3 BOUTONS D'ACTION (MODIFIER / SUPPRIMER / ARCHIVER) */}
                <div className="pt-4 mt-4 border-t border-white/10 grid grid-cols-3 gap-2">
                  {/* 1. Modifier */}
                  <button
                    onClick={() => handleOpenEdit(event)}
                    className="py-2.5 px-2 rounded-xl bg-white/5 hover:bg-[#8A2BE2]/20 border border-white/10 text-[11px] font-bold text-white hover:text-[#DCB8FF] flex items-center justify-center gap-1.5 transition-all"
                    title="Modifier les informations"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-[#DCB8FF]" />
                    <span>Modifier</span>
                  </button>

                  {/* 2. Archiver / Désarchiver */}
                  <button
                    onClick={() => handleToggleArchive(event)}
                    className={`py-2.5 px-2 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all ${
                      isArchived
                        ? 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                        : 'bg-white/5 hover:bg-amber-500/20 border-white/10 text-gray-300 hover:text-amber-300'
                    }`}
                    title={isArchived ? "Désarchiver (rendre public)" : "Archiver l'événement"}
                  >
                    {isArchived ? (
                      <>
                        <ArchiveRestore className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Restaurer</span>
                      </>
                    ) : (
                      <>
                        <Archive className="w-3.5 h-3.5 text-amber-400" />
                        <span>Archiver</span>
                      </>
                    )}
                  </button>

                  {/* 3. Supprimer */}
                  <button
                    onClick={() => setDeletingEvent(event)}
                    className="py-2.5 px-2 rounded-xl bg-white/5 hover:bg-rose-500/20 border border-white/10 text-[11px] font-bold text-gray-300 hover:text-rose-400 flex items-center justify-center gap-1.5 transition-all"
                    title="Supprimer définitivement"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>Supprimer</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODALE D'ÉDITION PRÉ-REMPLIE */}
      {editingEvent && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl bg-[#161616] border border-white/20 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#8A2BE2]/20 border border-[#8A2BE2]/40 flex items-center justify-center text-[#DCB8FF]">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-heading text-xl font-black text-white">
                    Modifier l'Événement
                  </h2>
                  <p className="text-xs text-gray-400">
                    ID: <span className="font-mono text-[10px] text-gray-300">{editingEvent.id}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingEvent(null)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4">
              {/* Titre */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-300">
                  Titre de l'Événement *
                </label>
                <input
                  type="text"
                  required
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full bg-[#111111] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#8A2BE2]"
                />
              </div>

              {/* Catégorie & Statut */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-gray-300">
                    Catégorie
                  </label>
                  <select
                    value={editForm.category}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                    className="w-full bg-[#111111] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#8A2BE2]"
                  >
                    {CATEGORIES.filter((c) => c.value !== 'All').map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-gray-300">
                    Statut en Base
                  </label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value as EventStatus })}
                    className="w-full bg-[#111111] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#8A2BE2]"
                  >
                    <option value="approved">Approuvé (Public)</option>
                    <option value="pending">En attente de modération</option>
                    <option value="rejected">Rejeté</option>
                    <option value="archived">Archivé (Masqué du public)</option>
                  </select>
                </div>
              </div>

              {/* Date & Heure */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-gray-300">
                    Date de l'Événement *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.date}
                    onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                    placeholder="ex: 25 Décembre 2026"
                    className="w-full bg-[#111111] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#8A2BE2]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-gray-300">
                    Heure *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.time}
                    onChange={(e) => setEditForm({ ...editForm, time: e.target.value })}
                    placeholder="ex: 20:00"
                    className="w-full bg-[#111111] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#8A2BE2]"
                  />
                </div>
              </div>

              {/* Lieu & Ville */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-gray-300">
                    Lieu / Salle *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.venue}
                    onChange={(e) => setEditForm({ ...editForm, venue: e.target.value })}
                    className="w-full bg-[#111111] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#8A2BE2]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-gray-300">
                    Ville *
                  </label>
                  <select
                    value={editForm.city}
                    onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                    className="w-full bg-[#111111] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#8A2BE2]"
                  >
                    {SENEGAL_CITIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Prix & Affiche URL */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-gray-300">
                    Prix Standard (FCFA) *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={editForm.price}
                    onChange={(e) => setEditForm({ ...editForm, price: Number(e.target.value) })}
                    className="w-full bg-[#111111] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#8A2BE2]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-gray-300">
                    URL de l'Affiche
                  </label>
                  <input
                    type="url"
                    value={editForm.posterUrl}
                    onChange={(e) => setEditForm({ ...editForm, posterUrl: e.target.value })}
                    className="w-full bg-[#111111] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#8A2BE2]"
                  />
                </div>
              </div>

              {/* Liens de Paiement Wave */}
              <div className="pt-2 border-t border-white/10 space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#E9C349]">
                  Liens de Paiement Mobile Money Wave
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">Prévente</label>
                    <input
                      type="url"
                      placeholder="https://pay.wave.com/..."
                      value={editForm.waveLinkPrevente}
                      onChange={(e) => setEditForm({ ...editForm, waveLinkPrevente: e.target.value })}
                      className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8A2BE2]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">Jour J</label>
                    <input
                      type="url"
                      placeholder="https://pay.wave.com/..."
                      value={editForm.waveLinkJourJ}
                      onChange={(e) => setEditForm({ ...editForm, waveLinkJourJ: e.target.value })}
                      className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8A2BE2]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">VIP Prestige</label>
                    <input
                      type="url"
                      placeholder="https://pay.wave.com/..."
                      value={editForm.waveLinkVip}
                      onChange={(e) => setEditForm({ ...editForm, waveLinkVip: e.target.value })}
                      className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8A2BE2]"
                    />
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-300">
                  Description Courte
                </label>
                <textarea
                  rows={2}
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full bg-[#111111] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#8A2BE2]"
                />
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingEvent(null)}
                  className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-gray-300 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="btn-primary-glow px-6 py-2.5 rounded-xl text-xs font-bold text-white flex items-center gap-2 transition-all"
                >
                  {isSavingEdit ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Enregistrer les Modifications</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE DE CONFIRMATION DE SUPPRESSION */}
      {deletingEvent && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#161616] border border-rose-500/30 rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl text-center">
            <div className="w-16 h-16 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/20">
              <Trash2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="font-heading text-lg font-bold text-white">
                Supprimer définitivement cet événement ?
              </h3>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                Vous êtes sur le point de supprimer{' '}
                <span className="text-white font-bold">"{deletingEvent.title}"</span>.
                Cette action supprimera l'événement de la base Supabase et est irréversible.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingEvent(null)}
                className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-gray-300 transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white flex items-center gap-2 shadow-lg shadow-rose-900/30 transition-all"
              >
                {isDeleting ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Confirmer la Suppression</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
