import React, { useState } from 'react';
import {
  Settings,
  Smartphone,
  Save,
  CheckCircle2,
  AlertCircle,
  Database,
  Key,
  ShieldCheck,
  Percent,
  RefreshCw,
  Copy,
  Check,
  SlidersHorizontal,
  Contrast,
  RotateCcw,
} from 'lucide-react';
import {
  getStoredPaymentSettings,
  savePaymentSettings,
  saveSupabaseCredentials,
  isSupabaseConfigured,
} from '../services/supabase';
import { AdminDensity, useAdminPreferences } from '../hooks/useAdminPreferences';

interface PlatformSettingsViewProps {
  onBackToDashboard: () => void;
}

export const PlatformSettingsView: React.FC<PlatformSettingsViewProps> = ({
  onBackToDashboard,
}) => {
  const initialSettings = getStoredPaymentSettings();
  const [waveNumber, setWaveNumber] = useState(initialSettings.waveNumber || 'SN 85 71 88 49');
  const [waveBeneficiary, setWaveBeneficiary] = useState(initialSettings.waveBeneficiary || 'Wave Business — ThièsDN');
  const [omNumber, setOmNumber] = useState(initialSettings.omNumber || '+221 77 458 74 74');
  const [omBeneficiary, setOmBeneficiary] = useState(initialSettings.omBeneficiary || 'Thièsdn Billetterie SARL');

  const [supabaseUrl, setSupabaseUrl] = useState(localStorage.getItem('VITE_SUPABASE_URL') || '');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(localStorage.getItem('VITE_SUPABASE_ANON_KEY') || '');

  const [saveToast, setSaveToast] = useState<string | null>(null);
  const { density, setDensity, highContrast, setHighContrast, resetCardOrder } =
    useAdminPreferences(true);

  const handleSavePaymentSettings = () => {
    savePaymentSettings({
      waveNumber,
      waveBeneficiary,
      omNumber,
      omBeneficiary,
    });
    setSaveToast('Paramètres de paiement Mobile Money enregistrés avec succès !');
    setTimeout(() => setSaveToast(null), 3000);
  };

  const handleSaveDatabaseCredentials = () => {
    saveSupabaseCredentials(supabaseUrl, supabaseAnonKey);
    setSaveToast('Identifiants Supabase mis à jour avec succès !');
    setTimeout(() => setSaveToast(null), 3000);
  };

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-300">
      {saveToast && (
        <div className="fixed top-20 right-6 z-50 p-4 rounded-2xl bg-[#1C1B1B] border border-emerald-500 shadow-2xl text-white flex items-center gap-3 animate-in slide-in-from-top-4 duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-semibold">{saveToast}</span>
        </div>
      )}

      {/* Header */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-white/10">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-amber-500/20 text-[#E9C349] border border-amber-500/40 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full flex items-center gap-1.5">
              <Settings className="w-3.5 h-3.5" />
              Configuration Système
            </span>
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Paramètres de la Plateforme
          </h1>
          <p className="text-xs sm:text-sm text-[#E5E2E1] mt-1">
            Gérez les numéros Wave/Orange Money de secours, les taux de commissionnement et la connectivité Supabase.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Module 1 : Numéros de Paiement Manuel Secours */}
        <section className="glass-panel rounded-3xl p-6 border border-white/10 space-y-4">
          <div className="border-b border-white/10 pb-3 flex items-center justify-between">
            <h2 className="text-base font-heading font-bold text-white flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-[#8A2BE2]" />
              <span>Numéros Récepteurs Wave & OM</span>
            </h2>
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
              UEMOA Sénégal
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-300 block mb-1">
                Numéro Wave Officiel
              </label>
              <input
                type="text"
                value={waveNumber}
                onChange={(e) => setWaveNumber(e.target.value)}
                className="w-full bg-[#141414] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#8A2BE2]"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-300 block mb-1">
                Bénéficiaire Wave
              </label>
              <input
                type="text"
                value={waveBeneficiary}
                onChange={(e) => setWaveBeneficiary(e.target.value)}
                className="w-full bg-[#141414] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#8A2BE2]"
              />
            </div>

            <div className="pt-2 border-t border-white/5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-300 block mb-1">
                Numéro Orange Money Officiel
              </label>
              <input
                type="text"
                value={omNumber}
                onChange={(e) => setOmNumber(e.target.value)}
                className="w-full bg-[#141414] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#8A2BE2]"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-300 block mb-1">
                Bénéficiaire Orange Money
              </label>
              <input
                type="text"
                value={omBeneficiary}
                onChange={(e) => setOmBeneficiary(e.target.value)}
                className="w-full bg-[#141414] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#8A2BE2]"
              />
            </div>

            <button
              onClick={handleSavePaymentSettings}
              className="w-full btn-primary-glow py-3 rounded-xl text-xs font-bold font-heading uppercase tracking-wider flex items-center justify-center gap-2 mt-4"
            >
              <Save className="w-4 h-4" />
              <span>Enregistrer Paramètres Paiement</span>
            </button>
          </div>
        </section>

        {/* Module 2 : Commissionnement & Règle Financière */}
        <div className="space-y-6">
          <section className="glass-panel rounded-3xl p-6 border border-white/10 space-y-4">
            <div className="border-b border-white/10 pb-3 flex items-center justify-between">
              <h2 className="text-base font-heading font-bold text-white flex items-center gap-2">
                <Percent className="w-5 h-5 text-[#E9C349]" />
                <span>Modèle Financier (Option 3)</span>
              </h2>
              <span className="text-[10px] font-bold text-[#E9C349] bg-[#E9C349]/10 px-2.5 py-0.5 rounded-full border border-[#E9C349]/20">
                Immuable
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-[#141414] border border-white/5 flex items-center justify-between">
                <span className="text-gray-300">Commission Plateforme Thièsdn</span>
                <span className="font-extrabold text-[#E9C349] text-sm">10%</span>
              </div>

              <div className="p-3 rounded-xl bg-[#141414] border border-white/5 flex items-center justify-between">
                <span className="text-gray-300">Part Promoteurs & Artistes</span>
                <span className="font-extrabold text-emerald-400 text-sm">90%</span>
              </div>

              <div className="p-3 rounded-xl bg-[#141414] border border-white/5 flex items-center justify-between">
                <span className="text-gray-300">Frais Opérateur Mobile Money</span>
                <span className="font-extrabold text-blue-400 text-sm">+1% (payé par le client)</span>
              </div>
            </div>
          </section>

          {/* Module 3 : Connectivité Base de Données Supabase */}
          <section className="glass-panel rounded-3xl p-6 border border-white/10 space-y-4">
            <div className="border-b border-white/10 pb-3 flex items-center justify-between">
              <h2 className="text-base font-heading font-bold text-white flex items-center gap-2">
                <Database className="w-5 h-5 text-emerald-400" />
                <span>Connecteur Supabase</span>
              </h2>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                isSupabaseConfigured()
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
              }`}>
                {isSupabaseConfigured() ? 'Connecté' : 'Mode Local'}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-300 block mb-1">
                  URL du Projet
                </label>
                <input
                  type="text"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  placeholder="https://xyz.supabase.co"
                  className="w-full bg-[#141414] border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-[#8A2BE2]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-300 block mb-1">
                  Clé Anonyme (anon key)
                </label>
                <input
                  type="password"
                  value={supabaseAnonKey}
                  onChange={(e) => setSupabaseAnonKey(e.target.value)}
                  placeholder="eyJh..."
                  className="w-full bg-[#141414] border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-[#8A2BE2]"
                />
              </div>

              <button
                onClick={handleSaveDatabaseCredentials}
                className="w-full bg-[#1F1F1F] hover:bg-[#2A2A2A] text-white border border-white/10 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 mt-2"
              >
                <Key className="w-3.5 h-3.5 text-[#E9C349]" />
                <span>Sauvegarder Identifiants</span>
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* Module 4 : Personnalisation UX Admin (Densité, Contraste WCAG AAA & Disposition) */}
      <section className="glass-panel rounded-3xl p-6 border border-[#8A2BE2]/30 space-y-5">
        <div className="border-b border-white/10 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-base font-heading font-bold text-white flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-[#E9C349]" />
            <span>Personnalisation UX &amp; Accessibilité Dashboard Admin</span>
          </h2>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#8A2BE2]/20 text-[#DCB8FF] border border-[#8A2BE2]/40 self-start sm:self-auto">
            Sauvegardé localement
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Sélecteur de Densité */}
          <div className="p-4 rounded-2xl bg-[#141414] border border-white/10 space-y-3">
            <div>
              <h3 className="text-xs font-heading font-bold text-white uppercase tracking-wider">
                Densité d&apos;affichage
              </h3>
              <p className="text-[11px] text-gray-300 mt-0.5">
                Ajuste dynamiquement les marges internes des cartes du tableau de bord.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: 'compact', label: 'Compact' },
                  { id: 'normal', label: 'Normal' },
                  { id: 'spacious', label: 'Spacieux' },
                ] as ReadonlyArray<{ id: AdminDensity; label: string }>
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setDensity(option.id);
                    setSaveToast(`Densité "${option.label}" appliquée !`);
                    setTimeout(() => setSaveToast(null), 2500);
                  }}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    density === option.id
                      ? 'bg-[#8A2BE2] text-white border-[#DCB8FF]/50 shadow-md'
                      : 'bg-black/40 text-gray-300 border-white/10 hover:text-white'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Toggle Contraste Élevé WCAG AAA */}
          <div className="p-4 rounded-2xl bg-[#141414] border border-white/10 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-xs font-heading font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Contrast className="w-4 h-4 text-[#E9C349]" />
                  <span>Mode Contraste Élevé</span>
                </h3>
                <p className="text-[11px] text-gray-300 mt-0.5">
                  Norme WCAG AAA : fond noir pur (#000000), textes blancs (#FFFFFF) et bordures épaisses.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const next = !highContrast;
                setHighContrast(next);
                setSaveToast(
                  next ? 'Mode Contraste Élevé (WCAG AAA) activé !' : 'Thème Nocturnal standard rétabli.'
                );
                setTimeout(() => setSaveToast(null), 2500);
              }}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-heading font-extrabold uppercase tracking-wider border transition-all cursor-pointer ${
                highContrast
                  ? 'bg-white text-black border-white'
                  : 'bg-black/40 text-[#E9C349] border-[#E9C349]/40 hover:bg-[#E9C349]/10'
              }`}
            >
              {highContrast ? 'Contraste Élevé : ACTIVÉ (AAA)' : 'Activer Contraste Élevé'}
            </button>
          </div>

          {/* Réinitialiser Drag & Drop */}
          <div className="p-4 rounded-2xl bg-[#141414] border border-white/10 space-y-3 flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-heading font-bold text-white uppercase tracking-wider">
                Ordre des cartes (Drag &amp; Drop)
              </h3>
              <p className="text-[11px] text-gray-300 mt-0.5">
                Rétablit l&apos;agencement par défaut des modules de l&apos;Admin Dashboard.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                resetCardOrder();
                setSaveToast('Disposition par défaut restaurée !');
                setTimeout(() => setSaveToast(null), 2500);
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#DCB8FF]" />
              <span>Réinitialiser la disposition</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
