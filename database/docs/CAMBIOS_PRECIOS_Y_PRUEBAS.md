# Cambios aplicados: precio de tutor y pruebas HU-04/HU-06/HU-10

## Decisión de integración

El precio elegido por el tutor es la fuente de verdad del cobro. La fórmula dinámica de Base de Datos se expone como `fn_sugerir_precio_clase` y es solo una recomendación. El importe queda congelado en `SOLICITUDES_INTERCAMBIO.creditos_requeridos` y se valida al crear `RESERVAS.creditos`.

## Archivos modificados

- `initdb/sql/07_economia_dinamica.sql`: documenta la función legada como sugerencia y agrega `fn_sugerir_precio_clase`.
- `initdb/sql/05_seguridad_roles.sql.tpl`: concede al rol de aplicación la función sugerida y retira acceso a la función legada ambigua.
- `initdb/sql/11_ofertas_tutoria_hu04.sql`: documenta que `costo_decimas` es el precio elegido por el tutor.
- `initdb/sql/12_ciclo_pago_reservas_hu10.sql`: documenta el snapshot y el ciclo de retención/pago.
- `tests/12_pruebas_economia_match.sql`: utiliza la función de sugerencia.
- `tests/16_pruebas_auditoria_hu06.sql`: prueba autocontenida de los tres criterios HU-06.
- `tests/17_pruebas_ofertas_hu04.sql`: prueba el precio manual frente a una sugerencia dinámica distinta.
- `tests/18_pruebas_pago_clases_hu10.sql`: prueba snapshot, retención, doble confirmación, idempotencia y liberación.
- `migrations/03_politica_precio_tutor_autoritativo.sql`: parche para una V4 ya inicializada.

## Pruebas

Ejecutar en una base V4 con los módulos 07, 10, 11, 12 y roles instalados. Todos los scripts de prueba terminan con ROLLBACK.

La validación en este paquete es estática; falta ejecutar contra PostgreSQL real. No se incluye `.env`.

## Version 5: hardening e integracion

- `initdb/sql/13_hardening_sql_injection.sql`: endurecimiento contra inyeccion SQL y escalada de privilegios (sin CREATE en public, sin EXECUTE publico, search_path fijo en funciones SECURITY DEFINER, helpers de claves y ETL fuera del alcance de los roles de aplicacion) y la funcion `fn_buscar_habilidades_seguro`. Se ejecuta al final del bootstrap, despues de los roles.
- `migrations/04_hardening_sql_injection.sql`: el mismo parche con BEGIN/COMMIT, para una base V4 ya inicializada.
- `tests/19_pruebas_hardening.sql`: verifica permisos, la politica de precio (la app solo recibe `fn_sugerir_precio_clase`), el comodin % literal, una entrada hostil y que `rol_app` no puede crear objetos.
- `initdb/sql/00_bootstrap.sql`: incluye el script 13 al final.

El hardening NO corrige consultas concatenadas del backend (usar parametros del driver) ni cierra el DML amplio de `rol_app`: eso es la fase 2 descrita al final del script.
