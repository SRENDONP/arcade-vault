// Session refresh + route protection, run from proxy.ts on every page request.
// The Supabase client here reads the request cookies and writes refreshed
// tokens to both the forwarded request and the response, so Server Components
// see the new session and the browser stores it.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_ROUTES, PROTECTED_PATHS, safeNext } from "@/lib/auth";
import type { Database } from "@/lib/supabase/database.types";

const matches = (pathname: string, route: string) =>
  pathname === route || pathname.startsWith(route + "/");

export async function updateSession(
  request: NextRequest,
): Promise<NextResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  // Without config the app still renders; the server client reports the error.
  if (!url || !key) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Nothing may run between createServerClient and getClaims: this call is
  // what refreshes an expired token.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);

  const { pathname, search, searchParams } = request.nextUrl;

  // A redirect must carry the refreshed cookies, or the session is lost.
  const redirectTo = (target: string) => {
    const redirect = NextResponse.redirect(new URL(target, request.url));
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  if (!signedIn && PROTECTED_PATHS.some((route) => matches(pathname, route))) {
    const next = encodeURIComponent(pathname + search);
    return redirectTo(`${AUTH_ROUTES.signIn}?next=${next}`);
  }

  if (
    signedIn &&
    (pathname === AUTH_ROUTES.signIn || pathname === AUTH_ROUTES.recover)
  ) {
    return redirectTo(safeNext(searchParams.get("next"), AUTH_ROUTES.account));
  }

  if (!signedIn && pathname === AUTH_ROUTES.newPassword) {
    return redirectTo(AUTH_ROUTES.recover);
  }

  return response;
}
