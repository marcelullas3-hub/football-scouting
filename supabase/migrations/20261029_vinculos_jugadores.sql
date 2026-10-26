-- Bloque 4: vinculos jugador-observacion, sugeridos por club y duplicados imposibles.
-- Aplicar DESPUES de 20261028_observacion_minima.sql, como postgres y en una sola
-- transaccion (el backfill depende de set_config(...,true) local a la transaccion).
--
-- NOTA: anadir ('observations','player_id') a la lista blanca de correct_finalized_field
-- va en una migracion aparte (20261030) porque requiere CREATE OR REPLACE con el cuerpo
-- actual completo de esa funcion. El backfill de aqui NO usa correct_finalized_field:
-- usa el flag app.finalized_correction directamente, como se acordo.
--
-- Supuestos a confirmar (marcados):
--   * Las extensiones pg_trgm y unaccent viven en el schema "extensions" (default Supabase).
--     Si no, ajustar el search_path de search_similar_players y create_player.
--   * players.player_id tiene default (gen_random_uuid) para el INSERT de create_player.

-- ---------------------------------------------------------------------------
-- 1) Backfill: copiar los 40 vinculos de observation_player_links a observations.player_id.
--    Las 44 observaciones son de partidos finalizados; el trigger
--    prevent_finalized_observation_update lo permite porque finalized_correction_active()
--    es true (flag 'on' + current_user = 'postgres'). Se registra una fila por cambio.
-- ---------------------------------------------------------------------------
select set_config('app.finalized_correction', 'on', true);

with upd as (
  update public.observations o
     set player_id = l.player_id
    from public.observation_player_links l
   where l.observation_id = o.observation_id
     and o.player_id is null
  returning o.observation_id, o.user_id, o.player_id as new_player_id
)
insert into public.finalized_correction_log
  (table_name, row_id, field, old_value, new_value, reason, row_owner, corrected_by, applied_via)
select 'observations', u.observation_id, 'player_id', null, to_jsonb(u.new_player_id),
       'Migración de vínculos de enriquecimiento a observations.player_id',
       u.user_id, null, 'migration_20261029'
from upd u;

select set_config('app.finalized_correction', 'off', true);

-- ---------------------------------------------------------------------------
-- 2) Duplicados imposibles (0 duplicados confirmados en produccion).
-- ---------------------------------------------------------------------------
create unique index if not exists observations_uniq_match_player
  on public.observations (match_id, player_id) where player_id is not null;

create unique index if not exists observations_uniq_match_team_dorsal
  on public.observations (match_id, team_id, dorsal) where dorsal is not null;

-- ---------------------------------------------------------------------------
-- 3) Sugeridos por club: club actual = equipo de la observacion mas reciente del jugador
--    (por match_date, desempate por created_at). Respeta players.merged_into y filtra por
--    auth.uid(). Devuelve ultimo dorsal, posiciones habituales, nº de observaciones y
--    fecha de la ultima.
-- ---------------------------------------------------------------------------
create or replace function public.get_team_suggested_players(p_team_id uuid)
returns table(player_id uuid, canonical_name text, last_dorsal integer,
  positions jsonb, observations_count bigint, last_observation_date date)
language sql stable set search_path = public, pg_temp as $$
  with my_obs as (
    select coalesce(p.merged_into, o.player_id) as final_player_id,
           o.team_id, o.dorsal, o.position_observed, o.created_at, m.match_date
    from public.observations o
    join public.matches m on m.match_id = o.match_id
    left join public.players p on p.player_id = o.player_id
    where m.user_id = auth.uid() and o.player_id is not null
  ),
  ranked as (
    select *, row_number() over (partition by final_player_id
             order by match_date desc nulls last, created_at desc) as rn
    from my_obs
  ),
  counts as (
    select final_player_id, count(*) as observations_count, max(match_date) as last_observation_date
    from my_obs group by final_player_id
  ),
  pos as (
    select final_player_id, jsonb_agg(distinct elem) as positions
    from my_obs, lateral jsonb_array_elements_text(coalesce(position_observed, '[]'::jsonb)) elem
    group by final_player_id
  )
  select r.final_player_id, pl.canonical_name, r.dorsal,
         coalesce(pos.positions, '[]'::jsonb), c.observations_count, c.last_observation_date
  from ranked r
  join public.players pl on pl.player_id = r.final_player_id
  join counts c on c.final_player_id = r.final_player_id
  left join pos on pos.final_player_id = r.final_player_id
  where r.rn = 1 and r.team_id = p_team_id
  order by c.last_observation_date desc nulls last, pl.canonical_name;
$$;

-- ---------------------------------------------------------------------------
-- 4) Candidatos por nombre parecido (unaccent + pg_trgm, tambien sobre name_variants),
--    excluyendo jugadores fusionados. Solo lectura.
-- ---------------------------------------------------------------------------
create or replace function public.search_similar_players(p_name text, p_limit integer default 8)
returns table(player_id uuid, canonical_name text, similarity real)
language sql stable set search_path = public, extensions, pg_temp as $$
  with q as (select unaccent(lower(btrim(p_name))) as term)
  select p.player_id, p.canonical_name,
         similarity(unaccent(lower(p.canonical_name)), q.term) as sim
  from public.players p, q
  where p.merged_into is null
    and q.term <> ''
    and (
      unaccent(lower(p.canonical_name)) % q.term
      or exists (
        select 1 from jsonb_array_elements_text(coalesce(p.name_variants, '[]'::jsonb)) v
        where unaccent(lower(v)) % q.term
      )
    )
  order by sim desc, p.canonical_name
  limit greatest(p_limit, 1);
$$;

-- ---------------------------------------------------------------------------
-- 5) Alta de jugador: players no tiene INSERT para authenticated (catalogo comun), asi
--    que va por SECURITY DEFINER. Reutiliza un jugador existente con el mismo nombre
--    normalizado (unaccent + lower) si lo hay; si no, lo crea. Devuelve el player_id.
-- ---------------------------------------------------------------------------
create or replace function public.create_player(p_name text)
returns uuid
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_name text := btrim(p_name);
  v_id uuid;
begin
  if v_name is null or length(v_name) = 0 then
    raise exception 'El nombre del jugador no puede estar vacío.';
  end if;

  select player_id into v_id
  from public.players
  where merged_into is null
    and unaccent(lower(canonical_name)) = unaccent(lower(v_name))
  limit 1;

  if v_id is not null then
    return v_id;
  end if;

  insert into public.players (canonical_name) values (v_name) returning player_id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------
revoke all on function public.get_team_suggested_players(uuid),
  public.search_similar_players(text, integer), public.create_player(text) from public, anon;
grant execute on function public.get_team_suggested_players(uuid),
  public.search_similar_players(text, integer), public.create_player(text) to authenticated, service_role;
