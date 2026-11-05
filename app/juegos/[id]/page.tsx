import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Leaderboard } from "@/components/leaderboard";
import { GAMES, getGame } from "@/lib/games";
import { getTopScores } from "@/lib/scores-server";

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
            <div>
              <div className="l">Mejor global</div>
              <Suspense fallback={<BestGlobalValue value="…" />}>
                <BestGlobal gameId={game.id} />
              </Suspense>
            </div>
            <div><div className="l">Dificultad</div><div className="v text-yellow text-shadow-[0_0_6px_rgba(245,255,0,0.5)]">★ ★ ★ ☆ ☆</div></div>
          </div>
          <div className="detail-actions">
            <Link href={`/juegos/${game.id}/jugar`} className="btn xl pulse">▶  JUGAR AHORA</Link>
            <Link href="/biblioteca" className="btn ghost lg">VOLVER AL VAULT</Link>
          </div>
        </div>
      </div>

      <aside>
        <Suspense fallback={<LeaderboardFallback />}>
          <GameLeaderboard gameId={game.id} />
        </Suspense>
      </aside>
    </div>
  );
}

// The scores are request-time data (Supabase through cookies()), so each piece
// streams inside its own <Suspense> and the rest of the detail stays prerendered.
// getTopScores is wrapped in React.cache: both pieces share one query.
async function GameLeaderboard({ gameId }: { gameId: string }) {
  return <Leaderboard rows={await getTopScores(gameId)} />;
}

function LeaderboardFallback() {
  return (
    <div className="leaderboard">
      <h3>MEJORES PUNTUACIONES</h3>
      <div className="lb-empty">CARGANDO RANKING…</div>
    </div>
  );
}

async function BestGlobal({ gameId }: { gameId: string }) {
  const rows = await getTopScores(gameId);
  const best = rows?.[0]?.score;
  return <BestGlobalValue value={best === undefined ? "—" : best.toLocaleString("es-ES")} />;
}

function BestGlobalValue({ value }: { value: string }) {
  return <div className="v text-magenta text-shadow-[0_0_6px_rgba(255,0,110,0.5)]">{value}</div>;
}
