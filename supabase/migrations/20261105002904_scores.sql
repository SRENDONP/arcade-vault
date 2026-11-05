-- SPEC 07: leaderboard. One table for every game, identified by game_id.
-- Writes only go through public.submit_score (security definer); direct
-- INSERT/UPDATE/DELETE is revoked from the API roles. Reads are public.

create table public.scores (
  id         bigint generated always as identity primary key,
  game_id    text        not null check (game_id ~ '^[a-z0-9-]{1,32}$'),
  name       text        not null check (name ~ '^[A-Z0-9Ñ_ .-]{1,10}$'),
  score      integer     not null check (score between 0 and 99999999),
  created_at timestamptz not null default now()
);

comment on table public.scores is 'One row per saved run. The leaderboard keeps the best mark of each name.';

create index scores_game_rank_idx on public.scores (game_id, score desc, created_at asc);

alter table public.scores enable row level security;

create policy "scores are public"
  on public.scores
  for select
  to anon, authenticated
  using (true);

revoke insert, update, delete, truncate, references, trigger on public.scores from anon, authenticated;

-- Top N of a game: the best mark of each name, ordered by score desc and,
-- on a tie, by the oldest mark first. p_limit is clamped to 1..50.
create function public.top_scores(p_game_id text, p_limit integer default 10)
  returns table (rank integer, name text, score integer, created_at timestamptz)
  language sql
  stable
  security invoker
  set search_path = ''
as $$
  with best as (
    select distinct on (s.name) s.name, s.score, s.created_at
    from public.scores s
    where s.game_id = p_game_id
    order by s.name, s.score desc, s.created_at asc
  )
  select
    (row_number() over (order by b.score desc, b.created_at asc))::integer as rank,
    b.name,
    b.score,
    b.created_at
  from best b
  order by b.score desc, b.created_at asc
  limit least(greatest(coalesce(p_limit, 10), 1), 50);
$$;

-- Rank and best mark of one name in a game (same criteria as top_scores).
-- Returns no rows when the name has no marks.
create function public.player_best(p_game_id text, p_name text)
  returns table (rank integer, score integer, created_at timestamptz)
  language sql
  stable
  security invoker
  set search_path = ''
as $$
  with best as (
    select distinct on (s.name) s.name, s.score, s.created_at
    from public.scores s
    where s.game_id = p_game_id
    order by s.name, s.score desc, s.created_at asc
  ),
  ranked as (
    select
      b.name,
      (row_number() over (order by b.score desc, b.created_at asc))::integer as rank,
      b.score,
      b.created_at
    from best b
  )
  select r.rank, r.score, r.created_at
  from ranked r
  where r.name = upper(btrim(p_name));
$$;

-- The only write path. Normalizes the name, validates every input, inserts
-- the run and returns the player's best mark and rank after the insert.
create function public.submit_score(p_game_id text, p_name text, p_score integer)
  returns table (rank integer, score integer, created_at timestamptz)
  language plpgsql
  volatile
  security definer
  set search_path = ''
as $$
#variable_conflict use_column
declare
  v_name text := upper(btrim(coalesce(p_name, '')));
begin
  if p_game_id is null or p_game_id !~ '^[a-z0-9-]{1,32}$' then
    raise exception 'invalid game_id' using errcode = '22023';
  end if;
  if v_name !~ '^[A-Z0-9Ñ_ .-]{1,10}$' then
    raise exception 'invalid name' using errcode = '22023';
  end if;
  if p_score is null or p_score < 0 or p_score > 99999999 then
    raise exception 'invalid score' using errcode = '22023';
  end if;

  insert into public.scores (game_id, name, score)
  values (p_game_id, v_name, p_score);

  return query
    select pb.rank, pb.score, pb.created_at
    from public.player_best(p_game_id, v_name) pb;
end;
$$;

revoke execute on function public.top_scores(text, integer) from public;
revoke execute on function public.player_best(text, text) from public;
revoke execute on function public.submit_score(text, text, integer) from public;

grant execute on function public.top_scores(text, integer) to anon, authenticated;
grant execute on function public.player_best(text, text) to anon, authenticated;
grant execute on function public.submit_score(text, text, integer) to anon, authenticated;
