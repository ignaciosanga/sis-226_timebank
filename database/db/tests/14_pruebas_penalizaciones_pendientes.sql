\set ON_ERROR_STOP on
-- Ejecutar como administrador. Todo se revierte al final.
BEGIN;
SET LOCAL TIME ZONE 'America/La_Paz';
SELECT set_config('app.encryption_key', 'test-encryption-key-only-for-transaction-32-characters', true);
SELECT set_config('app.hash_pepper', 'test-hash-pepper-only-for-transaction-32-characters', true);

DO $$
DECLARE
    v_carrera uuid; v_cat uuid := gen_random_uuid(); v_hab uuid := gen_random_uuid();
    v_a uuid := gen_random_uuid(); v_b uuid := gen_random_uuid(); v_res uuid := gen_random_uuid();
    v_saldo numeric(12,2); v_n integer; v_estado text; v_cargadas integer; v_cobradas numeric(12,2);
BEGIN
    SELECT "id_carrera" INTO v_carrera FROM public."CARRERAS" ORDER BY "nombre" LIMIT 1;
    INSERT INTO public."CATEGORIAS" ("id_categoria","nombre","estado") VALUES (v_cat,'ZZ_TEST_PEN_'||left(v_cat::text,8),'activo');
    INSERT INTO public."HABILIDADES" ("id_habilidad","nombre","id_categoria","estado") VALUES (v_hab,'ZZ_TEST_PEN_'||left(v_hab::text,8),v_cat,'activo');

    -- Usuario A (cancela) con saldo 0; usuario B es la contraparte.
    INSERT INTO public."USUARIOS" ("id_usuario","nombre","apellido","correo","password_hash","rol","id_carrera","semestre","saldo","creditos_retenidos","estado") VALUES
      (v_a,'A','Prueba','a-'||v_a||'@test.invalid','x','Estudiante',v_carrera,4,0,0,'Activo'),
      (v_b,'B','Prueba','b-'||v_b||'@test.invalid','x','Estudiante',v_carrera,4,10.0,0.0,'Activo');

    INSERT INTO public."RESERVAS" ("id_reserva","id_solicitante","id_ofertante","id_habilidad","fecha_inicio","fecha_fin","creditos","modalidad","lugar","estado")
    VALUES (v_res, v_b, v_a, v_hab, now() + interval '2 hours', now() + interval '3 hours', 1.0, 'Presencial', 'Aula', 'Confirmada');

    -- A cancela a menos de 5 h sin saldo: no se descuenta y queda deuda.
    UPDATE public."RESERVAS" SET "estado"='Cancelada', "cancelado_por"=v_a WHERE "id_reserva"=v_res;

    SELECT "saldo" INTO v_saldo FROM public."USUARIOS" WHERE "id_usuario"=v_a;
    IF v_saldo <> 0 THEN RAISE EXCEPTION 'FALLO: se descontó saldo (%).', v_saldo; END IF;
    SELECT "estado" INTO v_estado FROM public."PENALIZACIONES_PENDIENTES" WHERE "id_reserva"=v_res AND "monto"=0.5;
    IF v_estado IS DISTINCT FROM 'pendiente' THEN RAISE EXCEPTION 'FALLO: no se registró la deuda pendiente.'; END IF;

    -- ETL idempotente: la deuda ya existe, no debe duplicarse.
    SELECT filas_cargadas, creditos_cobrados INTO v_cargadas, v_cobradas FROM public.fn_etl_penalizaciones_pendientes();
    IF v_cargadas <> 0 THEN RAISE EXCEPTION 'FALLO: el ETL duplicó filas (%).', v_cargadas; END IF;

    -- Saldo 0.3 (< 0.5): sigue pendiente (sin cobro parcial).
    UPDATE public."USUARIOS" SET "saldo"=0.3 WHERE "id_usuario"=v_a;
    SELECT "estado" INTO v_estado FROM public."PENALIZACIONES_PENDIENTES" WHERE "id_reserva"=v_res;
    IF v_estado <> 'pendiente' THEN RAISE EXCEPTION 'FALLO: cobro parcial no permitido.'; END IF;

    -- Saldo 2.0: se cobra automáticamente 0.5 y quedan 1.5.
    UPDATE public."USUARIOS" SET "saldo"=2.0 WHERE "id_usuario"=v_a;
    SELECT "saldo" INTO v_saldo FROM public."USUARIOS" WHERE "id_usuario"=v_a;
    SELECT "estado" INTO v_estado FROM public."PENALIZACIONES_PENDIENTES" WHERE "id_reserva"=v_res;
    SELECT COUNT(*) INTO v_n FROM public."MOVIMIENTOS_CREDITO"
      WHERE "id_reserva"=v_res AND "tipo"='cobro_penalizacion_pendiente' AND "cantidad"=-0.5;
    IF v_saldo <> 1.5 OR v_estado <> 'cobrada' OR v_n <> 1 THEN
        RAISE EXCEPTION 'FALLO cobro automático: saldo=%, estado=%, movimientos=%.', v_saldo, v_estado, v_n;
    END IF;
    RAISE NOTICE 'OK: penalizaciones pendientes (registro, no parcial, cobro automatico, ETL idempotente).';
END;
$$;

ROLLBACK;
