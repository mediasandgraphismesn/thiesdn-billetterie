import React, { useState } from 'react';
import {
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Smartphone,
  Calendar,
  Ticket,
  User,
  ExternalLink,
  Loader2,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react';
import { OrderRecord, EventItem, UserTicket } from '../../types';

interface OrdersTableProps {
  orders: OrderRecord[];
  events: EventItem[];
  isLoading: boolean;
  onRefresh: () => void;
  onConfirmOrder: (order: OrderRecord) => Promise<void>;
  onRejectOrder: (orderId: string, reason?: string) => Promise<void>;
  processingOrderId: string | null;
}

export const OrdersTable: React.FC<OrdersTableProps> = ({
  orders,
  events,
  isLoading,
  onRefresh,
  onConfirmOrder,
  onRejectOrder,
  processingOrderId,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'payment_signaled' | 'confirmed' | 'rejected'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      o.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customerPhone.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.eventTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.paymentReference && o.paymentReference.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'pending'
        ? o.status === 'pending' || o.status === 'payment_signaled'
        : o.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: OrderRecord['status']) => {
    switch (status) {
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Payé & Émis
          </span>
        );
      case 'payment_signaled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 animate-pulse">
            <Clock className="w-3 h-3 text-amber-400" />
            Signalé par Client
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
            <Clock className="w-3 h-3 text-blue-400" />
            En attente de paiement
          </span>
        );
      case 'rejected':
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
            <XCircle className="w-3 h-3 text-rose-400" />
            Refusé
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-500/15 text-gray-400 border border-gray-500/30">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Barre d'outils : Recherche, Filtres, Rafraîchir */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par référence, nom, téléphone, soirée..."
            className="w-full bg-[#141414] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#8A2BE2]"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Filtres par statut */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                statusFilter === 'all'
                  ? 'bg-[#8A2BE2] text-white shadow-md'
                  : 'bg-[#1A1A1A] text-gray-400 hover:text-white border border-white/5'
              }`}
            >
              Toutes ({orders.length})
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                statusFilter === 'pending'
                  ? 'bg-amber-500 text-black shadow-md font-extrabold'
                  : 'bg-[#1A1A1A] text-gray-400 hover:text-white border border-white/5'
              }`}
            >
              À Vérifier ({orders.filter((o) => o.status === 'pending' || o.status === 'payment_signaled').length})
            </button>
            <button
              onClick={() => setStatusFilter('confirmed')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                statusFilter === 'confirmed'
                  ? 'bg-emerald-500 text-white shadow-md'
                  : 'bg-[#1A1A1A] text-gray-400 hover:text-white border border-white/5'
              }`}
            >
              Confirmées ({orders.filter((o) => o.status === 'confirmed').length})
            </button>
          </div>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-[#1A1A1A] hover:bg-[#252525] text-gray-300 hover:text-white border border-white/10 transition-all flex items-center justify-center"
            title="Rafraîchir depuis Supabase"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#E9C349]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tableau Responsive des Commandes Supabase */}
      <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#141414] text-gray-400 uppercase font-heading font-extrabold text-[10px] tracking-wider border-b border-white/10">
              <tr>
                <th className="py-3.5 px-4">Référence</th>
                <th className="py-3.5 px-4">Client & Contact</th>
                <th className="py-3.5 px-4">Événement & Formule</th>
                <th className="py-3.5 px-4">Montant Total</th>
                <th className="py-3.5 px-4">Paiement</th>
                <th className="py-3.5 px-4">Statut</th>
                <th className="py-3.5 px-4 text-right">Actions Validation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-gray-300">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500">
                    <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-semibold text-sm text-gray-400">Aucune commande trouvée</p>
                    <p className="text-xs text-gray-500 mt-1">Les commandes passées via Wave apparaîtront ici en direct.</p>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const isProcessing = processingOrderId === order.id;
                  const isPending = order.status === 'pending' || order.status === 'payment_signaled';

                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Référence */}
                      <td className="py-3.5 px-4 font-mono font-bold text-white">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[#E9C349]">{order.reference}</span>
                          <button
                            onClick={() => handleCopy(order.reference, order.id)}
                            className="text-gray-500 hover:text-white"
                            title="Copier référence"
                          >
                            {copiedId === order.id ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                        <span className="text-[10px] text-gray-500 block font-sans">
                          {new Date(order.createdAt).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </td>

                      {/* Client */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-[#DCB8FF]" />
                          <span>{order.customerName}</span>
                        </div>
                        <div className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                          <Smartphone className="w-3 h-3 text-[#E9C349]" />
                          <span>{order.customerPhone}</span>
                        </div>
                      </td>

                      {/* Événement & Formule */}
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-white truncate max-w-[200px]">
                          {order.eventTitle}
                        </p>
                        <span className="inline-block mt-0.5 text-[10px] font-bold text-[#DCB8FF] bg-[#8A2BE2]/15 px-2 py-0.5 rounded border border-[#8A2BE2]/30">
                          {order.tierName} • Qté: {order.quantity}
                        </span>
                      </td>

                      {/* Montant Total */}
                      <td className="py-3.5 px-4 font-heading font-extrabold text-sm text-[#E9C349] tabular-nums">
                        {order.totalAmount.toLocaleString('fr-FR')} <span className="text-[10px] font-sans text-gray-400">FCFA</span>
                      </td>

                      {/* Méthode Paiement */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#141414] border border-white/10 uppercase">
                          {order.paymentMethod === 'wave' ? 'Wave' : 'Orange Money'}
                        </span>
                        {order.paymentReference && (
                          <span className="block text-[10px] font-mono text-gray-400 mt-0.5 truncate max-w-[120px]">
                            Réf: {order.paymentReference}
                          </span>
                        )}
                      </td>

                      {/* Statut */}
                      <td className="py-3.5 px-4">
                        {getStatusBadge(order.status)}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        {isPending ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              disabled={isProcessing}
                              onClick={() => onRejectOrder(order.id, 'Paiement Wave non reçu')}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-bold transition-all disabled:opacity-50"
                              title="Refuser"
                            >
                              Refuser
                            </button>
                            <button
                              disabled={isProcessing}
                              onClick={() => onConfirmOrder(order)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-heading font-extrabold text-[11px] uppercase tracking-wider transition-all flex items-center gap-1 shadow-md shadow-emerald-500/20 disabled:opacity-50"
                            >
                              {isProcessing ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              )}
                              <span>Valider</span>
                            </button>
                          </div>
                        ) : order.status === 'confirmed' ? (
                          <span className="text-[11px] text-emerald-400 font-semibold flex items-center justify-end gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Billets émis
                          </span>
                        ) : (
                          <span className="text-[11px] text-gray-500 italic">
                            Clôturée
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
