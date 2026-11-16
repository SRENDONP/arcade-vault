"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/components/session-provider";
import { formatScoreDate, normalizeName, type PlayerBest } from "@/lib/scores";
import { createClient } from "@/lib/supabase/client";

// "Your best" row: real rank and best mark of the player's alias in this game.
// The session lives in the browser, so the lookup runs there too. Hidden
// without a session or alias, while loading, on error, or with no marks.
export function HallYouRow({
  gameId,
  title,
  delay,
}: {
  gameId: string;
  title: string;
  delay: number;
}) {
  const { user } = useSession();
  const name = user?.alias ?? null;
  // Tagged with the query it answers, so switching game or name never shows a stale row.
  const [result, setResult] = useState<{
    key: string;
    best: PlayerBest | null;
  } | null>(null);
  const key = `${gameId}|${name ?? ""}`;

  useEffect(() => {
    if (!name) return;
    let active = true;
    createClient()
      .rpc("player_best", { p_game_id: gameId, p_name: name })
      .then(({ data, error }) => {
        if (!active) return;
        if (error)
          console.error(
            "[scores] player_best failed:",
            error.code,
            error.message,
          );
        const row = error ? undefined : data?.[0];
        setResult({
          key,
          best: row
            ? {
                rank: row.rank,
                score: row.score,
                date: formatScoreDate(row.created_at),
              }
            : null,
        });
      });
    return () => {
      active = false;
    };
  }, [gameId, name, key]);

  const best = result?.key === key ? result.best : null;
  if (!name || !best) return null;

  return (
    <>
      <div className="tr you-label">▸ TU MEJOR MARCA EN {title}</div>
      <div className="tr you" style={{ animationDelay: `${delay}ms` }}>
        <div className="rk text-yellow">
          #{String(best.rank).padStart(2, "0")}
        </div>
        <div className="pl text-yellow">{normalizeName(name)}</div>
        <div className="sc text-yellow text-shadow-[0_0_6px_rgba(245,255,0,0.5)]">
          {best.score.toLocaleString("es-ES")}
        </div>
        <div className="dt">{best.date}</div>
      </div>
    </>
  );
}
