import Link from "next/link";
import { HallYouRow } from "@/components/hall-you-row";
import { GAMES, type Game, seededScores } from "@/lib/games";

const topClass = (i: number) => (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "");

export function HallOfFame({ game }: { game: Game }) {
  const rows = seededScores(game.id.length * 23 + 7, 12);
  const youRank = Math.floor(8 + (game.id.length % 4));
  const youScore = rows[5].score - 2400;

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
        <div className="podium-slot silver">
          <div className="rank-num">02</div>
          <div className="name">{rows[1].name}</div>
          <div className="score">{rows[1].score.toLocaleString("es-ES")}</div>
          <div className="date">{rows[1].date}</div>
        </div>
        <div className="podium-slot gold">
          <div className="pixel text-[9px] tracking-[0.18em] text-gold">CAMPEÓN</div>
          <div className="rank-num mt-1 text-[36px]">01</div>
          <div className="name">{rows[0].name}</div>
          <div className="score text-[20px]">{rows[0].score.toLocaleString("es-ES")}</div>
          <div className="date">{rows[0].date}</div>
        </div>
        <div className="podium-slot bronze">
          <div className="rank-num">03</div>
          <div className="name">{rows[2].name}</div>
          <div className="score">{rows[2].score.toLocaleString("es-ES")}</div>
          <div className="date">{rows[2].date}</div>
        </div>
      </div>

      <div className="hall-table">
        <div className="th">
          <div>RANGO</div>
          <div>JUGADOR</div>
          <div>PUNTUACIÓN</div>
          <div>FECHA</div>
        </div>
        {rows.map((r, i) => (
          <div key={r.name + i} className={"tr" + topClass(i)} style={{ animationDelay: `${i * 50}ms` }}>
            <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
            <div className="pl">{r.name}</div>
            <div className="sc">{r.score.toLocaleString("es-ES")}</div>
            <div className="dt">{r.date}</div>
          </div>
        ))}
        <HallYouRow title={game.title} rank={youRank} score={youScore} delay={rows.length * 50 + 50} />
      </div>
    </>
  );
}
