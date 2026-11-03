// Supabase client for the server: Server Components, Server Actions and Route Handlers.
//
// Cache Components (`cacheComponents: true`) rules for callers:
// - It reads `cookies()`, so a Server Component that uses it must render inside
//   a <Suspense> boundary; reading cookies outside one is a build error.
// - Never call it inside a plain "use cache" scope (it throws there). Read the
//   data outside and pass plain values in, or use "use cache: private".
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/lib/supabase/database.types";

export async function createClient(): Promise<SupabaseClient<Database>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url) throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL");
  if (!key) throw new Error("Falta NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

  const cookieStore = await cookies();

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Safe to ignore until a proxy refreshes sessions (auth spec).
        }
      },
    },
  });
}
