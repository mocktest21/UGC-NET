import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export function createSupabaseBrowserClient() {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error("Supabase is not configured yet. Add the project URL and publishable key to the environment variables.");
  }

  // Cookie-backed sessions are required so Next.js middleware can verify
  // the same Supabase session before serving protected admin routes.
  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}
