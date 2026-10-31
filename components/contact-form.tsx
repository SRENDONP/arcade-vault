"use client";

import { startTransition, useActionState, useState } from "react";
import { sendContactMessage, type ContactResult } from "@/app/acerca-de/actions";
import { validateContact, type ContactInput } from "@/lib/contact";

const EMPTY: ContactInput = { name: "", email: "", msg: "" };
const IDLE: ContactResult = { status: "idle" };

// Contact form wired to Resend through a Server Action (SPEC 03).
export function ContactForm() {
  const [form, setForm] = useState<ContactInput>(EMPTY);
  const [shake, setShake] = useState(false);
  // Hides the last terminal after "REINTENTAR" / "ENVIAR OTRO MENSAJE" while useActionState keeps its result.
  const [dismissed, setDismissed] = useState(false);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 400);
  };

  const [result, formAction, isPending] = useActionState(async (prev: ContactResult, formData: FormData) => {
    const next = await sendContactMessage(prev, formData);
    if (next.status === "invalid") triggerShake();
    return next;
  }, IDLE);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isPending) return;
    if (!validateContact(form)) {
      triggerShake();
      return;
    }
    const formData = new FormData(e.currentTarget);
    setDismissed(false);
    startTransition(() => formAction(formData));
  };

  const retry = () => setDismissed(true);

  const reset = () => {
    setDismissed(true);
    setForm(EMPTY);
  };

  const view = isPending || dismissed ? "form" : result.status === "sent" || result.status === "error" ? result.status : "form";

  return (
    <form className={"contact-form" + (shake ? " shake" : "")} onSubmit={onSubmit}>
      {view === "form" && (
        <>
          <div className="field">
            <label>NOMBRE</label>
            <input name="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="px_kai" />
          </div>
          <div className="field">
            <label>CORREO ELECTRÓNICO</label>
            <input name="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jugador@vault.gg" />
          </div>
          <div className="field">
            <label>MENSAJE</label>
            <textarea name="msg" rows={5} value={form.msg} onChange={(e) => setForm({ ...form, msg: e.target.value })} placeholder="Cuéntanos qué tienes en mente…"></textarea>
          </div>
          {/* Honeypot: invisible to people and assistive tech; bots that fill it get a fake success. */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
            <input name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
          </div>
          <button className="btn xl press w-full" type="submit" disabled={isPending}>
            {isPending ? "▶  TRANSMITIENDO…" : "▶  ENVIAR MENSAJE"}
          </button>
        </>
      )}
      {view === "sent" && result.status === "sent" && (
        <div className="terminal-success">
          <div className="term-bar">
            <span className="dot r"></span><span className="dot y"></span><span className="dot g"></span>
            <span className="term-title">VAULT-OS // TERMINAL</span>
          </div>
          <div className="term-body">
            <div className="line"><span className="prompt">vault@arcade:~$</span> ./send_message --to=team</div>
            <div className="line dim">[OK] Conectando con servidor…</div>
            <div className="line dim">[OK] Validando contenido…</div>
            <div className="line dim">[OK] Transmitiendo paquete…</div>
            <div className="line success">&gt; MENSAJE RECIBIDO. TE RESPONDEREMOS PRONTO. GRACIAS, {result.name.toUpperCase()}.<span className="caret">_</span></div>
            <div className="mt-[18px]">
              <button className="btn ghost" type="button" onClick={reset}>ENVIAR OTRO MENSAJE</button>
            </div>
          </div>
        </div>
      )}
      {view === "error" && (
        <div className="terminal-success">
          <div className="term-bar">
            <span className="dot r"></span><span className="dot y"></span><span className="dot g"></span>
            <span className="term-title">VAULT-OS // TERMINAL</span>
          </div>
          <div className="term-body">
            <div className="line"><span className="prompt">vault@arcade:~$</span> ./send_message --to=team</div>
            <div className="line dim">[OK] Conectando con servidor…</div>
            <div className="line error">[ERR] Transmisión interrumpida.</div>
            <div className="line error final">&gt; TRANSMISIÓN FALLIDA. INTÉNTALO DE NUEVO EN UNOS MINUTOS.<span className="caret">_</span></div>
            <div className="mt-[18px]">
              <button className="btn ghost" type="button" onClick={retry}>REINTENTAR</button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
