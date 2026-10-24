-- Reglas basicas que tambien se protegen frente a escrituras directas.
ALTER TABLE "USUARIOS"
  ADD CONSTRAINT "USUARIOS_creditos_validos" CHECK (saldo >= 0 AND creditos_retenidos >= 0 AND creditos_retenidos <= saldo),
  ADD CONSTRAINT "USUARIOS_semestre_valido" CHECK (semestre IS NULL OR semestre BETWEEN 1 AND 12);
ALTER TABLE "DISPONIBILIDADES"
  ADD CONSTRAINT "DISPONIBILIDADES_intervalo_valido" CHECK (fecha_fin > fecha_inicio);
ALTER TABLE "SOLICITUDES_INTERCAMBIO"
  ADD CONSTRAINT "SOLICITUDES_intervalo_valido" CHECK (fecha_fin_propuesta > fecha_inicio_propuesta),
  ADD CONSTRAINT "SOLICITUDES_creditos_positivos" CHECK (creditos_requeridos > 0),
  ADD CONSTRAINT "SOLICITUDES_participantes_distintos" CHECK (id_solicitante <> id_ofertante);
ALTER TABLE "RESERVAS"
  ADD CONSTRAINT "RESERVAS_intervalo_valido" CHECK (fecha_fin > fecha_inicio),
  ADD CONSTRAINT "RESERVAS_creditos_positivos" CHECK (creditos > 0),
  ADD CONSTRAINT "RESERVAS_participantes_distintos" CHECK (id_solicitante <> id_ofertante);
ALTER TABLE "CALIFICACIONES"
  ADD CONSTRAINT "CALIFICACIONES_puntuacion_valida" CHECK (puntuacion BETWEEN 1 AND 5),
  ADD CONSTRAINT "CALIFICACIONES_participantes_distintos" CHECK (id_evaluador <> id_evaluado);
ALTER TABLE "MOVIMIENTOS_CREDITO"
  ADD CONSTRAINT "MOVIMIENTOS_saldos_validos" CHECK (
    saldo_anterior >= 0 AND saldo_posterior >= 0 AND
    retenidos_anterior >= 0 AND retenidos_posterior >= 0 AND
    retenidos_anterior <= saldo_anterior AND retenidos_posterior <= saldo_posterior
  );
