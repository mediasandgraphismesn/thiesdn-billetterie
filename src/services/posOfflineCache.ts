import { SalesAgent, UserTicket } from '../types';
import { getSupabaseClient } from './supabase';

const POS_STOCK_CACHE_KEY = 'thiesdn_pos_stock_cache_v1';
const POS_OFFLINE_QUEUE_KEY = 'thiesdn_pos_offline_sales_queue_v1';

export interface PosOfflineStockEntry {
  agent: SalesAgent;
  tickets: UserTicket[];
  validQrCodes: string[];
  updatedAt: string;
}

export interface PendingPosOfflineSale {
  id: string;
  agentId: string;
  agentName: string;
  ticketId: string;
  qrCode: string;
  tierName: string;
  price: number;
  holderName: string;
  holderPhone: string;
  isManualEntry?: boolean;
  soldAt: string;
  attempts: number;
  lastError?: string;
}

export interface PosOfflineSyncResult {
  syncedCount: number;
  failedCount: number;
  remainingCount: number;
  lastError?: string;
}

type PosStockMap = Record<string, PosOfflineStockEntry>;

let activeSyncPromise: Promise<PosOfflineSyncResult> | null = null;

const safeReadJson = <T>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const safeWriteJson = (key: string, value: unknown): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`[posOfflineCache] Écriture impossible (${key}):`, err);
  }
};

export const isTicketUnsoldForPos = (status: UserTicket['status']): boolean =>
  status === 'printed_not_sold' || status === 'physical_allocated' || status === 'physical_printed';

export const getPendingOfflinePosSales = (agentId?: string): PendingPosOfflineSale[] => {
  const queue = safeReadJson<PendingPosOfflineSale[]>(POS_OFFLINE_QUEUE_KEY, []);
  if (!Array.isArray(queue)) return [];
  if (!agentId) return queue;
  return queue.filter((item) => item.agentId === agentId);
};

export const getPendingOfflineQrCodes = (agentId?: string): Set<string> => {
  const queue = getPendingOfflinePosSales(agentId);
  return new Set(queue.map((item) => item.qrCode.trim().toUpperCase()));
};

const applyQueueOverlayToTickets = (
  tickets: UserTicket[],
  queue: PendingPosOfflineSale[]
): UserTicket[] => {
  if (queue.length === 0) return tickets;
  const byQr = new Map<string, PendingPosOfflineSale>();
  for (const item of queue) {
    byQr.set(item.qrCode.trim().toUpperCase(), item);
  }

  return tickets.map((t) => {
    const queued = byQr.get(t.qrCode.trim().toUpperCase());
    if (!queued) return t;
    return {
      ...t,
      status: 'sold_valid',
      holderName: queued.holderName,
      holderPhone: queued.holderPhone,
      isManualEntry: Boolean(queued.isManualEntry),
      soldAt: queued.soldAt,
    };
  });
};

/**
 * Stocke localement le catalogue de billets du vendeur (dont ses QR codes valides)
 * dans localStorage pour garantir le fonctionnement même en cas de coupure réseau totale.
 */
export const savePosAgentSnapshot = (agent: SalesAgent, tickets: UserTicket[]): void => {
  if (!agent?.id) return;
  const map = safeReadJson<PosStockMap>(POS_STOCK_CACHE_KEY, {});
  const agentQueue = getPendingOfflinePosSales(agent.id);
  const overlaidTickets = applyQueueOverlayToTickets(tickets, agentQueue);

  const validQrCodes = overlaidTickets
    .filter((t) => isTicketUnsoldForPos(t.status))
    .map((t) => t.qrCode.trim().toUpperCase());

  map[agent.id] = {
    agent,
    tickets: overlaidTickets,
    validQrCodes,
    updatedAt: new Date().toISOString(),
  };

  safeWriteJson(POS_STOCK_CACHE_KEY, map);
};

/**
 * Restaure les points de vente et billets du cache local avec superposition des ventes hors-ligne en attente.
 */
export const loadPosAgentSnapshot = (preferredAgentId?: string): {
  agents: SalesAgent[];
  activeAgent: SalesAgent | null;
  tickets: UserTicket[];
  updatedAt: string | null;
} => {
  const map = safeReadJson<PosStockMap>(POS_STOCK_CACHE_KEY, {});
  const entries = Object.values(map || {});
  if (entries.length === 0) {
    return { agents: [], activeAgent: null, tickets: [], updatedAt: null };
  }

  const agents = entries.map((e) => e.agent);
  const targetEntry =
    (preferredAgentId ? map[preferredAgentId] : undefined) ||
    entries[0];

  if (!targetEntry) {
    return { agents, activeAgent: null, tickets: [], updatedAt: null };
  }

  const agentQueue = getPendingOfflinePosSales(targetEntry.agent.id);
  const tickets = applyQueueOverlayToTickets(targetEntry.tickets || [], agentQueue);

  return {
    agents,
    activeAgent: targetEntry.agent,
    tickets,
    updatedAt: targetEntry.updatedAt,
  };
};

