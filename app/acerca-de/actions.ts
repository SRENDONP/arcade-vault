"use server";

import { Resend } from "resend";
import { validateContact } from "@/lib/contact";
import { contactEmail } from "@/lib/contact-email";

export type ContactResult =
  | { status: "idle" }
  | { status: "sent"; name: string }
  | { status: "invalid" }
  | { status: "error" };

const field = (formData: FormData, key: string) => {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
};

export async function sendContactMessage(_prev: ContactResult, formData: FormData): Promise<ContactResult> {
  // Honeypot: bots get a fake success so they don't learn they were caught.
  if (field(formData, "website")) return { status: "sent", name: field(formData, "name").trim() };

  const input = validateContact({
    name: field(formData, "name"),
    email: field(formData, "email"),
    msg: field(formData, "msg"),
  });
  if (!input) return { status: "invalid" };

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_FROM_EMAIL;
  const to = process.env.CONTACT_TO_EMAIL;
  if (!apiKey || !from || !to) {
    console.error("[contact] Missing RESEND_API_KEY, CONTACT_FROM_EMAIL or CONTACT_TO_EMAIL");
    return { status: "error" };
  }

  try {
    const { error } = await new Resend(apiKey).emails.send({ from, to, replyTo: input.email, ...contactEmail(input) });
    if (error) {
      console.error("[contact] Resend error:", error.name, error.message);
      return { status: "error" };
    }
  } catch (e) {
    console.error("[contact] Resend request failed:", e instanceof Error ? e.message : e);
    return { status: "error" };
  }

  return { status: "sent", name: input.name };
}
