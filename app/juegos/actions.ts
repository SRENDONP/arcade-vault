"use server";

import { isRanked } from "@/games";
import {
  formatScoreDate,
  validateScore,
  type PlayerBest,
  type ScoreRow,
} from "@/lib/scores";
import { getTopScores } from "@/lib/scores-server";
import { createClient } from "@/lib/supabase/server";

export type SubmitScoreResult =
  | { status: "saved"; best: PlayerBest; isNewBest: boolean; top: ScoreRow[] }
  | { status: "invalid" } // game not ranked, name or score out of range
  | { status: "error" }; // Supabase failed

// The only path that writes a score. Inputs come from the browser, so every
// field is re-checked here and again inside public.submit_score.
export async function submitScore(input: {
  gameId: string;
  name: string;
  score: number;
}): Promise<SubmitScoreResult> {
  const gameId = typeof input?.gameId === "string" ? input.gameId : "";
  if (!isRanked(gameId)) return { status: "invalid" };

  const valid = validateScore({ name: input.name, score: input.score });
  if (!valid) return { status: "invalid" };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("submit_score", {
      p_game_id: gameId,
      p_name: valid.name,
      p_score: valid.score,
    });
    if (error) {
      // 22023 = the SQL validation rejected the input.
      if (error.code === "22023") return { status: "invalid" };
      console.error("[scores] submit_score failed:", error.code, error.message);
      return { status: "error" };
    }

    const row = data?.[0];
    if (!row) {
      console.error("[scores] submit_score returned no rows");
      return { status: "error" };
    }

    const top = await getTopScores(gameId);
    if (!top) return { status: "error" };

    return {
      status: "saved",
      best: {
        rank: row.rank,
        score: row.score,
        date: formatScoreDate(row.created_at),
      },
      isNewBest: valid.score === row.score,
      top,
    };
  } catch (err) {
    console.error(
      "[scores] submit_score failed:",
      err instanceof Error ? err.message : err,
    );
    return { status: "error" };
  }
}
