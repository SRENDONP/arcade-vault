import Link from "next/link";
import { HallYouRow } from "@/components/hall-you-row";
import { GAMES, type Game } from "@/lib/games";
import type { ScoreRow } from "@/lib/scores";
import { getTopScores } from "@/lib/scores-server";

const topClass = (i: number) => (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "");

// Reads Supabase through cookies(), so it must render inside <Suspense> (app/salon/page.tsx).
export async function HallOfFame({ game }: { game: Game }) {
  const rows = await getTopScores(game.id);

  return (
    <>
      <div className="hall-tabs">
        {GAMES.map((g) => (
          <Link key={g.id} href={`/salon?juego=${g.id}`} scroll={false} className={"chip" + (g.id === game.id ? " active" : "")}>
            {g.title}
          </Link>
        ))}
      </div>

      <div className="podium">
        <PodiumSlot row={rows?.[1]} place="silver" />
        <PodiumSlot row={rows?.[0]} place="gold" />
        <PodiumSlot row={rows?.[2]} place="bronze" />
      </div>

      <div className="hall-table">
        <div className="th">
          <div>RANGO</div>
          <div>JUGADOR</div>
          <div>PUNTUACIÓN</div>
          <div>FECHA</div>
        </div>
        {rows === null ? (
          <div className="lb-empty err">RANKING NO DISPONIBLE</div>
        ) : rows.length === 0 ? (
          <div className="lb-empty">AÚN NO HAY PUNTUACIONES</div>
        ) : (
          rows.map((r, i) => (
            <div key={r.rank} className={"tr" + topClass(i)} style={{ animationDelay: `${i * 50}ms` }}>
              <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
              <div className="pl">{r.name}</div>
              <div className="sc">{r.score.toLocaleString("es-ES")}</div>
              <div className="dt">{r.date}</div>
            </div>
          ))
        )}
        <HallYouRow gameId={game.id} title={game.title} delay={(rows?.length ?? 0) * 50 + 50} />
      </div>
    </>
  );
}

// An empty slot (fewer than 3 marks, or Supabase down) shows "—".
function PodiumSlot({ row, place }: { row: ScoreRow | undefined; place: "gold" | "silver" | "bronze" }) {
  const gold = place === "gold";
  return (
    <div className={"podium-slot " + place}>
      {gold && <div className="pixel text-[9px] tracking-[0.18em] text-gold">CAMPEÓN</div>}
      <div className={"rank-num" + (gold ? " mt-1 text-[36px]" : "")}>{gold ? "01" : place === "silver" ? "02" : "03"}</div>
      <div className="name">{row?.name ?? "—"}</div>
      <div className={"score" + (gold ? " text-[20px]" : "")}>{row ? row.score.toLocaleString("es-ES") : "—"}</div>
      <div className="date">{row?.date ?? "—"}</div>
    </div>
  );
}
