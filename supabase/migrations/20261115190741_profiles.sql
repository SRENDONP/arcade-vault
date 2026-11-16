-- SPEC 14: player profile. One row per auth user, created by a trigger with
-- alias NULL ("not chosen yet"). The alias follows the leaderboard name rules
-- (NAME_PATTERN in lib/scores.ts) so SPEC 15 can write it to scores.name as is.
-- Each user reads and updates only their own row, and only the alias column.

create table public.profiles (
  id         uuid        primary key references auth.users (id) on delete cascade,
  alias      text        unique
             check (
               alias ~ '^[A-Z0-9Ñ_ .-]{1,10}$'   -- same as NAME_PATTERN
               and alias = upper(btrim(alias))  -- already normalized
               and alias <> 'INVITADO'          -- DEFAULT_NAME is reserved
             ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'One row per auth user. alias NULL means the player has not chosen it yet.';

alter table public.profiles enable row level security;

create policy "profiles: read own"
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()));

create policy "profiles: update own"
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

revoke all on public.profiles from anon;
revoke insert, update, delete, truncate, references, trigger on public.profiles from authenticated;
grant update (alias) on public.profiles to authenticated;

-- updated_at on every update.
create function public.profiles_touch()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.profiles_touch() from public, anon, authenticated;

create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.profiles_touch();

-- Profile row for every new auth user. It only inserts the id, so it cannot
-- fail on user data and block a sign-up.
create function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: users created before this migration.
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;
