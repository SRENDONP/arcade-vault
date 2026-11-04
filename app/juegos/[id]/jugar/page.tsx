import { notFound } from "next/navigation";
import { createElement, Suspense } from "react";
import { GamePlayer } from "@/components/game-player";
import { getPlayable } from "@/games";
import { GAMES, getGame } from "@/lib/games";

export function generateStaticParams() {
  return GAMES.map((g) => ({ id: g.id }));
}

// Same as the detail page: the params read stays inside <Suspense> so the
// shared App Shell can be shown instantly on navigation.
export default function GamePlayerPage({
  params,
}: PageProps<"/juegos/[id]/jugar">) {
  return (
    <Suspense fallback={<PlayerFallback />}>
      <Player params={params} />
    </Suspense>
  );
}

function PlayerFallback() {
  return (
    <div className="av-player">
      <div className="crt">
        <div className="crt-screen">
          <div className="crt-content">
            <div className="pixel text-[12px] text-ink-faint">CARGANDO…</div>
          </div>
        </div>
      </div>
    </div>
  );
}

async function Player({
  params,
}: {
  params: PageProps<"/juegos/[id]/jugar">["params"];
}) {
  const { id } = await params;
  const game = getGame(id);
  if (!game) notFound();

  // Real game from the registry when it exists, otherwise the simulator.
  // createElement instead of JSX: the component comes from a static module-level
  // registry, which the static-components lint rule cannot see through.
  return createElement(getPlayable(id) ?? GamePlayer, { game });
}