/**
 * Valide localement un billet scanné hors-ligne et l'enregistre dans la file de synchronisation Supabase.
 */
export const recordOfflinePosSale = (params: {
  agent: SalesAgent;
  ticket: UserTicket;
  holderName: string;
  holderPhone: string;
  isManualEntry?: boolean;
}): {
  success: boolean;
  message: string;
  updatedTicket?: UserTicket;
  updatedAgent?: SalesAgent;
  queuedCount: number;
} => {
  const { agent, ticket, holderName, holderPhone, isManualEntry = false } = params;
  const cleanName = holderName.trim();
  const cleanPhone = holderPhone.trim();
  const cleanQr = ticket.qrCode.trim().toUpperCase();

  if (!cleanName || !cleanPhone) {
    return {
      success: false,
      message: 'Le nom et le téléphone du client sont obligatoires.',
      queuedCount: getPendingOfflinePosSales(agent.id).length,
    };
  }

  const existingQueue = safeReadJson<PendingPosOfflineSale[]>(POS_OFFLINE_QUEUE_KEY, []);
  const alreadyQueued = existingQueue.find(
    (item) => item.qrCode.trim().toUpperCase() === cleanQr
  );
  if (alreadyQueued) {
    return {
      success: false,
      message: `Le billet "${ticket.qrCode}" a déjà été encaissé hors-ligne (en attente de synchronisation).`,
      queuedCount: existingQueue.filter((item) => item.agentId === agent.id).length,
    };
  }

  const nowIso = new Date().toISOString();
  const price = Number(ticket.price) || 3500;
  const netDueAdd = Math.round(price * (1 - (agent.commissionPercent || 0) / 100));

  const newQueueItem: PendingPosOfflineSale = {
    id: `pos-off-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    agentId: agent.id,
    agentName: agent.pointDeVente,
    ticketId: ticket.id,
    qrCode: ticket.qrCode,
    tierName: ticket.tierName,
    price,
    holderName: cleanName,
    holderPhone: cleanPhone,
    isManualEntry: Boolean(isManualEntry),
    soldAt: nowIso,
    attempts: 0,
  };

  const nextQueue = [...existingQueue, newQueueItem];
  safeWriteJson(POS_OFFLINE_QUEUE_KEY, nextQueue);

  const updatedTicket: UserTicket = {
    ...ticket,
    status: 'sold_valid',
    holderName: cleanName,
    holderPhone: cleanPhone,
    isManualEntry: Boolean(isManualEntry),
    soldAt: nowIso,
    agentId: agent.id,
    agentName: agent.pointDeVente,
  };

  const updatedAgent: SalesAgent = {
    ...agent,
    soldCount: (agent.soldCount || 0) + 1,
    cashCollected: (agent.cashCollected || 0) + price,
    amountDue: (agent.amountDue || 0) + netDueAdd,
  };

  // Mettre à jour le snapshot local du point de vente immédiatement
  const map = safeReadJson<PosStockMap>(POS_STOCK_CACHE_KEY, {});
  const currentEntry = map[agent.id];
  const baseTickets = currentEntry?.tickets || [];
  const nextTickets = baseTickets.some(
    (t) => t.id === ticket.id || t.qrCode.trim().toUpperCase() === cleanQr
  )
    ? baseTickets.map((t) =>
        t.id === ticket.id || t.qrCode.trim().toUpperCase() === cleanQr ? updatedTicket : t
      )
    : [updatedTicket, ...baseTickets];

  map[agent.id] = {
    agent: updatedAgent,
    tickets: nextTickets,
    validQrCodes: nextTickets
      .filter((t) => isTicketUnsoldForPos(t.status))
      .map((t) => t.qrCode.trim().toUpperCase()),
    updatedAt: nowIso,
  };
  safeWriteJson(POS_STOCK_CACHE_KEY, map);

  return {
    success: true,
    message: `Vente enregistrée pour ${cleanName} (${price.toLocaleString('fr-FR')} FCFA).`,
    updatedTicket,
    updatedAgent,
    queuedCount: nextQueue.filter((item) => item.agentId === agent.id).length,
  };
};

const isPermanentAlreadyProcessedMessage = (msg: string): boolean => {
  const lower = msg.toLowerCase();
  return (
    lower.includes('déjà été déclaré vendu') ||
    lower.includes('déjà vendu') ||
    lower.includes('déjà été scanné')
  );
};

/**
 * Synchronise toutes les ventes POS enregistrées hors-ligne dès le retour de la connexion.
 */
export const syncPendingOfflinePosSales = async (
  agentIdFilter?: string
): Promise<PosOfflineSyncResult> => {
  if (activeSyncPromise) {
    return activeSyncPromise;
  }

  activeSyncPromise = (async (): Promise<PosOfflineSyncResult> => {
    const client = getSupabaseClient();
    const fullQueue = safeReadJson<PendingPosOfflineSale[]>(POS_OFFLINE_QUEUE_KEY, []);

    if (!client || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
      const relevant = agentIdFilter
        ? fullQueue.filter((q) => q.agentId === agentIdFilter)
        : fullQueue;
      return {
        syncedCount: 0,
        failedCount: 0,
        remainingCount: relevant.length,
      };
    }

    if (fullQueue.length === 0) {
      return { syncedCount: 0, failedCount: 0, remainingCount: 0 };
    }

    let syncedCount = 0;
    let failedCount = 0;
    let lastError: string | undefined;
    const remaining: PendingPosOfflineSale[] = [];

    for (const item of fullQueue) {
      if (agentIdFilter && item.agentId !== agentIdFilter) {
        remaining.push(item);
        continue;
      }

      try {
        // 1. Validation prioritaire via RPC atomique SECURITY DEFINER
        const isManualEntry = Boolean(item.isManualEntry);
        let { data: rpcData, error: rpcErr } = await client.rpc('activate_physical_ticket_sale', {
          p_agent_id: item.agentId,
          p_ticket_code: item.qrCode,
          p_holder_name: item.holderName,
          p_holder_phone: item.holderPhone,
          p_holder_email: null,
          p_is_manual_entry: isManualEntry,
        });

        // Compatibilité transitoire si la RPC côté DB n'a pas encore p_is_manual_entry
        if (rpcErr && /p_is_manual_entry|function.*activate_physical_ticket_sale|PGRST202/i.test(rpcErr.message || '')) {
          ({ data: rpcData, error: rpcErr } = await client.rpc('activate_physical_ticket_sale', {
            p_agent_id: item.agentId,
            p_ticket_code: item.qrCode,
            p_holder_name: item.holderName,
            p_holder_phone: item.holderPhone,
            p_holder_email: null,
          }));
          const fallbackRpcRes = rpcData as { success?: boolean } | null;
          if (!rpcErr && fallbackRpcRes?.success && isManualEntry) {
            await client
              .from('tickets')
              .update({ is_manual_entry: true })
              .eq('qr_code', item.qrCode);
          }
        }

        const rpcResult = rpcData as { success?: boolean; message?: string } | null;

        if (!rpcErr && rpcResult?.success) {
          syncedCount += 1;
          continue;
        }

        if (rpcResult && rpcResult.success === false && rpcResult.message) {
          if (isPermanentAlreadyProcessedMessage(rpcResult.message)) {
            syncedCount += 1;
            continue;
          }
        }

        // 2. Repli par UPDATE SQL explicite sur la table tickets (si RPC non atteinte ou RLS direct autorisé)
        const { data: updatedRow, error: updateErr } = await client
          .from('tickets')
          .update({
            status: 'sold_valid',
            holder_name: item.holderName,
            holder_phone: item.holderPhone,
            is_manual_entry: isManualEntry,
            sold_at: item.soldAt,
            agent_id: item.agentId,
            agent_name: item.agentName,
          })
          .eq('qr_code', item.qrCode)
          .in('status', ['printed_not_sold', 'physical_printed', 'physical_allocated'])
          .select('id, status')
          .maybeSingle();

        if (!updateErr && updatedRow) {
          syncedCount += 1;
          continue;
        }

        failedCount += 1;
        lastError = rpcResult?.message || rpcErr?.message || updateErr?.message || 'Erreur synchro Supabase';
        remaining.push({
          ...item,
          attempts: item.attempts + 1,
          lastError,
        });
      } catch (err: unknown) {
        failedCount += 1;
        lastError = err instanceof Error ? err.message : 'Coupure réseau pendant la synchronisation';
        remaining.push({
          ...item,
          attempts: item.attempts + 1,
          lastError,
        });
      }
    }

    safeWriteJson(POS_OFFLINE_QUEUE_KEY, remaining);

    const remainingForFilter = agentIdFilter
      ? remaining.filter((item) => item.agentId === agentIdFilter).length
      : remaining.length;

    return {
      syncedCount,
      failedCount,
      remainingCount: remainingForFilter,
      lastError,
    };
  })();

  try {
    return await activeSyncPromise;
  } finally {
    activeSyncPromise = null;
  }
};
