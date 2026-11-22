-- =====================================================================
-- Roles y privilegios mínimos.
-- Variables psql: :app_pw y :lec_pw
-- =====================================================================

SET password_encryption = 'scram-sha-256';

SELECT format(
  'CREATE ROLE rol_app LOGIN PASSWORD %L CONNECTION LIMIT 20', :'app_pw'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rol_app')
\gexec

SELECT format('ALTER ROLE rol_app WITH LOGIN PASSWORD %L CONNECTION LIMIT 20', :'app_pw')
\gexec

SELECT format(
  'CREATE ROLE rol_lectura LOGIN PASSWORD %L CONNECTION LIMIT 5', :'lec_pw'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rol_lectura')
\gexec

SELECT format('ALTER ROLE rol_lectura WITH LOGIN PASSWORD %L CONNECTION LIMIT 5', :'lec_pw')
\gexec

COMMENT ON ROLE rol_app IS
  'Aplicación SkillSwap: acceso DML de negocio, funciones/vistas de aplicación; no es superusuario.';
COMMENT ON ROLE rol_lectura IS
  'Lectura de catálogos y vistas agregadas no sensibles; sin acceso a datos personales ni funciones de descifrado.';

-- Cerrar accesos implícitos y permisos heredados de PUBLIC.
REVOKE ALL ON DATABASE :"db" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"db" TO rol_app, rol_lectura;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO rol_app, rol_lectura;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- rol_app: CRUD sobre las tablas transaccionales.
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public."CARRERAS", public."CATEGORIAS", public."USUARIOS",
  public."HABILIDADES", public."USUARIO_HABILIDADES", public."DISPONIBILIDADES",
  public."SOLICITUDES_INTERCAMBIO", public."RESERVAS", public."CALIFICACIONES",
  public."NOTIFICACIONES", public."OFERTAS_TUTORIA"
TO rol_app;

-- Libro de créditos: añadir/consultar, pero no alterar ni borrar movimientos.
GRANT SELECT, INSERT ON public."MOVIMIENTOS_CREDITO" TO rol_app;
-- La bitácora no se modifica desde el rol de aplicación; sólo la escribe el trigger.
GRANT SELECT ON public."AUDITORIA" TO rol_app;
GRANT SELECT ON public.config_economia, public.v_ofertas_tutoria_app TO rol_app;
-- Deudas de penalizacion: solo lectura; las escrituras pasan por funciones/triggers SECURITY DEFINER.
GRANT SELECT ON public."PENALIZACIONES_PENDIENTES" TO rol_app;

-- Todas las vistas de aplicación, incluidas las que devuelven información
-- descifrada. rol_app es el único rol ordinario autorizado a utilizarlas.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT viewname FROM pg_views WHERE schemaname = 'public' LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO rol_app', r.viewname);
  END LOOP;
END;
$$;

-- Funciones de consulta utilizadas por el backend.
GRANT EXECUTE ON FUNCTION public.buscar_usuario_por_correo(text) TO rol_app;
GRANT EXECUTE ON FUNCTION public.decrypt_text(bytea) TO rol_app;
GRANT EXECUTE ON FUNCTION public.fn_solicitudes_recibidas(uuid) TO rol_app;
GRANT EXECUTE ON FUNCTION public.fn_solicitudes_enviadas(uuid) TO rol_app;
GRANT EXECUTE ON FUNCTION public.fn_reservas_usuario(uuid) TO rol_app;
GRANT EXECUTE ON FUNCTION public.fn_calificaciones_recibidas(uuid) TO rol_app;
REVOKE EXECUTE ON FUNCTION public.fn_calcular_costo_clase(uuid, uuid, timestamptz) FROM rol_app;
GRANT EXECUTE ON FUNCTION public.fn_sugerir_precio_clase(uuid, uuid, timestamptz) TO rol_app;
GRANT EXECUTE ON FUNCTION public.fn_creditos_a_decimas(numeric) TO rol_app;
GRANT EXECUTE ON FUNCTION public.fn_confirmar_reserva(uuid) TO rol_app;
GRANT EXECUTE ON FUNCTION public.fn_cobrar_penalizaciones_pendientes(uuid) TO rol_app;
GRANT EXECUTE ON FUNCTION public.fn_obtener_top_tutores(uuid, timestamptz, timestamptz, text) TO rol_app;

-- rol_lectura: sólo catálogos. No tiene acceso a tablas con IDs de usuarios,
-- saldos individuales, comentarios, mensajes, ubicaciones ni auditoría.
GRANT SELECT ON public."CARRERAS", public."CATEGORIAS", public."HABILIDADES"
TO rol_lectura;

-- Lista blanca: vistas agregadas o catálogos que no exponen datos personales.
GRANT SELECT ON
  public.v_usuarios_por_facultad,
  public.v_habilidades_categoria,
  public.v_ofertantes_por_habilidad,
  public.v_habilidades_populares,
  public.v_notificaciones_por_tipo,
  public.v_auditoria_por_accion,
  public.v_estadisticas_generales,
  public.v_actividad_mensual,
  public.v_habilidades_mas_solicitadas,
  public.v_reservas_por_categoria,
  public.v_knowledge_gap_index,
  public.v_command_center_resumen,
  public.v_bi_reservas_por_hora,
  public.v_bi_reservas_dia_hora,
  public.v_bi_materias_oferta_demanda,
  public.v_bi_materias_sin_tutores,
  public.v_bi_knowledge_score,
  public.v_bi_penalizaciones_resumen
TO rol_lectura;

-- No otorgar a rol_lectura EXECUTE sobre las funciones privadas de cifrado,
-- descifrado, hash, autenticación ni funciones de consulta por usuario.
