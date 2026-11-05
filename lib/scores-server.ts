// Server-only leaderboard reads. It uses lib/supabase/server.ts, which reads
// cookies(), so every Server Component that calls it must sit inside <Suspense>
// and it must never run inside a plain "use cache" scope.
import { connection } from "next/server";
import { cache } from "react";
import { formatScoreDate, TOP_LIMIT, type ScoreRow } from "@/lib/scores";
import { createClient } from "@/lib/supabase/server";

// Top 10 of a game (best mark of each name). null = Supabase failed.
// React.cache: the detail page reads it from two <Suspense> boundaries and
// they share one query per request (outside a render it just runs).
export const getTopScores = cache(async (gameId: string): Promise<ScoreRow[] | null> => {
  // Request-time only. Without this, a prerender pass where cookies() already
  // resolves still starts the query, and its fetch is aborted when that pass
  // ends, which used to log a false "[scores] top_scores failed" per request.
  // Outside the try, like createClient(): Next's prerender signals must propagate.
  await connection();
  const supabase = await createClient();

  try {
    const { data, error } = await supabase.rpc("top_scores", {
      p_game_id: gameId,
      p_limit: TOP_LIMIT,
    });
    if (error) {
      console.error("[scores] top_scores failed:", error.code, error.message);
      return null;
    }
    return (data ?? []).map((r) => ({
      rank: r.rank,
      name: r.name,
      score: r.score,
      date: formatScoreDate(r.created_at),
    }));
  } catch (err) {
    console.error(
      "[scores] top_scores failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
});
