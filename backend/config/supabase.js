import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_ANON_KEY;

if (!process.env.SUPABASE_SERVICE_ROLE_KEY && supabaseKey) {
  try {
    const parts = supabaseKey.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      if (payload?.role === 'anon') {
        console.warn(
          '[Supabase] Running backend with anon key. Set SUPABASE_SERVICE_ROLE_KEY in backend/.env before enabling full RLS.'
        );
      }
    }
  } catch {
    // Ignore non-JWT key formats
  }
}

const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;