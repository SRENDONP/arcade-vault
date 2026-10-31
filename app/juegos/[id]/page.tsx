import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Leaderboard } from "@/components/leaderboard";
import { GAMES, getGame, seededScores } from "@/lib/games";

export function generateStaticParams() {
  return GAMES.map((g) => ({ id: g.id }));
}

// The App Shell is shared by every game, so the params read lives inside
// <Suspense>: navigation shows the fallback instantly and the game streams in.
export default function GameDetailPage({ params }: PageProps<"/juegos/[id]">) {
  return (
    <Suspense fallback={<DetailFallback />}>
      <GameDetail params={params} />
    </Suspense>
  );
}

function DetailFallback() {
  return (
    <div className="av-detail">
      <div>
        <div className="detail-cover"></div>
        <p className="pixel mt-5 text-[10px] text-ink-faint">CARGANDO JUEGO…</p>
      </div>
    </div>
  );
}

async function GameDetail({ params }: { params: PageProps<"/juegos/[id]">["params"] }) {
  const { id } = await params;
  const game = getGame(id);
  if (!game) notFound();
  const scores = seededScores(id.length * 17 + 3, 10);

  return (
    <div className="av-detail fade-in">
      <div>
        <div className="detail-cover">
          <div className={"cover-bg " + game.cover}></div>
        </div>
        <div className="detail-info mt-5">
          <div className="detail-tags">
            <span>{game.cat}</span>
            <span>1 JUGADOR</span>
            <span>TECLADO / TÁCTIL</span>
            <span>RETRO 1985</span>
          </div>
          <h2 className="neon-cyan">{game.title}</h2>
          <p>{game.long}</p>
          <div className="stat-strip">
            <div><div className="l">Partidas</div><div className="v">{game.plays}</div></div>
            <div><div className="l">Mejor global</div><div className="v text-magenta text-shadow-[0_0_6px_rgba(255,0,110,0.5)]">{game.best.toLocaleString("es-ES")}</div></div>
            <div><div className="l">Dificultad</div><div className="v text-yellow text-shadow-[0_0_6px_rgba(245,255,0,0.5)]">★ ★ ★ ☆ ☆</div></div>
          </div>
          <div className="detail-actions">
            <Link href={`/juegos/${game.id}/jugar`} className="btn xl pulse">▶  JUGAR AHORA</Link>
            <Link href="/biblioteca" className="btn ghost lg">VOLVER AL VAULT</Link>
          </div>
        </div>
      </div>

      <aside>
        <Leaderboard rows={scores} />
      </aside>
    </div>
  );
}
