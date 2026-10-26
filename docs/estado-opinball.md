# Opinball: estado (26 oct 2026)

- Código: https://github.com/marcelullas3-hub/football-scouting (React 19 + Vite PWA, desplegado en Vercel: https://football-scouting-tau.vercel.app)
- Supabase: proyecto "Football observer's Project" (lpfyxrnubmuqcgmfwqio). Correcciones de finalizados: función correct_finalized_field (queda en finalized_correction_log).
- Plan de trabajo: docs/plan-mejoras-v2.md

## Datos (25 oct)
- 253 partidos, 43 observaciones. "Mundial - IN" con 103 partidos es correcto.

## Bug fecha perdida (Tottenham–Coventry), resuelto en datos
- Causa: en MatchCreation.jsx la fecha de hoy (TODAY) era una constante calculada al cargar el módulo. La PWA del iPhone llevaba abierta desde el 17 oct.
- Datos corregidos: match_date 2026-10-19, is_delayed false.
- "Solo temporada" guarda match_date null A PROPÓSITO: no exigir fecha en BD.
- Arreglo de código: rama fix/fecha-partido-pwa (PR #1). Hacer merge en main.

## Bloque 5 (temporada estilo Balón de Oro): hecho, falta subirlo
- Código: opinball-bloque5.zip → src/shared/statLabels.js (nuevo), src/features/me/MeHome.jsx, src/features/me/MyStats.jsx, supabase/migrations/20261026_stats_season.sql.
- La migración AÚN NO está aplicada en producción. Es compatible hacia atrás (mantiene las columnas antiguas y añade *_year, current_season, current_year).
- Resultado esperado tras aplicarla: temporada 2026/27 = 24 partidos; año 2026 = 148 partidos.

## Siguiente
- Bloque 1 (subir partido sin valorar) según el plan.
