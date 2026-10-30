import Link from "next/link";
import { Suspense } from "react";
import { HallOfFame } from "@/components/hall-of-fame";
import { GAMES, getGame } from "@/lib/games";

// Reading searchParams is request-time data, so only this part waits;
// the heading and the back button stay in the static shell.
async function HallContent({ searchParams }: { searchParams: PageProps<"/salon">["searchParams"] }) {
  const { juego } = await searchParams;
  const id = Array.isArray(juego) ? juego[0] : juego;
  const game = (id && getGame(id)) || GAMES[0];
  return <HallOfFame game={game} />;
}

export default function SalonPage({ searchParams }: PageProps<"/salon">) {
  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel text-[10px]">LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA</p>
      </div>

      <Suspense fallback={<p className="pixel text-center text-[10px] text-ink-faint">CARGANDO RANKING…</p>}>
        <HallContent searchParams={searchParams} />
      </Suspense>

      <div className="mt-8 text-center">
        <Link href="/" className="btn lg">VOLVER A LA BIBLIOTECA</Link>
      </div>
    </div>
  );
}
