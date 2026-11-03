// Checks that the Supabase URL and publishable key in .env.local reach the project.
// Run with `npm run supabase:check` (node --env-file=.env.local). Never prints the key.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

for (const [name, value] of [
  ["NEXT_PUBLIC_SUPABASE_URL", url],
  ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", key],
]) {
  if (!value) {
    console.error(`[ERR] Falta ${name}`);
    process.exit(1);
  }
}

try {
  const base = new URL(url);
  const res = await fetch(new URL("/auth/v1/settings", base), {
    headers: { apikey: key },
  });

  if (res.ok) {
    console.log(`[OK] Supabase conectado: ${base.host}`);
    process.exit(0);
  }

  console.error(`[ERR] HTTP ${res.status}`);
  process.exit(1);
} catch (error) {
  console.error(
    `[ERR] ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}
