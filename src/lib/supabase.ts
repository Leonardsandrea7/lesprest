import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hxthtzytyaytcevpveqo.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_XCbYbg03cXGrn7sL2ycEjQ_guOEc9bk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
