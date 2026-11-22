-- Complemento del backend para BD v4; no modifica el SQL original entregado.
-- Sólo el propietario instala esta función. rol_app no recibe DML sobre AUDITORIA.
CREATE OR REPLACE FUNCTION public.fn_backend_audit(payload jsonb, replace_metadata boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE item public."AUDITORIA";
BEGIN
  SELECT * INTO item FROM jsonb_populate_record(NULL::public."AUDITORIA", payload);
  IF item.accion NOT IN ('BACKEND_METADATA','IDEMPOTENCY','ADMIN_USER_CREATE','ADMIN_USER_DEACTIVATE','ADMIN_USER_REACTIVATE')
     OR item.accion IS NULL OR item.id_auditoria IS NULL OR item.datos_nuevos IS NULL THEN
    RAISE EXCEPTION 'Registro backend no permitido';
  END IF;
  IF replace_metadata THEN
    IF item.accion <> 'BACKEND_METADATA' THEN RAISE EXCEPTION 'Sólo se actualizan metadatos'; END IF;
    INSERT INTO public."AUDITORIA"(id_auditoria,id_usuario,accion,entidad,entidad_id,datos_nuevos)
    VALUES(item.id_auditoria,item.id_usuario,item.accion,item.entidad,item.entidad_id,item.datos_nuevos)
    ON CONFLICT(id_auditoria) DO UPDATE SET datos_nuevos=item.datos_nuevos,
      id_usuario=item.id_usuario
    WHERE "AUDITORIA".accion='BACKEND_METADATA' AND "AUDITORIA".entidad=item.entidad
      AND "AUDITORIA".entidad_id=item.entidad_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Auditoría existente inmutable'; END IF;
  ELSE
    INSERT INTO public."AUDITORIA"(id_auditoria,id_usuario,accion,entidad,entidad_id,datos_anteriores,datos_nuevos,created_at)
    VALUES(item.id_auditoria,item.id_usuario,item.accion,item.entidad,item.entidad_id,item.datos_anteriores,item.datos_nuevos,COALESCE(item.created_at,now()));
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_backend_audit(jsonb,boolean) FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='rol_app') THEN
    GRANT SELECT,INSERT,UPDATE,DELETE ON public."VERIFICACIONES_CORREO",public."OFERTAS",public."BANNERS_TUTORIA",public."PROGRESO_ACADEMICO" TO rol_app;
    GRANT SELECT ON public."CURRICULOS",public."AREAS_ACADEMICAS",public."MATERIAS_ACADEMICAS",public."PRERREQUISITOS_ACADEMICOS" TO rol_app;
    GRANT EXECUTE ON FUNCTION public.fn_backend_audit(jsonb,boolean) TO rol_app;
  END IF;
END $$;
