"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSession } from "@/components/session-provider";
import { aliasPath, AUTH_ROUTES, PROTECTED_PATHS } from "@/lib/auth";

type Section = "inicio" | "biblioteca" | "salon" | "acerca" | "auth" | null;

function sectionFor(pathname: string | null): Section {
  if (pathname === null) return null;
  if (pathname === "/") return "inicio";
  if (pathname.startsWith("/biblioteca") || pathname.startsWith("/juegos/"))
    return "biblioteca";
  if (pathname.startsWith("/salon")) return "salon";
  if (pathname.startsWith("/acerca-de")) return "acerca";
  if (pathname.startsWith("/auth") || pathname.startsWith(AUTH_ROUTES.account))
    return "auth";
  return null;
}

// Rendered without a pathname as the Suspense fallback, for routes whose
// pathname is only known at request time.
export function NavBar({ pathname }: { pathname: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // The user menu belongs to the page it was opened on: navigating closes it
  // without an effect (it is open only while the pathname still matches).
  const [menuOn, setMenuOn] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { user, logout } = useSession();
  const section = sectionFor(pathname);
  const active = (s: Section) => (section === s ? "active" : "");
  const close = () => setOpen(false);
  const menuOpen =
    user !== null && menuOn !== null && menuOn === (pathname ?? "");
  const closeMenu = () => setMenuOn(null);

  // Close the user menu on Escape and on a press outside it.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOn(null);
    };
    const onPointer = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOn(null);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [menuOpen]);

  const signOut = async () => {
    closeMenu();
    close();
    await logout();
    // A protected page would bounce to /auth: go home instead.
    if (pathname && PROTECTED_PATHS.some((p) => pathname.startsWith(p)))
      router.push("/");
  };

  const accountHref = user?.alias
    ? AUTH_ROUTES.account
    : aliasPath(AUTH_ROUTES.account);
  const accountLabel = user?.alias ? "Cuenta" : "Elegir alias";

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
          <Link href="/" className={active("inicio")}>
            Inicio
          </Link>
          <Link href="/biblioteca" className={active("biblioteca")}>
            Biblioteca
          </Link>
          <Link href="/salon" className={active("salon")}>
            Salón de la Fama
          </Link>
          <Link href="/acerca-de" className={active("acerca")}>
            Acerca de
          </Link>
        </div>
        <div className="spacer"></div>
        <div className="coin-counter">
          <span className="coin"></span>
          <span>CRÉDITOS · 03</span>
        </div>
        {user ? (
          <div className="user-menu auth-btn" ref={menuRef}>
            <button
              type="button"
              className={"btn ghost user-menu-btn" + (menuOpen ? " on" : "")}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-controls="user-menu-panel"
              onClick={() => setMenuOn(menuOpen ? null : (pathname ?? ""))}
            >
              {user.alias ?? "JUGADOR"} <span aria-hidden="true">▾</span>
            </button>
            {menuOpen && (
              <div id="user-menu-panel" className="user-menu-panel" role="menu">
                <Link href={accountHref} role="menuitem" onClick={closeMenu}>
                  {accountLabel}
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  className="danger"
                  onClick={() => void signOut()}
                >
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link href="/auth" className="btn auth-btn">
            Iniciar Sesión
          </Link>
        )}
        <button
          className="btn ghost hamburger"
          onClick={() => setOpen(true)}
          aria-label="Menú"
        >
          ≡
        </button>
      </nav>

      <div
        className={"av-mobile-backdrop" + (open ? " open" : "")}
        onClick={close}
      ></div>
      <aside className={"av-mobile-panel" + (open ? " open" : "")}>
        <div className="pixel neon-cyan mb-4 text-[11px]">MENÚ</div>
        <Link href="/" className={active("inicio")} onClick={close}>
          Inicio
        </Link>
        <Link
          href="/biblioteca"
          className={active("biblioteca")}
          onClick={close}
        >
          Biblioteca
        </Link>
        <Link href="/salon" className={active("salon")} onClick={close}>
          Salón de la Fama
        </Link>
        <Link href="/acerca-de" className={active("acerca")} onClick={close}>
          Acerca de
        </Link>
        {user ? (
          <>
            <Link href={accountHref} className={active("auth")} onClick={close}>
              {accountLabel}
            </Link>
            <button
              type="button"
              className="mobile-signout"
              onClick={() => void signOut()}
            >
              Cerrar sesión
            </button>
          </>
        ) : (
          <Link href="/auth" className={active("auth")} onClick={close}>
            Iniciar Sesión
          </Link>
        )}
        <div className="flex-1"></div>
        <div className="pixel text-[9px] tracking-[0.16em] text-ink-faint">
          CRÉDITOS · 03
        </div>
      </aside>
    </>
  );
}

export function Nav() {
  return <NavBar pathname={usePathname()} />;
}
