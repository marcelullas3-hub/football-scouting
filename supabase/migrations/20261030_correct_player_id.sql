-- Bloque 4 (parte 2/2): permitir corregir observations.player_id en finalizados.
-- Aplicar DESPUES de 20261029_vinculos_jugadores.sql.
--
-- CREATE OR REPLACE con el cuerpo actual verbatim de correct_finalized_field; el unico
-- cambio es anadir ('observations','player_id') a la lista blanca, para los
-- enriquecimientos futuros (vincular/cambiar jugador en observaciones ya finalizadas).

CREATE OR REPLACE FUNCTION public.correct_finalized_field(p_table text, p_row_id uuid, p_field text, p_new_value jsonb, p_reason text)
 RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_owner uuid; v_status text; v_old jsonb; v_pk text; v_id bigint;
BEGIN
  IF (p_table, p_field) NOT IN (
      ('matches','season'), ('matches','match_date'), ('matches','viewing_method'), ('matches','is_delayed'),
      ('matches','home_score'), ('matches','away_score'),
      ('observations','position_observed'), ('observations','projected_position'),
      ('observations','dorsal'), ('observations','note'), ('observations','player_id')) THEN
    RAISE EXCEPTION 'correct_finalized_field: %.% no es corregible (las valoraciones no se corrigen: anti-hindsight)', p_table, p_field
      USING ERRCODE = '42501';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'correct_finalized_field: motivo obligatorio (mínimo 10 caracteres)' USING ERRCODE = '22023';
  END IF;
  IF p_table = 'matches' THEN
    SELECT m.user_id, m.status, to_jsonb(m) -> p_field INTO v_owner, v_status, v_old
      FROM public.matches m WHERE m.match_id = p_row_id FOR UPDATE;
    v_pk := 'match_id';
  ELSE
    SELECT o.user_id, m.status, to_jsonb(o) -> p_field INTO v_owner, v_status, v_old
      FROM public.observations o JOIN public.matches m ON m.match_id = o.match_id
     WHERE o.observation_id = p_row_id FOR UPDATE OF o;
    v_pk := 'observation_id';
  END IF;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'correct_finalized_field: fila inexistente' USING ERRCODE = 'P0002'; END IF;
  IF v_uid IS NOT NULL AND v_owner <> v_uid THEN
    RAISE EXCEPTION 'correct_finalized_field: la fila no es tuya' USING ERRCODE = '42501'; END IF;
  IF v_status <> 'finalized' THEN
    RAISE EXCEPTION 'correct_finalized_field: solo para finalizados; edita el partido normalmente' USING ERRCODE = '22023'; END IF;
  IF v_old IS NOT DISTINCT FROM p_new_value THEN
    RAISE EXCEPTION 'correct_finalized_field: el valor nuevo es igual al actual' USING ERRCODE = '22023'; END IF;
  PERFORM set_config('app.finalized_correction', 'on', true);
  EXECUTE format('UPDATE public.%I t SET %I = (jsonb_populate_record(NULL::public.%I, jsonb_build_object(%L, $1))).%I WHERE t.%I = $2',
                 p_table, p_field, p_table, p_field, p_field, v_pk)
    USING p_new_value, p_row_id;
  PERFORM set_config('app.finalized_correction', 'off', true);
  INSERT INTO public.finalized_correction_log (table_name, row_id, field, old_value, new_value, reason, row_owner, corrected_by)
  VALUES (p_table, p_row_id, p_field, v_old, p_new_value, btrim(p_reason), v_owner, v_uid)
  RETURNING correction_id INTO v_id;
  RETURN v_id;
END $function$;
