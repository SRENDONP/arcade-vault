"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { submitScore, type SubmitScoreResult } from "@/app/juegos/actions";
import { AliasForm } from "@/components/alias-form";
import { Leaderboard } from "@/components/leaderboard";
import { useSession } from "@/components/session-provider";
import type { Game } from "@/lib/games";
import { AUTH_ROUTES } from "@/lib/auth";

export type GameOverModalProps = {
  game: Game;
  score: number;
  ranked: boolean; // required: real games pass true, the simulator passes false
  extra?: { label: string; value: string }[]; // CAÍDA: Líneas y Combo máx.
  onRestart: () => void; // "JUGAR DE NUEVO"
};

// "FIN DEL JUEGO" modal shared by every game. It is mounted only while the run
// is over, so the save result resets on each new run.
// SPEC 15: only a signed-in player with an alias saves, as that alias; the
// server takes the player from the session. A guest plays but cannot save.
export function GameOverModal({
  game,
  score,
  ranked,
  extra,
  onRestart,
}: GameOverModalProps) {
  const { user, status } = useSession();
  const [result, setResult] = useState<SubmitScoreResult | null>(null);
  // Alias chosen in this modal: shown right away, before the session store
  // has re-rendered with it.
  const [chosenAlias, setChosenAlias] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const alias = user?.alias ?? chosenAlias;
  const signInHref = `${AUTH_ROUTES.signIn}?next=/juegos/${game.id}/jugar`;

  const save = () => {
    if (pending) return;
    startTransition(async () => {
      try {
        setResult(await submitScore({ gameId: game.id, score }));
      } catch {
        // Network down or the action is unreachable.
        setResult({ status: "error" });
      }
    });
  };

  // Which save state to show. The server's answer wins over the session
  // store: an expired session answers "signed-out" even if the browser still
  // thinks it is signed in.
  const view = !ranked
    ? "demo"
    : result?.status === "saved"
      ? "saved"
      : result?.status === "signed-out"
        ? "signed-out"
        : status === "loading"
          ? "loading"
          : !user
            ? "signed-out"
            : result?.status === "no-alias" || !alias
              ? "no-alias"
              : "ready";

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
                <div className="pixel mt-1 text-[16px] text-cyan">
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        )}

        {view === "demo" && (
          <div className="save-msg demo">
            ▸ MODO DEMO · ESTA PARTIDA NO PUNTÚA
          </div>
        )}

        {view === "saved" && result?.status === "saved" && (
          <>
            <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            <div className="save-rank">
              PUESTO #{result.best.rank}
              {!result.isNewBest && (
                <> · TU MEJOR: {result.best.score.toLocaleString("es-ES")}</>
              )}
            </div>
            <Leaderboard rows={result.top} highlight={result.alias} />
          </>
        )}

        {view === "loading" && (
          <div className="input-row">
            <button className="btn yellow save-btn w-full" disabled>
              CARGANDO…
            </button>
          </div>
        )}

        {view === "signed-out" && (
          <div className="save-gate">
            <p className="save-msg">
              ▸ INICIA SESIÓN PARA GUARDAR TU PUNTUACIÓN
            </p>
            <Link href={signInHref} className="btn yellow save-btn">
              INICIAR SESIÓN
            </Link>
          </div>
        )}

        {view === "no-alias" && (
          <AliasForm
            mode="inline"
            onSaved={(a) => {
              setChosenAlias(a);
              setResult(null);
            }}
          />
        )}

        {view === "ready" && (
          <>
            <div className="input-row save-ready">
              <div className="player-plate">
                <span className="player-plate-label">JUGADOR:</span>
                <span className="player-plate-alias">{alias}</span>
              </div>
              <button
                className="btn yellow save-btn"
                onClick={save}
                disabled={pending}
              >
                {pending ? "GUARDANDO…" : "GUARDAR PUNTUACIÓN"}
              </button>
            </div>
            {result?.status === "invalid" && (
              <div className="save-msg err" role="alert">
                PUNTUACIÓN NO VÁLIDA
              </div>
            )}
            {result?.status === "error" && (
              <div className="save-msg err" role="alert">
                NO SE PUDO GUARDAR · REINTENTAR
              </div>
            )}
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
