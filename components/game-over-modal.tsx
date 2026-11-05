"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { submitScore, type SubmitScoreResult } from "@/app/juegos/actions";
import { Leaderboard } from "@/components/leaderboard";
import { useSession } from "@/components/session-provider";
import type { Game } from "@/lib/games";
import { DEFAULT_NAME, NAME_MAX, normalizeName } from "@/lib/scores";

export type GameOverModalProps = {
  game: Game;
  score: number;
  ranked: boolean; // required: real games pass true, the simulator passes false
  extra?: { label: string; value: string }[]; // CAÍDA: Líneas y Combo máx.
  onRestart: () => void; // "JUGAR DE NUEVO"
};

// "FIN DEL JUEGO" modal shared by every game. It is mounted only while the run
// is over, so the initials and the save result reset on each new run.
export function GameOverModal({ game, score, ranked, extra, onRestart }: GameOverModalProps) {
  const { user } = useSession();
  // null until the player edits the initials, so a session that loads after
  // hydration still fills in the name.
  const [nameInput, setNameInput] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitScoreResult | null>(null);
  const [savedName, setSavedName] = useState("");
  const [pending, startTransition] = useTransition();
  const name = nameInput ?? user?.name ?? DEFAULT_NAME;

  const save = () => {
    if (pending) return;
    const finalName = normalizeName(name) || DEFAULT_NAME;
    startTransition(async () => {
      try {
        const res = await submitScore({ gameId: game.id, name: finalName, score });
        setSavedName(finalName);
        setResult(res);
      } catch {
        // Network down or the action is unreachable.
        setResult({ status: "error" });
      }
    });
  };

  return (
    <div className="modal-bd">
      <div className="modal">
        <h2>FIN DEL JUEGO</h2>
        <div className="final-label">PUNTUACIÓN FINAL</div>
        <div className="final">{score.toLocaleString("es-ES")}</div>
        {extra && extra.length > 0 && (
          <div className="mt-3 flex justify-center gap-8">
            {extra.map((item) => (
              <div key={item.label}>
                <div className="final-label">{item.label}</div>
                <div className="pixel mt-1 text-[16px] text-cyan">{item.value}</div>
              </div>
            ))}
          </div>
        )}

        {!ranked ? (
          <div className="save-msg demo">▸ MODO DEMO · ESTA PARTIDA NO PUNTÚA</div>
        ) : result?.status === "saved" ? (
          <>
            <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            <div className="save-rank">
              PUESTO #{result.best.rank}
              {!result.isNewBest && <> · TU MEJOR: {result.best.score.toLocaleString("es-ES")}</>}
            </div>
            <Leaderboard rows={result.top} highlight={savedName} />
          </>
        ) : (
          <>
            <div className="input-row">
              <input
                value={name}
                maxLength={NAME_MAX}
                disabled={pending}
                onChange={(e) => setNameInput(e.target.value.toUpperCase().slice(0, NAME_MAX))}
                placeholder="TUS INICIALES"
              />
              <button className="btn yellow" onClick={save} disabled={pending}>
                {pending ? "GUARDANDO…" : "GUARDAR PUNTUACIÓN"}
              </button>
            </div>
            {result?.status === "invalid" && <div className="save-msg err">NOMBRE NO VÁLIDO</div>}
            {result?.status === "error" && <div className="save-msg err">NO SE PUDO GUARDAR · REINTENTAR</div>}
          </>
        )}

        <div className="actions">
          <button className="btn" onClick={onRestart}>
            JUGAR DE NUEVO
          </button>
          <Link href="/biblioteca" className="btn magenta">
            VOLVER AL VAULT
          </Link>
        </div>
      </div>
    </div>
  );
}
