// src/lib/supabaseClient.js
import { createClient } from "@supabase/supabase-js";

// Read from root .env (Vite loads from project root via vite.config.js)
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL || "").trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY || "").trim();

// Debug logging
console.log("[supabase] URL configured:", !!supabaseUrl);
console.log("[supabase] Key configured:", !!supabaseAnonKey);
if (supabaseAnonKey && !supabaseAnonKey.startsWith("eyJ")) {
  console.warn(
    "[supabase] WARNING: ANON key looks wrong (should start with 'eyJ'). " +
    "Re-copy the 'anon public' key from Supabase Dashboard."
  );
}

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// ✅ Create client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});


