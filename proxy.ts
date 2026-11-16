// Refreshes the Supabase session and protects the account routes (SPEC 14).
// The logic lives in lib/supabase/proxy.ts.
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Every page, except Next.js assets and files with an extension (public/).
    "/((?!_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)",
  ],
};
