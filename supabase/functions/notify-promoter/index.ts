// ============================================================================
// Edge Function : notify-promoter
// Notifications automatiques aux Promoteurs et Artistes sur leurs événements
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  notifyUser,
  verifyWebhookSecret,
  escapeHtml,
} from '../_shared/notify.ts';

const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

export async function handlePromoterWebhook(
  req: Request,
  injectedSupabase?: any,
  injectedOptions?: any
) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // 1. Authentification en temps constant par SHA-256
  const providedSecret = req.headers.get('x-webhook-secret');
  const isValidSecret = await verifyWebhookSecret(providedSecret, WEBHOOK_SECRET);
  if (!isValidSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Invalid x-webhook-secret' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch (_e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { table, record, old_record } = payload || {};
  if (!table || !record) {
    return new Response(JSON.stringify({ error: 'Missing table or record' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase =
    injectedSupabase ||
    createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });

  const results: any[] = [];

  // ==========================================================================
  // ROUTE 1 : Table 'events' (Validation / Rejet de l'événement)
  // ==========================================================================
  if (table === 'events') {
    const newStatus = record.status;
    const oldStatus = old_record?.status;

    if (newStatus !== oldStatus && ['approved', 'rejected'].includes(newStatus)) {
      const promoterId = record.promoter_id;
      if (promoterId) {
        const isApproved = newStatus === 'approved';
        const rejectionReason = record.rejection_reason || record.moderation_comment || '';

        const title = isApproved ? '🎉 Événement Approuvé' : '⚠️ Événement Non Validé';
        const body = isApproved
          ? `Votre événement "${record.title}" a été validé et est désormais en ligne sur Thièsdn !`
          : `Votre événement "${record.title}" n'a pas été validé.${rejectionReason ? ` Motif : ${rejectionReason}` : ''}`;
        const url = isApproved ? '/?tab=finances' : '/?tab=create';
        const dedupeKey = `event-${newStatus}-${record.id}`;

        const res = await notifyUser(
          supabase,
          {
            userId: promoterId,
            kind: 'event_status',
            title,
            body,
            url,
            dedupeKey,
            eventId: record.id,
            emailSubject: `${title} — ${record.title}`,
          },
          injectedOptions
        );
        results.push(res);
      }
    }
  }

  // ==========================================================================
  // ROUTE 2 : Table 'orders' (Vente confirmée & Alertes de stock)
  // AUCUN nom ni téléphone de client dans les notifications (Règle Métier Stricte)
  // ==========================================================================
  if (table === 'orders') {
    const newStatus = record.status;
    const oldStatus = old_record?.status;

    if (newStatus === 'confirmed' && oldStatus !== 'confirmed') {
      const eventId = record.event_id;

      // 1. Récupérer l'événement et son promoteur
      const { data: event } = await supabase
        .from('events')
        .select('id, title, promoter_id, tiers, ticket_tiers')
        .eq('id', eventId)
        .maybeSingle();

      if (event && event.promoter_id) {
        // 2. Calculer le total cumulé de billets vendus sur cet événement
        const { data: confirmedOrders } = await supabase
          .from('orders')
          .select('quantity')
          .eq('event_id', eventId)
          .eq('status', 'confirmed');

        const totalSold = (confirmedOrders || []).reduce((acc: number, curr: any) => acc + (curr.quantity || 0), 0);

        const categoryName = record.tier_name || 'Billet Standard';
        const quantity = record.quantity || 1;
        const eventTitle = event.title || 'Événement';

        // Corps strict sans donnée personnelle client
        const title = '🎟️ Nouvelle Vente de Billet';
        const body = `🎫 ${quantity}× ${categoryName} — ${eventTitle} — ${totalSold} billet${totalSold > 1 ? 's' : ''} vendu${totalSold > 1 ? 's' : ''}`;
        const dedupeKey = `order-confirmed-${record.id}`;

        const resSale = await notifyUser(
          supabase,
          {
            userId: event.promoter_id,
            kind: 'sales',
            title,
            body,
            url: '/?tab=finances',
            dedupeKey,
            eventId,
            emailSubject: `🎫 Vente confirmée : ${eventTitle} (${totalSold} vendus)`,
          },
          injectedOptions
        );
        results.push(resSale);

        // 3. Vérification du stock restant pour cette catégorie
        const tiersList = (event.tiers || event.ticket_tiers || []) as any[];
        const currentTier = tiersList.find((t) => t.id === record.tier_id || t.name === record.tier_name);

        if (currentTier && typeof currentTier.available === 'number') {
          const remaining = currentTier.available;

          // Seuil < 10 (mais > 0) : alerte stock faible
          if (remaining > 0 && remaining <= 10) {
            const stockRes = await notifyUser(
              supabase,
              {
                userId: event.promoter_id,
                kind: 'stock',
                title: `⚠️ Stock Faible : ${currentTier.name}`,
                body: `Il ne reste que ${remaining} place(s) disponible(s) pour "${currentTier.name}" sur l'événement "${eventTitle}".`,
                url: '/?tab=finances',
                dedupeKey: `stock-${event.id}-${currentTier.id || currentTier.name}-10`,
                eventId,
              },
              injectedOptions
            );
            results.push(stockRes);
          }

          // Seuil <= 0 : rupture de stock
          if (remaining <= 0) {
            const soldoutRes = await notifyUser(
              supabase,
              {
                userId: event.promoter_id,
                kind: 'stock',
                title: `🚫 Rupture de Stock : ${currentTier.name}`,
                body: `Toutes les places "${currentTier.name}" pour "${eventTitle}" ont été vendues !`,
                url: '/?tab=finances',
                dedupeKey: `stock-${event.id}-${currentTier.id || currentTier.name}-0`,
                eventId,
              },
              injectedOptions
            );
            results.push(soldoutRes);
          }
        }
      }
    }
  }

  // ==========================================================================
  // ROUTE 3 : Table 'sales_agents' (Reversements collaborateurs & caisse)
  // ==========================================================================
  if (table === 'sales_agents') {
    const oldAmount = Number(old_record?.amount_paid_to_promoter || 0);
    const newAmount = Number(record.amount_paid_to_promoter || 0);

    if (newAmount > oldAmount) {
      const promoterId = record.promoter_id;
      if (promoterId) {
        const addedAmount = newAmount - oldAmount;
        const pointDeVente = record.point_de_vente || 'Point de vente';
        const title = '💵 Versement Collaborateur Réceptionné';
        const body = `Le point de vente "${pointDeVente}" a versé ${addedAmount.toLocaleString('fr-FR')} FCFA (Cumul : ${newAmount.toLocaleString('fr-FR')} FCFA).`;
        const dedupeKey = `settlement-${record.id}-${newAmount}`;

        const res = await notifyUser(
          supabase,
          {
            userId: promoterId,
            kind: 'payout',
            title,
            body,
            url: '/?tab=points_de_vente',
            dedupeKey,
            eventId: record.event_id,
            emailSubject: `💵 Versement collaborateur : ${pointDeVente}`,
          },
          injectedOptions
        );
        results.push(res);
      }
    }
  }

  // ==========================================================================
  // ROUTE 4 : Table 'event_coproducers' (Validation du décompte officiel)
  // ==========================================================================
  if (table === 'event_coproducers') {
    const newValidated = Boolean(record.decompte_validated);
    const oldValidated = Boolean(old_record?.decompte_validated);

    if (newValidated && !oldValidated) {
      // Trouver l'événement pour récupérer le titre et le promoteur
      const { data: event } = await supabase
        .from('events')
        .select('id, title, promoter_id')
        .eq('id', record.event_id)
        .maybeSingle();

      const promoterId = event?.promoter_id;
      if (promoterId) {
        const eventTitle = event.title || 'Événement';
        const title = '📊 Décompte Co-Production Validé';
        const body = `Le décompte officiel des recettes pour "${eventTitle}" a été signé et validé.`;
        const dedupeKey = `decompte-${record.id}-${record.event_id}`;

        const res = await notifyUser(
          supabase,
          {
            userId: promoterId,
            kind: 'decompte',
            title,
            body,
            url: '/?tab=artist',
            dedupeKey,
            eventId: record.event_id,
            emailSubject: `📊 Décompte officiel validé : ${eventTitle}`,
          },
          injectedOptions
        );
        results.push(res);
      }
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      processedCount: results.length,
      results,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

if (import.meta.main) {
  serve((req) => handlePromoterWebhook(req));
}
