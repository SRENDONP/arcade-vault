-- SPEC 15: scores belong to an account. Every saved run is tied to the
-- player's user_id and the leaderboard shows the CURRENT profiles.alias, so
-- changing the alias renames every mark. The anonymous history (free name,
-- anyone could type anyone's alias) cannot be attributed and is deleted.
-- Writes still only go through public.submit_score, now by auth.uid().

-- Old functions first: they read scores.name.
drop function public.submit_score(text, text, integer);
drop function public.player_best(text, text);
drop function public.top_scores(text, integer);

delete from public.scores;

alter table public.scores drop column name;
alter table public.scores
  add column user_id uuid not null references public.profiles (id) on delete cascade;

drop index public.scores_game_rank_idx;
create index scores_game_user_idx on public.scores (game_id, user_id, score desc, created_at asc);

comment on table public.scores is 'One row per saved run of a signed-in player. The leaderboard keeps the best mark of each user_id and shows profiles.alias.';

-- Top N of a game: the best mark of each user_id with their current alias,
-- ordered by score desc and, on a tie, by the oldest mark first. Profiles
-- without an alias are left out. p_limit is clamped to 1..50.
-- security definer because profiles is only readable by its owner; it only
-- returns the alias, never user_id or email.
create function public.top_scores(p_game_id text, p_limit integer default 10)
  returns table (rank integer, name text, score integer, created_at timestamptz)
  language sql
  stable
  security definer
  set search_path = ''
as $$
  with best as (
    select distinct on (s.user_id) s.user_id, s.score, s.created_at
    from public.scores s
    where s.game_id = p_game_id
    order by s.user_id, s.score desc, s.created_at asc
  )
  select
    (row_number() over (order by b.score desc, b.created_at asc))::integer as rank,
    p.alias as name,
    b.score,
    b.created_at
  from best b
  join public.profiles p on p.id = b.user_id
  where p.alias is not null
  order by b.score desc, b.created_at asc
  limit least(greatest(coalesce(p_limit, 10), 1), 50);
$$;

-- Rank and best mark of the signed-in user in a game (same criteria as
-- top_scores). No session or no marks: no rows.
create function public.my_best(p_game_id text)
  returns table (rank integer, score integer, created_at timestamptz)
  language sql
  stable
  security invoker
  set search_path = ''
as $$
  with best as (
    select distinct on (s.user_id) s.user_id, s.score, s.created_at
    from public.scores s
    where s.game_id = p_game_id
    order by s.user_id, s.score desc, s.created_at asc
  ),
  ranked as (
    select
      b.user_id,
      (row_number() over (order by b.score desc, b.created_at asc))::integer as rank,
      b.score,
      b.created_at
    from best b
  )
  select r.rank, r.score, r.created_at
  from ranked r
  where r.user_id = (select auth.uid());
$$;

-- The only write path. Requires a session (42501) and a chosen alias
-- (22004), validates the inputs (22023), inserts the run for auth.uid() and
-- returns the player's best mark and rank after the insert.
create function public.submit_score(p_game_id text, p_score integer)
  returns table (rank integer, score integer, created_at timestamptz)
  language plpgsql
  volatile
  security definer
  set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user_id uuid := auth.uid();
  v_alias   text;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select p.alias into v_alias
  from public.profiles p
  where p.id = v_user_id;

  if v_alias is null then
    raise exception 'alias required' using errcode = '22004';
  end if;
  if p_game_id is null or p_game_id !~ '^[a-z0-9-]{1,32}$' then
    raise exception 'invalid game_id' using errcode = '22023';
  end if;
  if p_score is null or p_score < 0 or p_score > 99999999 then
    raise exception 'invalid score' using errcode = '22023';
  end if;

  insert into public.scores (game_id, user_id, score)
  values (p_game_id, v_user_id, p_score);

  return query
    select mb.rank, mb.score, mb.created_at
    from public.my_best(p_game_id) mb;
end;
$$;

-- Supabase's default privileges grant EXECUTE to anon on new functions, so
-- my_best and submit_score revoke it explicitly as well as from public.
revoke execute on function public.top_scores(text, integer) from public;
revoke execute on function public.my_best(text) from public, anon;
revoke execute on function public.submit_score(text, integer) from public, anon;

grant execute on function public.top_scores(text, integer) to anon, authenticated;
grant execute on function public.my_best(text) to authenticated;
grant execute on function public.submit_score(text, integer) to authenticated;

-- The "scores are public" select policy and the revoke of
-- insert/update/delete on scores from anon/authenticated stay as they were.
