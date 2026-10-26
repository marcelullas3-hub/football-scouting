-- Temporada de estadísticas estilo Balón de Oro: del 10 de agosto al 9 de agosto siguiente,
-- por fecha del partido y para todas las competiciones (el Mundial de verano cuenta en la temporada que acaba).
-- No modifica matches.season. Las columnas antiguas de get_my_stats / get_my_summary se mantienen.

create or replace function public.stats_season(p_match_date date, p_season text)
returns text language sql immutable set search_path = public, pg_temp as $$
  select case
    when p_match_date is not null then (
      select y::text || '/' || lpad(((y + 1) % 100)::text, 2, '0')
      from (select case when p_match_date >= make_date(extract(year from p_match_date)::int, 8, 10)
                        then extract(year from p_match_date)::int
                        else extract(year from p_match_date)::int - 1 end as y) s)
    when p_season ~ '^\d{4}/\d{2}$' then p_season
    when p_season ~ '^\d{4}$' then (p_season::int - 1)::text || '/' || lpad((p_season::int % 100)::text, 2, '0')
    else null
  end
$$;

create or replace function public.stats_year(p_match_date date, p_season text)
returns int language sql immutable set search_path = public, pg_temp as $$
  select case
    when p_match_date is not null then extract(year from p_match_date)::int
    when p_season ~ '^\d{4}$' then p_season::int
    else null
  end
$$;

drop function if exists public.get_my_stats();
create function public.get_my_stats()
returns table(scope text, favorite_position smallint, entity_id uuid, display_name text,
  matches_total bigint, matches_season bigint, avg_rating_total numeric, avg_rating_season numeric,
  in_person_total bigint, in_person_season bigint, observations_total bigint, observations_season bigint,
  matches_year bigint, avg_rating_year numeric, in_person_year bigint, observations_year bigint,
  current_season text, current_year text)
language sql stable set search_path = public, pg_temp as $$
  with m as (
    select m.match_id, m.home_team_id, m.away_team_id, m.competition_id, m.overall_rating, m.viewing_method,
           (public.stats_season(m.match_date, m.season) = public.stats_season(current_date, null)) as cur,
           (public.stats_year(m.match_date, m.season) = extract(year from current_date)::int) as yr,
           (select count(*) from public.observations o where o.match_id = m.match_id) as n_obs
    from public.matches m where m.user_id = auth.uid() and m.status = 'finalized'
  ),
  ents as (
    select 'total'::text as scope, 0 as ord, null::smallint as pos, null::uuid as entity_id, null::text as display_name
    union all select 'team', 1, f.favorite_position, f.team_id, f.display_name from public.get_my_favorite_teams() f
    union all select 'competition', 2, f.favorite_position, f.competition_id, f.display_name from public.get_my_favorite_competitions() f
  )
  select e.scope, e.pos, e.entity_id, e.display_name,
    count(m.match_id), count(m.match_id) filter (where m.cur),
    round(avg(m.overall_rating), 2), round(avg(m.overall_rating) filter (where m.cur), 2),
    count(m.match_id) filter (where m.viewing_method = 'in_person'),
    count(m.match_id) filter (where m.viewing_method = 'in_person' and m.cur),
    coalesce(sum(m.n_obs), 0)::bigint, coalesce(sum(m.n_obs) filter (where m.cur), 0)::bigint,
    count(m.match_id) filter (where m.yr),
    round(avg(m.overall_rating) filter (where m.yr), 2),
    count(m.match_id) filter (where m.viewing_method = 'in_person' and m.yr),
    coalesce(sum(m.n_obs) filter (where m.yr), 0)::bigint,
    public.stats_season(current_date, null), extract(year from current_date)::int::text
  from ents e
  left join m on e.scope = 'total'
            or (e.scope = 'team' and e.entity_id in (m.home_team_id, m.away_team_id))
            or (e.scope = 'competition' and e.entity_id = m.competition_id)
  group by e.scope, e.ord, e.pos, e.entity_id, e.display_name
  order by e.ord, e.pos;
$$;

drop function if exists public.get_my_summary();
create function public.get_my_summary()
returns table(matches_seen bigint, matches_seen_season bigint, matches_pending bigint, last_match_date date,
  observations_total bigint, observations_season bigint,
  matches_seen_year bigint, observations_year bigint, current_season text, current_year text)
language sql stable set search_path = public, pg_temp as $$
  with m as (
    select m.*,
           (public.stats_season(m.match_date, m.season) = public.stats_season(current_date, null)) as cur,
           (public.stats_year(m.match_date, m.season) = extract(year from current_date)::int) as yr
    from public.matches m where m.user_id = auth.uid()
  )
  select count(*) filter (where status = 'finalized'),
         count(*) filter (where status = 'finalized' and cur),
         count(*) filter (where status = 'pending'),
         max(match_date) filter (where status = 'finalized'),
         (select count(*) from public.observations o join m on m.match_id = o.match_id where m.status = 'finalized'),
         (select count(*) from public.observations o join m on m.match_id = o.match_id where m.status = 'finalized' and m.cur),
         count(*) filter (where status = 'finalized' and yr),
         (select count(*) from public.observations o join m on m.match_id = o.match_id where m.status = 'finalized' and m.yr),
         public.stats_season(current_date, null), extract(year from current_date)::int::text
  from m;
$$;

revoke all on function public.stats_season(date, text), public.stats_year(date, text),
  public.get_my_stats(), public.get_my_summary() from public, anon;
grant execute on function public.stats_season(date, text), public.stats_year(date, text),
  public.get_my_stats(), public.get_my_summary() to authenticated, service_role;
