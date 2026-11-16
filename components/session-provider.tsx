"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

// Supabase Auth session (SPEC 14). A module-level store fed by the browser
// client's onAuthStateChange plus the player's row in public.profiles. Auth
// operations (sign in, sign up, OAuth, sign out) run with the same browser
// client, so the store hears about them without a reload.

export type SessionUser = {
  id: string;
  email: string | null;
  alias: string | null; // null = not chosen yet
  providers: string[]; // app_metadata.providers: "email" | "google" | "github"
  meta: Record<string, unknown>; // user_metadata, for suggestAlias
};

export type SessionStatus = "loading" | "signed-out" | "signed-in";

type Snapshot = { status: SessionStatus; user: SessionUser | null };

// The mock session of SPEC 01–13, removed once on start.
const LEGACY_USER_KEY = "av_user";

// The server snapshot is "loading", so the server and the hydration render
// both show the signed-out UI; the user appears right after hydrating.
const SERVER_SNAPSHOT: Snapshot = { status: "loading", user: null };

let snapshot: Snapshot = SERVER_SNAPSHOT;
let session: Session | null = null;
let started = false;
// Bumped on every auth change, so a slow profile read never overwrites a newer state.
let generation = 0;
const listeners = new Set<() => void>();

function setSnapshot(next: Snapshot) {
  snapshot = next;
  listeners.forEach((l) => l());
}

function toUser(s: Session, alias: string | null): SessionUser {
  const providers = s.user.app_metadata?.providers;
  return {
    id: s.user.id,
    email: s.user.email ?? null,
    alias,
    providers: Array.isArray(providers) ? providers.map(String) : [],
    meta: (s.user.user_metadata ?? {}) as Record<string, unknown>,
  };
}

async function loadProfile(s: Session, gen: number) {
  const { data, error } = await createClient()
    .from("profiles")
    .select("alias")
    .eq("id", s.user.id)
    .maybeSingle();
  if (gen !== generation) return;
  // On error the player is still signed in, just without an alias for now.
  if (error)
    console.error("[auth] profile read failed:", error.code, error.message);
  setSnapshot({ status: "signed-in", user: toUser(s, data?.alias ?? null) });
}

function applySession(event: string, next: Session | null) {
  const previous = session;
  session = next;
  const gen = ++generation;
  if (!next) {
    setSnapshot({ status: "signed-out", user: null });
    return;
  }
  // Token refreshes keep the alias we already have; anything else re-reads it.
  const sameUser =
    previous?.user.id === next.user.id && snapshot.user?.id === next.user.id;
  if (sameUser && event === "TOKEN_REFRESHED") {
    setSnapshot({
      status: "signed-in",
      user: toUser(next, snapshot.user?.alias ?? null),
    });
    return;
  }
  void loadProfile(next, gen);
}

function start() {
  if (started) return;
  started = true;
  try {
    localStorage.removeItem(LEGACY_USER_KEY);
  } catch {}
  createClient().auth.onAuthStateChange((event, next) => {
    // Supabase warns against awaiting its own calls inside this callback
    // (it can deadlock), so the profile read runs on the next tick.
    setTimeout(() => applySession(event, next), 0);
  });
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => snapshot;
const getServerSnapshot = () => SERVER_SNAPSHOT;

async function refreshProfile() {
  if (session) await loadProfile(session, generation);
}

async function signOut() {
  const { error } = await createClient().auth.signOut();
  if (error)
    console.error("[auth] sign out failed:", error.code, error.message);
}

type SessionActions = {
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};
const actions: SessionActions = { refresh: refreshProfile, signOut };

const SessionContext = createContext<SessionActions | null>(null);

// The context only carries the (stable) actions. The user is read from the
// store inside each consumer: if the provider held it, its update after
// hydration would reach Suspense boundaries that are still dehydrated and
// cause a hydration mismatch.
export function SessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionContext.Provider value={actions}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  const router = useRouter();
  const { status, user } = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const { signOut: doSignOut } = ctx;
  // After signing out, Server Components (and the proxy) must see no session.
  const logout = useCallback(async () => {
    await doSignOut();
    router.refresh();
  }, [doSignOut, router]);
  return { user, status, refresh: ctx.refresh, logout };
}
