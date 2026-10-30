// Mock session and score persistence on localStorage.
// Every access is wrapped in try/catch: private mode or a full quota must
// never break the app, it just stops persisting.

export type User = { name: string };
export type SavedScore = { game: string; score: number; name: string; at: number };

export const USER_KEY = "av_user";
export const SCORES_KEY = "av_scores";

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

export function appendScore(entry: SavedScore) {
  try {
    const all: SavedScore[] = JSON.parse(localStorage.getItem(SCORES_KEY) || "[]");
    all.push(entry);
    localStorage.setItem(SCORES_KEY, JSON.stringify(all));
  } catch {}
}
