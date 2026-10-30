"use client";

import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import {
  appendScore,
  parseUser,
  readUserRaw,
  writeUser,
  type SavedScore,
  type User,
} from "@/lib/session";

type SessionActions = {
  login: (user: User) => void;
  logout: () => void;
  saveScore: (entry: Omit<SavedScore, "at">) => void;
};

const SessionContext = createContext<SessionActions | null>(null);

// Same-tab writes don't fire the "storage" event, so we notify listeners ourselves.
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

// The server snapshot is null, so the server and the hydration render both
// show the signed-out state; the stored user appears right after hydrating.
const getServerSnapshot = () => null;

const actions: SessionActions = {
  login: (u) => {
    writeUser(u);
    notify();
  },
  logout: () => {
    writeUser(null);
    notify();
  },
  saveScore: (entry) => appendScore({ ...entry, at: Date.now() }),
};

// The context only carries the (stable) actions. The user is read from the
// store inside each consumer: if the provider held it, its update after
// hydration would reach Suspense boundaries that are still dehydrated and
// cause a hydration mismatch.
export function SessionProvider({ children }: { children: React.ReactNode }) {
  return <SessionContext.Provider value={actions}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  const raw = useSyncExternalStore(subscribe, readUserRaw, getServerSnapshot);
  const user = useMemo(() => parseUser(raw), [raw]);
  return { ...ctx, user };
}
