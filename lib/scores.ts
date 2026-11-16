// Leaderboard rules shared by the client, the Server Action and the SQL in
// supabase/migrations/ (scores, profiles, scores_user). Pure: no React, no
// Supabase. Since SPEC 15 the leaderboard name is the player's profiles.alias.

export const TOP_LIMIT = 10;
export const MAX_SCORE = 99_999_999;
export const NAME_MAX = 10;
// Same pattern as the CHECK on public.profiles.alias (used by lib/auth.ts).
export const NAME_PATTERN = /^[A-Z0-9Ñ_ .-]{1,10}$/;
export const DEFAULT_NAME = "INVITADO";

export type ScoreRow = {
  rank: number;
  name: string;
  score: number;
  date: string;
}; // name: the player's current alias; date: "dd/mm/aaaa"
export type PlayerBest = { rank: number; score: number; date: string };

export function normalizeName(raw: string): string {
  return raw.trim().toUpperCase();
}

// The name is no longer sent: the server takes it from the session.
export function validateScore(score: number): number | null {
  if (!Number.isInteger(score) || score < 0 || score > MAX_SCORE) return null;
  return score;
}

// UTC on purpose, so the server and the browser print the same day.
export function formatScoreDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}
