import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // 1. Authentification JWT & Vérification stricte du rôle Admin (Faille 1)
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseAuth = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let orderId: string | undefined

  try {
    const body = await req.json()
    orderId = body?.orderId

    if (!orderId) {
      return new Response(JSON.stringify({ error: 'orderId requis' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. CORRECTION 3 : Vérifier que RESEND_API_KEY est configuré au début
    if (!RESEND_API_KEY) {
      await supabase.from('email_logs').insert({
        order_id: orderId,
        recipient: null,
        status: 'failed',
        error_message: 'RESEND_API_KEY non configuré',
      })
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY non configuré' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. Récupérer la commande et l'événement
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, events(title, date, event_date, time, event_time, venue, poster_url, affiche_url)')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: 'Commande introuvable' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Résolution de l'email destinataire (order.customer_email ou fallback profil)
    let recipientEmail: string | null = order.customer_email || null
    if (!recipientEmail && order.user_id) {
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', order.user_id)
        .maybeSingle()
      recipientEmail = userProfile?.email || null
    }

    // 4. Null check sur order.events (Faille 5)
    if (!order.events) {
      await supabase.from('email_logs').insert({
        order_id: orderId,
        recipient: recipientEmail,
        status: 'failed',
        error_message: 'Événement supprimé',
      })
      return new Response(JSON.stringify({ error: 'Événement supprimé' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 5. Idempotence anti-doublon (Faille 3)
    if (order.email_sent_at) {
      return new Response(JSON.stringify({ skipped: 'Email déjà envoyé', emailSentAt: order.email_sent_at }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!recipientEmail) {
      await supabase.from('email_logs').insert({
        order_id: orderId,
        recipient: null,
        status: 'failed',
        error_message: 'Aucune adresse email destinataire associée à cette commande',
      })
      return new Response(JSON.stringify({ error: 'Aucune adresse email destinataire associée à cette commande' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 6. CORRECTION 2 : Si order.guest_token est null, le générer à la volée avant de construire le lien
    let guestToken: string = order.guest_token
    if (!guestToken) {
      guestToken = crypto.randomUUID().replace(/-/g, '')
      await supabase
        .from('orders')
        .update({ guest_token: guestToken })
        .eq('id', orderId)
    }

    // 7. Construire le lien du billet avec token unique pour inscrits et Guests (Faille 2)
    const ticketLink = `https://billetterie.thiesdn.site/?order=${encodeURIComponent(order.reference)}&token=${encodeURIComponent(guestToken)}`

    // 8. Envoyer l'email via Resend avec template HTML responsive mobile (Faille 6)
    const eventDateLabel = order.events.date || order.events.event_date || 'À venir'
    const eventPosterUrl = order.events.poster_url || order.events.affiche_url || ''
    const posterHtml = eventPosterUrl
      ? `<div style="margin-bottom: 20px; border-radius: 12px; overflow: hidden;">
           <img src="${eventPosterUrl}" alt="${order.events.title}" style="width: 100%; max-height: 240px; object-fit: cover; display: block; border-radius: 12px;" />
         </div>`
      : ''

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Thièsdn Billetterie <noreply@notifications.thiesdn.site>',
        to: recipientEmail,
        subject: `✅ Commande ${order.reference} confirmée !`,
        html: `
          <!DOCTYPE html>
          <html lang="fr">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          </head>
          <body style="margin: 0; padding: 12px; background-color: #050505; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
            <div style="max-width: 600px; margin: 0 auto; background: #0A0A0A; color: #F5F5F5; padding: 20px; border-radius: 16px; border: 1px solid #262626;">
              ${posterHtml}
              <h1 style="color: #E9C349; font-size: 22px; margin: 0 0 12px 0; line-height: 1.3;">
                Merci ${order.customer_name} !
              </h1>
              <p style="font-size: 15px; line-height: 1.5; color: #E5E5E5; margin: 0 0 16px 0;">
                Votre paiement pour <strong>${order.events.title}</strong> a été validé.
              </p>
              <div style="background: #141414; border: 1px solid #262626; border-radius: 12px; padding: 16px; margin-bottom: 24px; font-size: 14px; line-height: 1.7;">
                <p style="margin: 0;"><strong>Date :</strong> ${eventDateLabel}</p>
                <p style="margin: 0;"><strong>Lieu :</strong> ${order.events.venue}</p>
                <p style="margin: 0;"><strong>Catégorie :</strong> ${order.tier_name || 'Standard'} (${order.quantity || 1} place(s))</p>
                <p style="margin: 0;"><strong>Montant :</strong> ${Number(order.total_amount).toLocaleString('fr-FR')} FCFA</p>
                <p style="margin: 0;"><strong>Référence :</strong> <span style="color: #E9C349; font-family: monospace; font-weight: bold;">${order.reference}</span></p>
              </div>
              <div style="text-align: center; margin: 28px 0;">
                <a href="${ticketLink}" style="display: inline-block; min-height: 48px; min-width: 44px; box-sizing: border-box; background: #8A2BE2; color: #FFFFFF; padding: 16px 32px; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 16px; line-height: 1;">
                  🎟️ Voir mon billet
                </a>
              </div>
              <p style="font-size: 12px; color: #888888; text-align: center; margin: 20px 0 0 0;">
                Thiès Days and Nights — Billetterie Officielle
              </p>
            </div>
          </body>
          </html>
        `,
      }),
    })

    const emailData = await emailResponse.json()

    if (!emailResponse.ok) {
      const errMsg = emailData?.message || emailData?.error?.message || `Resend HTTP ${emailResponse.status}`
      await supabase.from('email_logs').insert({
        order_id: orderId,
        recipient: recipientEmail,
        status: 'failed',
        error_message: errMsg,
      })
      return new Response(JSON.stringify({ error: errMsg }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 9. Marquer l'email comme envoyé (idempotence) + enregistrer le succès dans email_logs
    const sentAt = new Date().toISOString()
    await supabase
      .from('orders')
      .update({ email_sent_at: sentAt })
      .eq('id', orderId)

    await supabase.from('email_logs').insert({
      order_id: orderId,
      recipient: recipientEmail,
      status: 'sent',
      error_message: null,
    })

    return new Response(JSON.stringify({ success: true, emailId: emailData.id, ticketLink }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    const errMsg = error?.message || 'Erreur interne Edge Function'
    if (orderId) {
      await supabase.from('email_logs').insert({
        order_id: orderId,
        recipient: null,
        status: 'failed',
        error_message: errMsg,
      })
    }
    return new Response(JSON.stringify({ error: errMsg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
