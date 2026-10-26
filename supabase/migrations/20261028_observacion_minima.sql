-- Bloque 2: observacion minima = equipo + (jugador vinculado o dorsal) + >=1 posicion observada.
-- Aplicar DESPUES de 20261027_subir_sin_valorar.sql.
--
-- team_id ya es NOT NULL y el CHECK (player_id o dorsal) ya existe. El CHECK actual
-- is_valid_position_array limita position_observed a <=4 codigos validos pero acepta null;
-- este nuevo CHECK cubre ese hueco exigiendo un array jsonb con al menos un elemento.
--
-- position_observed es jsonb (no un array nativo), por eso se usa jsonb_typeof /
-- jsonb_array_length en vez de cardinality.
--
-- En produccion hay 44 observaciones, 2 SIN position_observed. Por eso el CHECK se crea
-- NOT VALID: se aplica a filas nuevas o modificadas, pero NO valida el historico (las 2
-- antiguas se conservan tal cual). No se ejecuta VALIDATE CONSTRAINT.

alter table public.observations
  add constraint observations_position_observed_not_empty
  check (position_observed is not null
         and jsonb_typeof(position_observed) = 'array'
         and jsonb_array_length(position_observed) >= 1)
  not valid;
