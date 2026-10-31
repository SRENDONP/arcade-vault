"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "@/components/session-provider";
import type { Game } from "@/lib/games";

type Run = { score: number; level: number };
const NEW_RUN: Run = { score: 0, level: 1 };

// Simulated session: there is no real game yet, the score just ticks up.
export function GamePlayer({ game }: { game: Game }) {
  const { user, saveScore } = useSession();
  const [run, setRun] = useState<Run>(NEW_RUN);
  const [lives, setLives] = useState(3);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  // null until the player edits the initials, so a session that loads after
  // hydration still fills in the name.
  const [nameInput, setNameInput] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const name = nameInput ?? user?.name ?? "INVITADO";

  useEffect(() => {
    if (over || paused) return;
    const t = setInterval(() => {
      const gain = Math.floor(10 + Math.random() * 90);
      setRun((r) => {
        const score = r.score + gain;
        return { score, level: score % 2500 < 100 ? r.level + 1 : r.level };
      });
    }, 220);
    return () => clearInterval(t);
  }, [over, paused]);

  const restart = () => {
    setRun(NEW_RUN);
    setLives(3);
    setPaused(false);
    setOver(false);
    setSaved(false);
  };

  const save = () => {
    saveScore({ game: game.id, score: run.score, name });
    setSaved(true);
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div className="flex flex-wrap gap-6">
          <div className="hud-stat"><div className="l">Jugador</div><div className="v text-ink">{name}</div></div>
          <div className="hud-stat"><div className="l">Puntuación</div><div className="v">{run.score.toLocaleString("es-ES")}</div></div>
          <div className="hud-stat lives"><div className="l">Vidas</div><div className="v">{"♥ ".repeat(lives).trim() || "—"}</div></div>
          <div className="hud-stat level"><div className="l">Nivel</div><div className="v">{String(run.level).padStart(2, "0")}</div></div>
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={() => setPaused((p) => !p)}>{paused ? "REANUDAR" : "PAUSA"}</button>
          <button className="btn magenta" onClick={() => setOver(true)}>FIN</button>
          <Link href={`/juegos/${game.id}`} className="btn ghost">SALIR</Link>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          <div className="game-arena">
            <div className="grid-floor"></div>
            <div className="enemy e1"></div>
            <div className="enemy e2"></div>
            <div className="enemy e3"></div>
            <div className="player-ship"></div>
          </div>
          {paused && (
            <div className="crt-content z-5 bg-black/60">
              <div>
                <div className="pixel neon-yellow text-[22px]">EN PAUSA</div>
                <div className="mono mt-2.5 text-[11px] tracking-[0.16em] text-ink-dim">PULSA REANUDAR PARA CONTINUAR</div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{run.score.toLocaleString("es-ES")}</div>
            {!saved ? (
              <div className="input-row">
                <input value={name} onChange={(e) => setNameInput(e.target.value.toUpperCase().slice(0, 10))} placeholder="TUS INICIALES" />
                <button className="btn yellow" onClick={save}>GUARDAR PUNTUACIÓN</button>
              </div>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>JUGAR DE NUEVO</button>
              <Link href="/biblioteca" className="btn magenta">VOLVER AL VAULT</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
