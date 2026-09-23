import { createClient } from "@supabase/supabase-js";

// NOTA: la URL y la clave "anon" de Supabase están pensadas para ser
// públicas (la seguridad real la da RLS en cada tabla, no ocultar esto).
// Se escriben directamente aquí para evitar depender de que la plataforma
// de hosting (Vercel/Netlify/etc.) tenga bien configuradas las variables
// de entorno VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.
//
// Si en algún momento quieres volver a usar variables de entorno (por
// ejemplo, para tener un proyecto de Supabase distinto en desarrollo y
// otro en producción), reemplaza los valores de abajo por:
//   import.meta.env.VITE_SUPABASE_URL
//   import.meta.env.VITE_SUPABASE_ANON_KEY
// y configura esas variables en tu plataforma de hosting.

const supabaseUrl = "https://hxthtzytyaytcevpveqo.supabase.co";
const supabaseAnonKey = "sb_publishable_XCbYbg03cXGrn7sL2ycEjQ_guOEc9bk";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
