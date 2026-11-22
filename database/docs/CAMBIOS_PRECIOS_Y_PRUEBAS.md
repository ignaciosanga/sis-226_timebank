# Actualización de créditos — SkillSwap V4

- Los valores de créditos se almacenan directamente como `NUMERIC(12,2)` en créditos reales.
- La regla del negocio admite una sola cifra decimal (3.7 sí; 3.75 no).
- Se eliminó la conversión `INTEGER × 10` y la división `/10`.
- El precio publicado por el tutor prevalece sobre la sugerencia dinámica y se conserva como snapshot en solicitud/reserva.
- El ciclo de pago retiene el precio al confirmar la reserva, registra la primera confirmación sin transferir y paga solo al recibirse la segunda confirmación.
- El pago es idempotente; la cancelación anterior al pago libera la retención.
- Penalización: 0.5 créditos si la cancelación ocurre con menos de cinco horas; si no hay saldo libre suficiente, queda pendiente.
- Se actualizaron los datos de demostración y las pruebas HU-04, HU-06, HU-07 y HU-10 para usar decimales reales.

Esta versión está pensada para inicializar un entorno de pruebas limpio. No aplicar scripts antiguos de conversión a décimas.

- Se corrigió HU-06 para usar 3.7 créditos reales en la reserva de prueba; se eliminó un valor residual `37` de la escala anterior.

## V6: integración con el hardening solo-BD

- Base: V4 (créditos decimales `NUMERIC(12,2)`). No se incluyen las migraciones de décimas (`INTEGER × 10`) de la V5 porque contradicen este contrato.
- `initdb/sql/13_hardening_search_path.sql` (nuevo) y `00_bootstrap.sql` (lo incluye al final): versión de `skillswap_v4_sql_injection_solo_bd_sin_coordinacion.sql` sin `BEGIN/COMMIT`, con la lista ampliada de 18 a 23 funciones `SECURITY DEFINER` (se agregan `fn_sugerir_precio_clase` y las 4 funciones del ciclo de pago HU-10).
- `migrations/01_hardening_search_path_solo_bd.sql` (nuevo): la misma migración para una base ya inicializada, con informe de solo lectura.
- `tests/19_pruebas_hardening.sql` (nuevo).
- `tests/12_pruebas_economia_match.sql`: corregido. Tomaba "el último movimiento de la reserva", pero desde HU-10 toda reserva confirmada genera antes un movimiento `retencion_reserva` y el test fallaba también en la V4 original. Ahora filtra los movimientos de tipo `penalizacion`.
- No incluido de la V5: el hardening amplio (`13_hardening_sql_injection.sql`), que sí revoca/otorga permisos y crea `fn_buscar_habilidades_seguro`, ni sus migraciones.

Validado en PostgreSQL 16.15: bootstrap completo desde cero, datos demo, tests 12, 13, 14, 16, 17, 18 y 19; la migración 01 sobre una base V4 ya inicializada (dos ejecuciones, la segunda sin cambios); y el test 19 falla correctamente en una V4 sin el hardening.
