// lib/supabase/server.ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Server-side Supabase client tied to the user's cookies/session.
 * Uses the public anon key and works with RLS (auth.uid()).
 *
 * Note: In Next.js 16, `cookies()` is async-typed, so we `await` it here.
 * This function itself is async, so whenever you use it, do:
 *   const supabase = await createSupabaseServerClient();
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        // For now we don't need to set/remove cookies on the server.
        // If you later use server-side signIn/signOut, we can wire these up.
        set() {
          // no-op
        },
        remove() {
          // no-op
        },
      },
    }
  );
}
