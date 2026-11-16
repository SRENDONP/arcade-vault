import { Suspense } from "react";
import { AliasSetup } from "@/components/alias-setup";

// First alias after signing in (SPEC 14). The proxy only lets a signed-in
// player in. AliasSetup reads ?next= at request time, so it sits in <Suspense>.
export default function AliasPage() {
  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">ELIGE TU ALIAS</h2>
          <div className="mono mt-1.5 text-[11px] tracking-[0.16em] text-ink-faint">
            ASÍ APARECERÁS EN EL SALÓN DE LA FAMA
          </div>
        </div>
        <Suspense
          fallback={
            <div className="mono text-center text-[11px] tracking-[0.16em] text-ink-faint">
              CARGANDO PERFIL…
            </div>
          }
        >
          <AliasSetup />
        </Suspense>
      </div>
    </div>
  );
}
