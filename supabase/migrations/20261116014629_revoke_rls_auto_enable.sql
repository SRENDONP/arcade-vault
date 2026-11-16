-- rls_auto_enable() is the security definer function behind Supabase's
-- `ensure_rls` event trigger (enables RLS on every new table in public).
-- It returns event_trigger, so it is never meant to be called through the
-- API. Event triggers do not check EXECUTE, so revoking it keeps the
-- trigger working and removes it from /rest/v1/rpc.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
