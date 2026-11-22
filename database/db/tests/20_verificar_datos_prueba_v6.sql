-- SkillSwap V6: verificacion de datos QA adicionales, SIN modificaciones.
-- Ejecutar despues de 04_datos_prueba_v6_extendidos.sql.
\set ON_ERROR_STOP on
BEGIN READ ONLY;
DO $qa$
DECLARE
  n integer;
  s numeric(12,2);
  r numeric(12,2);
BEGIN
  SELECT COUNT(*) INTO n FROM public."USUARIOS"
  WHERE "id_usuario" BETWEEN '92000000-0000-4000-8000-000000000001'::uuid
                         AND '92000000-0000-4000-8000-000000000004'::uuid;
  IF n<>4 THEN RAISE EXCEPTION 'QA V6: se esperaban 4 usuarios ficticios; hay %.',n; END IF;
  SELECT COUNT(*) INTO n FROM public."OFERTAS_TUTORIA"
  WHERE "id_oferta" IN ('98000000-0000-4000-8000-000000000001'::uuid,
                        '98000000-0000-4000-8000-000000000002'::uuid);
  IF n<>2 THEN RAISE EXCEPTION 'QA V6: se esperaban 2 ofertas; hay %.',n; END IF;
  SELECT COUNT(*) INTO n FROM public."RESERVAS"
  WHERE "id_reserva" BETWEEN '95000000-0000-4000-8000-000000000001'::uuid
                          AND '95000000-0000-4000-8000-000000000006'::uuid;
  IF n<>6 THEN RAISE EXCEPTION 'QA V6: se esperaban 6 reservas; hay %.',n; END IF;
  SELECT "saldo","creditos_retenidos" INTO s,r FROM public."USUARIOS"
  WHERE "id_usuario"='92000000-0000-4000-8000-000000000003';
  IF s IS DISTINCT FROM 6.3 OR r IS DISTINCT FROM 2.5 THEN
    RAISE EXCEPTION 'QA V6: Sofia debia tener saldo 6.3 y retenido 2.5; obtuvo % / %.',s,r;
  END IF;
  SELECT "saldo" INTO s FROM public."USUARIOS" WHERE "id_usuario"='92000000-0000-4000-8000-000000000001';
  IF s IS DISTINCT FROM 3.2 THEN RAISE EXCEPTION 'QA V6: Lucia debia tener 3.2; obtuvo %.',s; END IF;
  SELECT COUNT(*) INTO n FROM public."PENALIZACIONES_PENDIENTES"
  WHERE "id_reserva" IN ('95000000-0000-4000-8000-000000000001'::uuid,
                         '95000000-0000-4000-8000-000000000002'::uuid,
                         '95000000-0000-4000-8000-000000000006'::uuid)
    AND "estado"='pendiente';
  IF n<>2 THEN RAISE EXCEPTION 'QA V6: se esperaban 2 penalizaciones pendientes; hay %.',n; END IF;
  SELECT COUNT(*) INTO n FROM public."PENALIZACIONES_PENDIENTES"
  WHERE "id_reserva"='95000000-0000-4000-8000-000000000001' AND "estado"='cobrada';
  IF n<>1 THEN RAISE EXCEPTION 'QA V6: la penalizacion de Lucia debia estar cobrada.'; END IF;
  SELECT COUNT(*) INTO n FROM public."MOVIMIENTOS_CREDITO"
  WHERE "id_reserva"='95000000-0000-4000-8000-000000000003' AND "tipo"='pago_tutoria';
  IF n<>1 THEN RAISE EXCEPTION 'QA V6: se esperaba un unico pago por la reserva R3.'; END IF;
  SELECT COUNT(*) INTO n FROM public."HABILIDADES" h
  WHERE h."id_habilidad"='91000000-0000-4000-8000-000000000003'
    AND NOT EXISTS (SELECT 1 FROM public."USUARIO_HABILIDADES" uh
                    WHERE uh."id_habilidad"=h."id_habilidad");
  IF n<>1 THEN RAISE EXCEPTION 'QA V6: falta la habilidad activa sin tutor.'; END IF;
  RAISE NOTICE 'PASS: datos QA V6 y saldos validos.';
END;
$qa$;
COMMIT;

\echo 'RESUMEN DE DATOS FICTICIOS QA V6'
SELECT "nombre", "apellido", "saldo", "creditos_retenidos"
FROM public."USUARIOS"
WHERE "id_usuario" BETWEEN '92000000-0000-4000-8000-000000000001'::uuid
                       AND '92000000-0000-4000-8000-000000000004'::uuid
ORDER BY "nombre";
SELECT "estado",COUNT(*) AS reservas
FROM public."RESERVAS"
WHERE "id_reserva" BETWEEN '95000000-0000-4000-8000-000000000001'::uuid
                        AND '95000000-0000-4000-8000-000000000006'::uuid
GROUP BY "estado" ORDER BY "estado";
SELECT "estado",COUNT(*) AS penalizaciones
FROM public."PENALIZACIONES_PENDIENTES"
WHERE "id_reserva" IN (
'95000000-0000-4000-8000-000000000001'::uuid,
'95000000-0000-4000-8000-000000000002'::uuid,
'95000000-0000-4000-8000-000000000006'::uuid)
GROUP BY "estado" ORDER BY "estado";
SELECT "titulo", "costo_creditos", "estado"
FROM public."OFERTAS_TUTORIA"
WHERE "id_oferta" IN ('98000000-0000-4000-8000-000000000001'::uuid,
                      '98000000-0000-4000-8000-000000000002'::uuid)
ORDER BY "titulo";
