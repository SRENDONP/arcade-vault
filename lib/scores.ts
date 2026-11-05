// Leaderboard rules shared by the client, the Server Action and the SQL in
// supabase/migrations/20261105002904_scores.sql. Pure: no React, no Supabase.

export const TOP_LIMIT = 10;
export const MAX_SCORE = 99_999_999;
export const NAME_MAX = 10;
// Same pattern as the CHECK on public.scores.name.
export const NAME_PATTERN = /^[A-Z0-9Ñ_ .-]{1,10}$/;
export const DEFAULT_NAME = "INVITADO";

export type ScoreRow = {
  rank: number;
  name: string;
  score: number;
  date: string;
}; // date: "dd/mm/aaaa"
export type PlayerBest = { rank: number; score: number; date: string };

export function normalizeName(raw: string): string {
  return raw.trim().toUpperCase();
}

export function validateScore(input: {
  name: string;
  score: number;
}): { name: string; score: number } | null {
  const name = normalizeName(typeof input.name === "string" ? input.name : "");
  const { score } = input;
  if (!NAME_PATTERN.test(name)) return null;
  if (!Number.isInteger(score) || score < 0 || score > MAX_SCORE) return null;
  return { name, score };
}

// UTC on purpose, so the server and the browser print the same day.
export function formatScoreDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}
