import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/supabase-backend/database.types';

// Use fallback values during build time when env vars might not be available
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);
