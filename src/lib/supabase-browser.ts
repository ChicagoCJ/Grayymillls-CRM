import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type BrowserSupabaseClient = ReturnType<typeof createClient>;

let browserSupabaseClient: BrowserSupabaseClient | null = null;

export function hasBrowserSupabaseConfig() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export function getBrowserSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing browser Supabase environment variables.");
  }

  if (!browserSupabaseClient) {
    browserSupabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  }

  return browserSupabaseClient;
}
