// Supabase Edge Function: log-vigile-session
// Enregistrement et traçabilité des sessions de postes de scan vigiles

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const stationCode = body.station_code || body.stationCode;
    const stationName = body.station_name || body.stationName || 'Poste de Contrôle';
    const eventId = body.event_id || body.eventId || null;
    const eventTitle = body.event_title || body.eventTitle || 'Événement Thiès';
    const userId = body.user_id || null;

    if (!stationCode) {
      return new Response(JSON.stringify({ error: 'Code de poste requis' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rawIp =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('cf-connecting-ip') ||
      req.headers.get('x-real-ip') ||
      body.ip_address ||
      '';
    const userAgent = req.headers.get('user-agent') || body.user_agent || 'Mobile Scanner';

    let country = 'Sénégal';
    let city = 'Thiès';

    if (rawIp && !rawIp.startsWith('127.') && rawIp !== 'localhost' && !rawIp.startsWith('192.168.')) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);

        const geoRes = await fetch(`https://ipapi.co/${rawIp}/json/`, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Thiesdn-Vigile-Tracker/1.0' },
        });
        clearTimeout(timeoutId);

        if (geoRes.ok) {
          const geoData = await geoRes.json();
          if (geoData.country_name) country = geoData.country_name;
          if (geoData.city) city = geoData.city;
        }
      } catch (e) {
        console.warn('Fallback géolocalisation vigile session:', e);
      }
    }

    // Vérifier si une session active existe déjà
    const { data: existingSessions } = await supabase
      .from('vigile_sessions')
      .select('*')
      .eq('station_code', stationCode.toUpperCase().trim())
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1);

    const activeSession = existingSessions && existingSessions.length > 0 ? existingSessions[0] : null;

    if (activeSession) {
      // Si même IP ou même User-Agent, prolonger la session
      if (activeSession.ip_address === rawIp || activeSession.user_agent === userAgent) {
        await supabase
          .from('vigile_sessions')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', activeSession.id);

        return new Response(
          JSON.stringify({
            success: true,
            status: 'session_renewed',
            session: activeSession,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      // Si IP ET User-Agent différents -> ALERTE doublon / partage non autorisé
      return new Response(
        JSON.stringify({
          success: false,
          status: 'session_conflict',
          message: 'Ce poste de contrôle est déjà actif sur un autre appareil.',
          existingDevice: activeSession.user_agent,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // Création d'une nouvelle session active
    const { data: newSession, error: insertError } = await supabase
      .from('vigile_sessions')
      .insert([
        {
          station_code: stationCode.toUpperCase().trim(),
          station_name: stationName,
          event_id: eventId,
          event_title: eventTitle,
          user_id: userId,
          ip_address: rawIp || '127.0.0.1',
          user_agent: userAgent,
          country: country,
          city: city,
          is_active: true,
          last_seen_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (insertError) {
      console.error('Erreur création vigile session:', insertError);
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: 'session_created',
        session: newSession,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (err: any) {
    console.error('Exception log-vigile-session:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
