import { createClient } from '@supabase/supabase-js';

// Di Vite, kita mengakses environment variables menggunakan import.meta.env
// Dan variabelnya HARUS diawali dengan VITE_
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

// Guard agar modul tidak crash (blank screen) bila env belum diset di Vercel
export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;
