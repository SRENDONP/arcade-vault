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
  | {
      status: "saved";
      alias: string; // to highlight the player's row in the top 10
      best: PlayerBest;
      isNewBest: boolean;
      top: ScoreRow[];
    }
  | { status: "signed-out" } // no session or an expired one (42501)
  | { status: "no-alias" } // signed in but no alias chosen yet (22004)
  | { status: "invalid" } // game not ranked or score out of range (22023)
  | { status: "error" }; // Supabase failed

// The only path that writes a score. The player is the user of the session
// cookies: the browser sends no name. Inputs come from the browser, so they
// are re-checked here and again inside public.submit_score.
export async function submitScore(input: {
  gameId: string;
  score: number;
}): Promise<SubmitScoreResult> {
  const gameId = typeof input?.gameId === "string" ? input.gameId : "";
  if (!isRanked(gameId)) return { status: "invalid" };

  const score = validateScore(input?.score);
  if (score === null) return { status: "invalid" };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("submit_score", {
      p_game_id: gameId,
      p_score: score,
    });
    if (error) {
      // 42501: no session (raised by the function, or anon has no EXECUTE).
      if (error.code === "42501") return { status: "signed-out" };
      if (error.code === "22004") return { status: "no-alias" };
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

    // RLS only lets the player read their own profile row.
    const [profile, top] = await Promise.all([
      supabase.from("profiles").select("alias").maybeSingle(),
      getTopScores(gameId),
    ]);
    const alias = profile.data?.alias;
    if (profile.error || !alias) {
      console.error(
        "[scores] profile alias read failed:",
        profile.error?.message ?? "no alias",
      );
      return { status: "error" };
    }
    if (!top) return { status: "error" };

    return {
      status: "saved",
      alias,
      best: {
        rank: row.rank,
        score: row.score,
        date: formatScoreDate(row.created_at),
      },
      isNewBest: score === row.score,
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
