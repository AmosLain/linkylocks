import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client.
 * Use this in client components (hooks, forms, etc.).
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * Backwards-compatible alias so existing imports like:
 * `import { createClient } from "@/lib/supabase/client";`
 * continue to work without changing other files.
 */
export const createClient = createSupabaseBrowserClient;
