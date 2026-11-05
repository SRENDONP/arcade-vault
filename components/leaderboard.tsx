import type { ScoreRow } from "@/lib/scores";

const topClass = (i: number) =>
  i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "";

// rows: null = Supabase failed, [] = no scores yet.
// highlight: name of the row to mark as the player's own.
export function Leaderboard({
  rows,
  highlight,
}: {
  rows: ScoreRow[] | null;
  highlight?: string;
}) {
  return (
    <div className="leaderboard">
      <h3>MEJORES PUNTUACIONES</h3>
      {rows === null ? (
        <div className="lb-empty err">RANKING NO DISPONIBLE</div>
      ) : rows.length === 0 ? (
        <div className="lb-empty">AÚN NO HAY PUNTUACIONES</div>
      ) : (
        rows.map((r, i) => (
          <div
            key={r.rank}
            className={
              "lb-row" + topClass(i) + (r.name === highlight ? " you" : "")
            }
          >
            <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
            <div className="pl">
              {r.name}
              <div className="text-[10px] tracking-[0.1em] text-ink-faint">
                {r.date}
              </div>
            </div>
            <div className="sc">{r.score.toLocaleString("es-ES")}</div>
          </div>
        ))
      )}
    </div>
  );
}
