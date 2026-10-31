"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useSession } from "@/components/session-provider";

type Section = "inicio" | "biblioteca" | "salon" | "acerca" | "auth" | null;

function sectionFor(pathname: string | null): Section {
  if (pathname === null) return null;
  if (pathname === "/") return "inicio";
  if (pathname.startsWith("/biblioteca") || pathname.startsWith("/juegos/")) return "biblioteca";
  if (pathname.startsWith("/salon")) return "salon";
  if (pathname.startsWith("/acerca-de")) return "acerca";
  if (pathname.startsWith("/auth")) return "auth";
  return null;
}

// Rendered without a pathname as the Suspense fallback, for routes whose
// pathname is only known at request time.
export function NavBar({ pathname }: { pathname: string | null }) {
  const [open, setOpen] = useState(false);
  const { user, logout } = useSession();
  const section = sectionFor(pathname);
  const active = (s: Section) => (section === s ? "active" : "");
  const close = () => setOpen(false);

  return (
    <>
      <nav className="av-nav">
        <Link href="/" className="logo" onClick={close}>
          <div className="logo-mark"></div>
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </Link>
        <div className="links">
          <Link href="/" className={active("inicio")}>Inicio</Link>
          <Link href="/biblioteca" className={active("biblioteca")}>Biblioteca</Link>
          <Link href="/salon" className={active("salon")}>Salón de la Fama</Link>
          <Link href="/acerca-de" className={active("acerca")}>Acerca de</Link>
        </div>
        <div className="spacer"></div>
        <div className="coin-counter">
          <span className="coin"></span>
          <span>CRÉDITOS · 03</span>
        </div>
        {user ? (
          <button className="btn ghost auth-btn" onClick={logout}>{user.name} ▾</button>
        ) : (
          <Link href="/auth" className="btn auth-btn">Iniciar Sesión</Link>
        )}
        <button className="btn ghost hamburger" onClick={() => setOpen(true)} aria-label="Menú">≡</button>
      </nav>

      <div className={"av-mobile-backdrop" + (open ? " open" : "")} onClick={close}></div>
      <aside className={"av-mobile-panel" + (open ? " open" : "")}>
        <div className="pixel neon-cyan mb-4 text-[11px]">MENÚ</div>
        <Link href="/" className={active("inicio")} onClick={close}>Inicio</Link>
        <Link href="/biblioteca" className={active("biblioteca")} onClick={close}>Biblioteca</Link>
        <Link href="/salon" className={active("salon")} onClick={close}>Salón de la Fama</Link>
        <Link href="/acerca-de" className={active("acerca")} onClick={close}>Acerca de</Link>
        <Link href="/auth" className={active("auth")} onClick={close}>{user ? "Cuenta" : "Iniciar Sesión"}</Link>
        <div className="flex-1"></div>
        <div className="pixel text-[9px] tracking-[0.16em] text-ink-faint">CRÉDITOS · 03</div>
      </aside>
    </>
  );
}

export function Nav() {
  return <NavBar pathname={usePathname()} />;
}
