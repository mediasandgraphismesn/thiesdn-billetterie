import { createClient } from '@supabase/supabase-js';

const rawUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const rawKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

console.log('Raw URL:', rawUrl);
console.log('Raw Key prefix:', rawKey.slice(0, 20));

// Fix URL if needed (remove trailing slash or add https://)
let cleanedUrl = rawUrl.trim();
if (!cleanedUrl.startsWith('http://') && !cleanedUrl.startsWith('https://')) {
  cleanedUrl = `https://${cleanedUrl}`;
}
cleanedUrl = cleanedUrl.replace(/\/+$/, '');

console.log('Cleaned URL:', cleanedUrl);

async function run() {
  const supabase = createClient(cleanedUrl, rawKey.trim());
  
  // Test basic ping / query
  console.log('Testing query on "events"...');
  const res1 = await supabase.from('events').select('*').limit(5);
  console.log('Result from events:', res1);

  if (res1.error) {
    console.log('Testing listing tables or creating events table if not exists...');
  }
}

run();
