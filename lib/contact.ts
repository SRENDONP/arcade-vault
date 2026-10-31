// Contact form validation, shared by ContactForm (UX) and the Server Action (authoritative).
export type ContactInput = { name: string; email: string; msg: string };

export const CONTACT_LIMITS = { name: 80, email: 254, msg: 2000 } as const;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Returns the trimmed input, or null if any field is empty, too long or the email is malformed.
export function validateContact(input: ContactInput): ContactInput | null {
  const name = input.name.trim();
  const email = input.email.trim();
  const msg = input.msg.trim();
  if (!name || !email || !msg) return null;
  if (name.length > CONTACT_LIMITS.name || email.length > CONTACT_LIMITS.email || msg.length > CONTACT_LIMITS.msg) return null;
  if (!EMAIL_RE.test(email)) return null;
  return { name, email, msg };
}
