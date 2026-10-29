"use client";

import { useSession } from "@/components/session-provider";

// Mock "your best" row: only shown with a session, values are made up.
export function HallYouRow({ title, rank, score, delay }: { title: string; rank: number; score: number; delay: number }) {
  const { user } = useSession();
  if (!user) return null;

  return (
    <>
      <div className="tr you-label">▸ TU MEJOR MARCA EN {title}</div>
      <div className="tr you" style={{ animationDelay: `${delay}ms` }}>
        <div className="rk text-yellow">#{String(rank).padStart(2, "0")}</div>
        <div className="pl text-yellow">{user.name}</div>
        <div className="sc text-yellow text-shadow-[0_0_6px_rgba(245,255,0,0.5)]">{score.toLocaleString("es-ES")}</div>
        <div className="dt">11/05/2026</div>
      </div>
    </>
  );
}
