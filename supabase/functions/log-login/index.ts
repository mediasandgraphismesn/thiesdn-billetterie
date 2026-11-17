// Supabase Edge Function: log-login
// Journalisation sécurisée des connexions avec géolocalisation IP & détection User-Agent

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
    const email = body.email || body.record?.email || 'visiteur@thiesdn.com';
    const userId = body.user_id || body.record?.id || null;
    const action = body.action || 'login';
    const deviceFingerprint = typeof body.device_fingerprint === 'string' ? body.device_fingerprint : null;

    // Extraction IP et User-Agent
    const rawIp =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('cf-connecting-ip') ||
      req.headers.get('x-real-ip') ||
      body.ip_address ||
      '';
    const userAgent = req.headers.get('user-agent') || body.user_agent || 'Inconnu';

    let country = 'Sénégal';
    let city = 'Thiès';

    // Appel à l'API de géolocalisation avec timeout et fallback
    if (rawIp && !rawIp.startsWith('127.') && rawIp !== 'localhost' && !rawIp.startsWith('192.168.')) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500); // 2.5s max

        const geoRes = await fetch(`https://ipapi.co/${rawIp}/json/`, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Thiesdn-Security-Agent/1.0' },
        });
        clearTimeout(timeoutId);

        if (geoRes.ok) {
          const geoData = await geoRes.json();
          if (geoData.country_name) country = geoData.country_name;
          if (geoData.city) city = geoData.city;
        }
      } catch (geoErr) {
        console.warn('Géolocalisation IP fallback activé:', geoErr);
      }
    }

    const normalizedCountry = country.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const isSuspicious = !normalizedCountry.includes('senegal') || !userAgent || userAgent === 'Inconnu';

    // Insertion parallèle dans public.login_history et public.connection_logs
    const [{ error }, { error: connLogErr }] = await Promise.all([
      supabase.from('login_history').insert([
        {
          user_id: userId,
          email: email,
          ip_address: rawIp || '127.0.0.1',
          user_agent: userAgent,
          country: country,
          city: city,
          action: action,
        },
      ]),
      supabase.from('connection_logs').insert([
        {
          user_id: userId,
          email: email,
          ip_address: rawIp || '127.0.0.1',
          user_agent: userAgent,
          city: city,
          country: country,
          device_fingerprint: deviceFingerprint,
          action: action,
          is_suspicious: isSuspicious,
        },
      ]),
    ]);

    if (connLogErr) {
      console.warn('Insertion connection_logs ignorée (migration en attente ?):', connLogErr.message);
    }

    if (error) {
      console.error('Erreur insertion login_history:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, logged: { email, country, city } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err: any) {
    console.error('Exception log-login Edge Function:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200, // Ne pas renvoyer 500 pour ne jamais bloquer le flux de connexion client
    });
  }
});
