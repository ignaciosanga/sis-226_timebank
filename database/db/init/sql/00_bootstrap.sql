\set ON_ERROR_STOP on

-- La clave solo vive en esta sesion de inicializacion; no se persiste en roles.
SELECT set_config('app.encryption_key', :'enc_key', false);
SELECT set_config('app.hash_pepper', :'hash_pepper', false);
SET TIME ZONE 'America/La_Paz';

\i /docker-entrypoint-initdb.d/sql/01_base_a_schema.sql
\i /docker-entrypoint-initdb.d/sql/00_funciones_criptografia.sql
\i /docker-entrypoint-initdb.d/sql/02_encriptacion.sql
\i /docker-entrypoint-initdb.d/sql/03_vistas_desencriptadas.sql
\i /docker-entrypoint-initdb.d/sql/04_auditoria_automatica.sql
\i /docker-entrypoint-initdb.d/sql/06_diccionario.sql
\i /docker-entrypoint-initdb.d/sql/07_economia_dinamica.sql
\i /docker-entrypoint-initdb.d/sql/08_impacto_match_brechas.sql
\i /docker-entrypoint-initdb.d/sql/09_vistas_bi_hu07.sql
\i /docker-entrypoint-initdb.d/sql/10_penalizaciones_pendientes.sql
\i /docker-entrypoint-initdb.d/sql/11_ofertas_tutoria_hu04.sql
\i /docker-entrypoint-initdb.d/sql/12_ciclo_pago_reservas_hu10.sql
\i /docker-entrypoint-initdb.d/sql/05_seguridad_roles.sql.tpl
\i /docker-entrypoint-initdb.d/sql/13_hardening_sql_injection.sql
