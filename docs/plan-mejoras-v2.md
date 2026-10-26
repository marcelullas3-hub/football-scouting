# Opinball: plan de mejoras v2 (acordado con Marcel el 25 oct 2026)

Repo: marcelullas3-hub/football-scouting (React 19 + Vite PWA, Vercel). Supabase: lpfyxrnubmuqcgmfwqio.
Regla general: enseñar el SQL a Marcel antes de tocar la base de datos de producción. Un pull request por bloque.

## Lo que hay hoy (comprobado)
- observations: team_id NOT NULL; player_id nullable (0 de 43 rellenos); dorsal nullable; CHECK (player_id o dorsal). Rendimiento, potencial y nivel ya son nullable en BD.
- El nombre del jugador va en `note` y se vincula después vía observation_player_links (40 filas) durante el "enriquecimiento".
- players: canonical_name, name_variants, date_of_birth, height_cm, dominant_foot, external_ids, merged_into; player_nationalities.
- No hay relación jugador–club: se deduce de las observaciones.
- App: PendingMatchObservations.jsx exige dorsal + posición + rendimiento/potencial/nivel (Number(null) → 0, cuidado). RateMatch.jsx exige overall_rating.
- Partidos y observaciones finalizados son inmutables (triggers); las correcciones van por correct_finalized_field; las valoraciones no se corrigen (anti-hindsight).

## 5. Temporada de estadísticas (estilo Balón de Oro). HECHO (ver estado-opinball.md)
- Temporada = del 10 de agosto al 9 de agosto siguiente, por fecha del partido, para todas las competiciones. El Mundial de junio-julio de 2026 cuenta en la 2025/26.
- Sin fecha: "YYYY/YY" → esa temporada; "YYYY" → (YYYY-1)/YY.
- Funciones stats_season / stats_year; get_my_stats y get_my_summary las usan y añaden la cifra "Este año".

## 1. Subir partido sin valorar
- RateMatch: valoración opcional; botón "Subir sin valorar" (avisar de que después no se podrá valorar).
- Estadísticas: media sobre los valorados; mostrar "N sin valorar".

## 2. Observación mínima = jugador identificado + ≥1 posición
- Obligatorio: equipo, (jugador vinculado o dorsal) y al menos una posición observada.
- Opcional: rendimiento, potencial, nivel proyectado, posición proyectada y nota. Enviar null (no 0) si están vacíos.
- BD: CHECK position_observed no nulo y con ≥1 elemento (comprobar antes los datos existentes).

## 4. Jugadores sugeridos por club + vincular al observar + duplicados imposibles
- Club actual de un jugador = team_id de su observación MÁS RECIENTE (por fecha del partido; si es null, created_at). Si una observación nueva lo sitúa en otro club, deja de sugerirse en el anterior y pasa al nuevo. No se gestionan fichajes a mano.
- RPC get_team_suggested_players(p_team_id): jugadores cuyo club actual es ese equipo, con último dorsal, posiciones habituales, nº de observaciones y fecha de la última.
- Formulario de observación: lista de sugeridos del equipo elegido; al tocar uno se rellenan player_id, dorsal y posición (editables). "Jugador nuevo": crear el jugador (nombre como mínimo) y vincularlo al momento, mostrando candidatos de nombre parecido (pg_trgm o unaccent + name_variants) con "¿Es este?". Se mantiene "solo dorsal" para identificarlo después.
- Fuente de verdad: observations.player_id. Migrar los 40 vínculos de observation_player_links a observations.player_id (en finalizados, vía de corrección registrada en finalized_correction_log). Conservar la tabla de vínculos como historial.
- Respetar players.merged_into: sugerencias y búsquedas siempre sobre el jugador final.
- Duplicados imposibles: índice único (match_id, player_id) WHERE player_id IS NOT NULL e índice único (match_id, team_id, dorsal) WHERE dorsal IS NOT NULL (comprobar antes). Aviso claro en la app si choca.

## 3. Búsqueda de jugadores con datos de enriquecimiento
- Filtros: edad / año de nacimiento (rango), altura (rango), pie dominante, nacionalidad, posición (observada o proyectada), nivel proyectado, potencial mínimo, rendimiento medio mínimo, club actual (deducido), nº mínimo de observaciones.
- RPC search_my_players(...) con SECURITY INVOKER y filtro por auth.uid().

## Extras aprobados
- Ficha de jugador: datos, observaciones en el tiempo y evolución de rendimiento y proyección.
- Lista de seguimiento: marcar jugadores y mostrar "visto por última vez" (sin calendario externo por ahora).
- Borrador local: si falla la subida de un partido u observación, guardar en el dispositivo y reintentar.
- Modo rápido: en un partido pendiente, añadir solo dorsal + posición con un toque y completar después.

## Orden
5 (hecho) → 1 → 2 → 4 → 3 → ficha de jugador → seguimiento → borrador → modo rápido.
