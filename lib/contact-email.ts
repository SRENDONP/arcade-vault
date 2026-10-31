import type { ContactInput } from "@/lib/contact";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// Team notification email: inline-styled HTML (tables only) plus a plain-text fallback.
export function contactEmail(input: ContactInput): { subject: string; html: string; text: string } {
  const subject = `[ARCADE VAULT] Nuevo mensaje de ${input.name.replace(/[\r\n]+/g, " ")}`;
  const name = escapeHtml(input.name);
  const email = escapeHtml(input.email);
  const msg = escapeHtml(input.msg).replace(/\r?\n/g, "<br>");

  const html = `<!doctype html>
<html lang="es">
<body style="margin:0;padding:0;background:#0a0a0f;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0f0f18;border:2px solid #00f5ff;font-family:'Courier New',Courier,monospace;color:#e6e9ff;">
<tr><td style="padding:14px 20px;background:#15151f;border-bottom:1px solid #22223a;font-size:12px;letter-spacing:2px;color:#00f5ff;">&#9656; ARCADE VAULT // NUEVO MENSAJE</td></tr>
<tr><td style="padding:20px 20px 8px;font-size:12px;letter-spacing:2px;color:#ff006e;">NOMBRE</td></tr>
<tr><td style="padding:0 20px 12px;font-size:15px;">${name}</td></tr>
<tr><td style="padding:8px 20px;font-size:12px;letter-spacing:2px;color:#ff006e;">CORREO ELECTR&Oacute;NICO</td></tr>
<tr><td style="padding:0 20px 12px;font-size:15px;"><a href="mailto:${email}" style="color:#00f5ff;">${email}</a></td></tr>
<tr><td style="padding:8px 20px;font-size:12px;letter-spacing:2px;color:#ff006e;">MENSAJE</td></tr>
<tr><td style="padding:0 20px 24px;font-size:15px;line-height:1.6;">${msg}</td></tr>
<tr><td style="padding:12px 20px;border-top:1px solid #22223a;font-size:11px;color:#00ff88;">&gt; Responde a este correo para contestar al jugador.</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = `ARCADE VAULT // NUEVO MENSAJE

NOMBRE: ${input.name}
CORREO ELECTRÓNICO: ${input.email}

MENSAJE:
${input.msg}

> Responde a este correo para contestar al jugador.
`;

  return { subject, html, text };
}
