import { createClient } from '@supabase/supabase-js';

// Normalisation intelligente de l'URL Supabase
function formatSupabaseUrl(url: string): string {
  let cleaned = url.trim();
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = `https://${cleaned}`;
  }
  // Enlever /rest/v1 ou trailing slashes si l'utilisateur a collé l'URL REST au lieu de l'URL du projet
  cleaned = cleaned.replace(/\/rest\/v1\/?$/, '');
  cleaned = cleaned.replace(/\/+$/, '');
  return cleaned;
}

const rawUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const rawKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabaseUrl = formatSupabaseUrl(rawUrl);
const supabaseAnonKey = rawKey.trim();

console.log('=== TEST DE CONNEXION SUPABASE ===');
console.log('URL de Base du Projet :', supabaseUrl);
console.log('Clé Publique / Anon :', supabaseAnonKey.slice(0, 18) + '...');

async function testSupabase() {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  console.log('\n2. Requête sur la table "events" avec le filtre status = "approved"...');
  const { data: events, error } = await supabase
    .from('events')
    .select('*')
    .eq('status', 'approved');

  if (error) {
    console.error('❌ Erreur lors de la requête :', error.message);
    console.error('Détails :', error);
    return;
  }

  console.log(`\nNombre d'événements existants trouvés : ${events?.length || 0}`);

  let currentEvents = events || [];

  // 4. Si la table est vide, crée 2 événements de test
  if (currentEvents.length === 0) {
    console.log('\n3. La table est vide. Création des 2 événements de test (Thiès et Mbour)...');

    const testEvents = [
      {
        title: 'Nuit du Baobab Prestige - Thiès',
        category: 'nightlife',
        description: 'Soirée exceptionnelle au Grand Théâtre de Thiès avec les plus grands artistes',
        event_date: '2024-10-25T21:30:00Z',
        location: 'Grand Théâtre de Thiès, Thiès, Sénégal',
        affiche_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800',
        promoter_name: 'Promoteur Test Thiès',
        price: 5000,
        status: 'approved',
      },
      {
        title: 'Mbour Afro-Fusion & Mbalax Live',
        category: 'concert',
        description: 'Soirée Afro-Fusion au Mbour Night Lounge avec les meilleurs DJ',
        event_date: '2024-10-28T22:00:00Z',
        location: 'Mbour Night Lounge, Bord de Mer, Mbour',
        affiche_url: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=800',
        promoter_name: 'Promoteur Test Mbour',
        price: 3000,
        status: 'approved',
      },
    ];

    const { data: inserted, error: insertError } = await supabase
      .from('events')
      .insert(testEvents)
      .select();

    if (insertError) {
      console.error('❌ Erreur lors de l\'insertion :', insertError.message);
      // Tentative avec les colonnes alternatives si la table a été créée avec le schéma complet
      console.log('Tentative avec colonnes standard...');
      const fallbackEvents = [
        {
          title: 'Nuit du Baobab Prestige - Thiès',
          category: 'nightlife',
          description: 'Soirée exceptionnelle au Grand Théâtre de Thiès avec les plus grands artistes',
          date: '25 Octobre 2024',
          time: '21:30',
          datetime_iso: '2024-10-25T21:30:00Z',
          venue: 'Grand Théâtre de Thiès, Thiès, Sénégal',
          city: 'Thiès',
          poster_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800',
          promoter_name: 'Promoteur Test Thiès',
          price: 5000,
          status: 'approved',
        },
        {
          title: 'Mbour Afro-Fusion & Mbalax Live',
          category: 'concert',
          description: 'Soirée Afro-Fusion au Mbour Night Lounge avec les meilleurs DJ',
          date: '28 Octobre 2024',
          time: '22:00',
          datetime_iso: '2024-10-28T22:00:00Z',
          venue: 'Mbour Night Lounge, Bord de Mer, Mbour',
          city: 'Mbour',
          poster_url: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=800',
          promoter_name: 'Promoteur Test Mbour',
          price: 3000,
          status: 'approved',
        },
      ];
      const { data: fallbackInserted, error: fallbackError } = await supabase
        .from('events')
        .insert(fallbackEvents)
        .select();

      if (fallbackError) {
        console.error('❌ Erreur fallback :', fallbackError.message);
      } else {
        currentEvents = fallbackInserted || [];
      }
    } else {
      currentEvents = inserted || [];
    }
  }

  // 3. Affiche le résultat dans un tableau lisible
  console.log('\n=== RÉSULTAT DU TABLEAU "events" ===');
  console.table(
    currentEvents.map((e: any) => ({
      ID: e.id || 'N/A',
      Titre: e.title,
      Catégorie: e.category,
      Date: e.event_date || e.date || e.datetime_iso,
      Lieu: e.location || e.venue,
      Promoteur: e.promoter_name,
      Prix: `${e.price} FCFA`,
      Statut: e.status,
    }))
  );

  // 5. Résumé final
  console.log(`\n✅ Connexion Supabase réussie ! ${currentEvents.length} événements trouvés`);
}

testSupabase();
