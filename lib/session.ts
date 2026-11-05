// Mock session on localStorage (scores live in Supabase: app/juegos/actions.ts).
// Every access is wrapped in try/catch: private mode or a full quota must
// never break the app, it just stops persisting.

export type User = { name: string };

export const USER_KEY = "av_user";

export function readUserRaw(): string | null {
  try {
    return localStorage.getItem(USER_KEY);
  } catch {
    return null;
  }
}

export function parseUser(raw: string | null): User | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    return value && typeof value.name === "string" ? { name: value.name } : null;
  } catch {
    return null;
  }
}

export function writeUser(user: User | null) {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  } catch {}
}
