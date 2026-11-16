"use client";

import { useSearchParams } from "next/navigation";
import { AliasForm } from "@/components/alias-form";
import { safeNext } from "@/lib/auth";

// Reads ?next= for /auth/alias; split out so the page header stays static.
export function AliasSetup() {
  const next = safeNext(useSearchParams().get("next"));
  return <AliasForm mode="setup" next={next} />;
}
