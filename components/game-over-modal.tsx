"use client";

import Link from "next/link";
import { useState } from "react";
import { useSession } from "@/components/session-provider";
import type { Game } from "@/lib/games";

export type GameOverModalProps = {
  game: Game;
  score: number;
  extra?: { label: string; value: string }[]; // CAÍDA: Líneas y Combo máx.
  onRestart: () => void; // "JUGAR DE NUEVO"
};

// "FIN DEL JUEGO" modal shared by every game. It is mounted only while the run
// is over, so the initials and the "saved" flag reset on each new run.
export function GameOverModal({
  game,
  score,
  extra,
  onRestart,
}: GameOverModalProps) {
  const { user, saveScore } = useSession();
  // null until the player edits the initials, so a session that loads after
  // hydration still fills in the name.
  const [nameInput, setNameInput] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const name = nameInput ?? user?.name ?? "INVITADO";

  const save = () => {
    saveScore({ game: game.id, score, name });
    setSaved(true);
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
                <div className="pixel mt-1 text-[16px] text-cyan">
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        )}
        {!saved ? (
          <div className="input-row">
            <input
              value={name}
              onChange={(e) =>
                setNameInput(e.target.value.toUpperCase().slice(0, 10))
              }
              placeholder="TUS INICIALES"
            />
            <button className="btn yellow" onClick={save}>
              GUARDAR PUNTUACIÓN
            </button>
          </div>
        ) : (
          <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
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
