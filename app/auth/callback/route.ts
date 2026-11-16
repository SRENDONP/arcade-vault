// Single return point of every Supabase flow (SPEC 14): OAuth (Google, GitHub),
// email confirmation and password recovery all come back here with a PKCE
// `code`. It exchanges the code for a session (cookies set through the server
// client) and sends the player on to `next`, or to choose an alias first.
import { NextResponse, type NextRequest } from "next/server";
import { aliasPath, AUTH_ROUTES, safeNext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));
  const fail = () =>
    NextResponse.redirect(
      new URL(`${AUTH_ROUTES.signIn}?error=callback`, origin),
    );

  // Supabase reports a denied consent or an expired link as ?error=…
  if (searchParams.get("error") || !code) return fail();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    console.error("[auth] callback:", error?.code ?? "no user");
    return fail();
  }

  // The recovery flow only needs the session to set the new password.
  if (next !== AUTH_ROUTES.newPassword) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("alias")
      .eq("id", data.user.id)
      .maybeSingle();
    if (!profile?.alias) {
      return NextResponse.redirect(new URL(aliasPath(next), origin));
    }
  }

  return NextResponse.redirect(new URL(next, origin));
}
