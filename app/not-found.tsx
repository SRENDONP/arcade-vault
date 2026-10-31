import Link from "next/link";

export default function NotFound() {
  return (
    <section className="av-hero fade-in flex min-h-[60vh] flex-col items-center justify-center">
      <div className="pixel neon-magenta mb-5 text-[12px] tracking-[0.3em]">ERROR 404</div>
      <h1 className="flicker">GAME OVER</h1>
      <div className="sub">
        JUEGO NO ENCONTRADO <span className="blink">_</span>
      </div>
      <p className="mx-auto mt-6 mb-8 max-w-[440px] text-ink-dim">
        Esta dirección no corresponde a ningún juego del vault. Vuelve a la biblioteca para elegir otro.
      </p>
      <Link href="/biblioteca" className="btn lg">VOLVER AL VAULT</Link>
    </section>
  );
}
