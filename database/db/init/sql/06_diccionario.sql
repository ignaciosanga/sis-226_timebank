-- Comentarios del esquema. Se ejecuta dentro de la transacción global de bootstrap.

-- CARRERAS
COMMENT ON TABLE  "CARRERAS"            IS 'Catálogo de carreras de la universidad.';
COMMENT ON COLUMN "CARRERAS"."id_carrera" IS 'UUID de la carrera.';
COMMENT ON COLUMN "CARRERAS"."nombre"     IS 'Nombre de la carrera.';
COMMENT ON COLUMN "CARRERAS"."facultad"   IS 'Facultad a la que pertenece.';
COMMENT ON COLUMN "CARRERAS"."estado"     IS 'Estado del registro. Ej.: activo, inactivo.';

-- CATEGORIAS
COMMENT ON TABLE  "CATEGORIAS"              IS 'Agrupa las habilidades.';
COMMENT ON COLUMN "CATEGORIAS"."id_categoria" IS 'UUID de la categoría.';
COMMENT ON COLUMN "CATEGORIAS"."nombre"       IS 'Nombre único de la categoría.';
COMMENT ON COLUMN "CATEGORIAS"."estado"       IS 'Estado del registro.';

-- USUARIOS
COMMENT ON TABLE  "USUARIOS"                    IS 'Estudiantes y administradores. Incluye cuenta de créditos y datos cifrados.';
COMMENT ON COLUMN "USUARIOS"."id_usuario"         IS 'UUID del usuario.';
COMMENT ON COLUMN "USUARIOS"."nombre"             IS 'SENSIBLE. Nombre (copia protegida: nombre_enc).';
COMMENT ON COLUMN "USUARIOS"."apellido"           IS 'SENSIBLE. Apellido (copia protegida: apellido_enc).';
COMMENT ON COLUMN "USUARIOS"."correo"             IS 'SENSIBLE. Correo único (copia: correo_enc; hash: correo_hash).';
COMMENT ON COLUMN "USUARIOS"."password_hash"      IS 'SENSIBLE. Hash Argon2id.';
COMMENT ON COLUMN "USUARIOS"."rol"                IS 'Rol en la aplicación (texto libre).';
COMMENT ON COLUMN "USUARIOS"."id_carrera"         IS 'FK a CARRERAS. Nulo para administradores.';
COMMENT ON COLUMN "USUARIOS"."semestre"           IS 'Semestre actual (> 0) o nulo.';
COMMENT ON COLUMN "USUARIOS"."saldo"              IS 'Saldo de cuenta en créditos reales (NUMERIC(12,2)); se admite una cifra decimal.';
COMMENT ON COLUMN "USUARIOS"."creditos_retenidos" IS 'Créditos retenidos en valores reales (NUMERIC(12,2)); se admite una cifra decimal.';
COMMENT ON COLUMN "USUARIOS"."fecha_registro"     IS 'Fecha de alta.';
COMMENT ON COLUMN "USUARIOS"."ultimo_acceso"      IS 'Último inicio de sesión.';
COMMENT ON COLUMN "USUARIOS"."estado"             IS 'Estado de la cuenta. Ej.: Activo, Inactivo, Suspendido.';
COMMENT ON COLUMN "USUARIOS"."nombre_enc"         IS 'Cifrado pgp_sym.';
COMMENT ON COLUMN "USUARIOS"."apellido_enc"       IS 'Cifrado pgp_sym.';
COMMENT ON COLUMN "USUARIOS"."correo_enc"         IS 'Cifrado pgp_sym.';
COMMENT ON COLUMN "USUARIOS"."correo_hash"        IS 'SHA-256(correo || pepper). UNIQUE.';

-- HABILIDADES
COMMENT ON TABLE  "HABILIDADES"              IS 'Habilidades que se pueden enseñar (única por nombre global).';
COMMENT ON COLUMN "HABILIDADES"."id_habilidad" IS 'UUID.';
COMMENT ON COLUMN "HABILIDADES"."nombre"       IS 'Nombre. Ej.: Python.';
COMMENT ON COLUMN "HABILIDADES"."id_categoria" IS 'FK a CATEGORIAS.';
COMMENT ON COLUMN "HABILIDADES"."estado"       IS 'Estado del registro.';

-- USUARIO_HABILIDADES
COMMENT ON TABLE  "USUARIO_HABILIDADES"              IS 'N:M usuario ↔ habilidad con nivel.';
COMMENT ON COLUMN "USUARIO_HABILIDADES"."id_usuario"   IS 'PK compuesta, FK a USUARIOS.';
COMMENT ON COLUMN "USUARIO_HABILIDADES"."id_habilidad" IS 'PK compuesta, FK a HABILIDADES.';
COMMENT ON COLUMN "USUARIO_HABILIDADES"."nivel"        IS 'basico | intermedio | avanzado.';

-- DISPONIBILIDADES
COMMENT ON TABLE  "DISPONIBILIDADES"                   IS 'Franjas horarias en que un usuario puede dar clases.';
COMMENT ON COLUMN "DISPONIBILIDADES"."id_disponibilidad" IS 'UUID.';
COMMENT ON COLUMN "DISPONIBILIDADES"."id_usuario"        IS 'FK a USUARIOS.';
COMMENT ON COLUMN "DISPONIBILIDADES"."fecha_inicio"      IS 'Inicio de la franja.';
COMMENT ON COLUMN "DISPONIBILIDADES"."fecha_fin"         IS 'Fin (mayor que inicio).';
COMMENT ON COLUMN "DISPONIBILIDADES"."estado"            IS 'disponible | reservado | cancelado.';

-- SOLICITUDES_INTERCAMBIO
COMMENT ON TABLE  "SOLICITUDES_INTERCAMBIO"                        IS 'Pedido de clase de un solicitante a un ofertante.';
COMMENT ON COLUMN "SOLICITUDES_INTERCAMBIO"."id_solicitud"           IS 'UUID.';
COMMENT ON COLUMN "SOLICITUDES_INTERCAMBIO"."id_solicitante"         IS 'FK a USUARIOS; quien paga.';
COMMENT ON COLUMN "SOLICITUDES_INTERCAMBIO"."id_ofertante"           IS 'FK a USUARIOS; quien enseña.';
COMMENT ON COLUMN "SOLICITUDES_INTERCAMBIO"."id_habilidad"           IS 'FK a HABILIDADES.';
COMMENT ON COLUMN "SOLICITUDES_INTERCAMBIO"."fecha_inicio_propuesta" IS 'Inicio propuesto.';
COMMENT ON COLUMN "SOLICITUDES_INTERCAMBIO"."fecha_fin_propuesta"    IS 'Fin propuesto.';
COMMENT ON COLUMN "SOLICITUDES_INTERCAMBIO"."creditos_requeridos"    IS 'Importe requerido en créditos reales (NUMERIC(12,2)).';
COMMENT ON COLUMN "SOLICITUDES_INTERCAMBIO"."estado"                 IS 'Solicitada | Aceptada | Rechazada | Cancelada.';
COMMENT ON COLUMN "SOLICITUDES_INTERCAMBIO"."created_at"             IS 'Fecha de creación.';
COMMENT ON COLUMN "SOLICITUDES_INTERCAMBIO"."respondida_at"          IS 'Fecha de respuesta.';

-- RESERVAS
COMMENT ON TABLE  "RESERVAS"                                IS 'Clase agendada (1 por solicitud aceptada).';
COMMENT ON COLUMN "RESERVAS"."id_reserva"                     IS 'UUID.';
COMMENT ON COLUMN "RESERVAS"."id_solicitud"                   IS 'FK a SOLICITUDES_INTERCAMBIO (única).';
COMMENT ON COLUMN "RESERVAS"."id_solicitante"                 IS 'FK a USUARIOS; quien paga.';
COMMENT ON COLUMN "RESERVAS"."id_ofertante"                   IS 'FK a USUARIOS; quien cobra.';
COMMENT ON COLUMN "RESERVAS"."id_habilidad"                   IS 'FK a HABILIDADES.';
COMMENT ON COLUMN "RESERVAS"."fecha_inicio"                   IS 'Inicio de la clase.';
COMMENT ON COLUMN "RESERVAS"."fecha_fin"                      IS 'Fin (mayor que inicio).';
COMMENT ON COLUMN "RESERVAS"."creditos"                       IS 'Importe de la reserva en créditos reales (NUMERIC(12,2)).';
COMMENT ON COLUMN "RESERVAS"."modalidad"                      IS 'Presencial | Virtual | Hibrida.';
COMMENT ON COLUMN "RESERVAS"."lugar"                          IS 'Aula o enlace.';
COMMENT ON COLUMN "RESERVAS"."estado"                         IS 'Confirmada | Completada | Cancelada.';
COMMENT ON COLUMN "RESERVAS"."confirmacion_solicitante_at"    IS 'Cuándo confirmó el alumno.';
COMMENT ON COLUMN "RESERVAS"."confirmacion_ofertante_at"      IS 'Cuándo confirmó el tutor.';
COMMENT ON COLUMN "RESERVAS"."cancelado_por"                  IS 'FK a USUARIOS; quién canceló.';
COMMENT ON COLUMN "RESERVAS"."motivo_cancelacion"             IS 'SENSIBLE (copia: motivo_cancelacion_enc).';
COMMENT ON COLUMN "RESERVAS"."horas_anticipacion_cancelacion" IS 'Horas de anticipación (>= 0).';
COMMENT ON COLUMN "RESERVAS"."created_at"                     IS 'Fecha de creación.';
COMMENT ON COLUMN "RESERVAS"."completed_at"                   IS 'Fecha de finalización.';
COMMENT ON COLUMN "RESERVAS"."cancelled_at"                   IS 'Fecha de cancelación.';
COMMENT ON COLUMN "RESERVAS"."motivo_cancelacion_enc"         IS 'Cifrado pgp_sym.';

-- MOVIMIENTOS_CREDITO
COMMENT ON TABLE  "MOVIMIENTOS_CREDITO"                     IS 'Libro contable de créditos (sólo INSERT).';
COMMENT ON COLUMN "MOVIMIENTOS_CREDITO"."id_movimiento"       IS 'UUID.';
COMMENT ON COLUMN "MOVIMIENTOS_CREDITO"."id_usuario"          IS 'FK a USUARIOS.';
COMMENT ON COLUMN "MOVIMIENTOS_CREDITO"."id_reserva"          IS 'FK opcional a RESERVAS.';
COMMENT ON COLUMN "MOVIMIENTOS_CREDITO"."tipo"                IS 'bono_inicial | retencion | consumo | transferencia | ...';
COMMENT ON COLUMN "MOVIMIENTOS_CREDITO"."cantidad"            IS 'Movimiento en créditos reales (NUMERIC(12,2)); negativo para descuentos.';
COMMENT ON COLUMN "MOVIMIENTOS_CREDITO"."saldo_anterior"      IS 'Saldo previo en créditos reales (>= 0).';
COMMENT ON COLUMN "MOVIMIENTOS_CREDITO"."saldo_posterior"     IS 'Saldo resultante en créditos reales (>= 0).';
COMMENT ON COLUMN "MOVIMIENTOS_CREDITO"."retenidos_anterior"  IS 'Créditos retenidos previos en valores reales (>= 0).';
COMMENT ON COLUMN "MOVIMIENTOS_CREDITO"."retenidos_posterior" IS 'Créditos retenidos resultantes en valores reales (>= 0).';
COMMENT ON COLUMN "MOVIMIENTOS_CREDITO"."created_at"          IS 'Fecha del movimiento.';
COMMENT ON COLUMN "MOVIMIENTOS_CREDITO"."descripcion"         IS 'Detalle legible.';

-- CALIFICACIONES
COMMENT ON TABLE  "CALIFICACIONES"                    IS 'Evaluación (1-5) entre participantes de una reserva.';
COMMENT ON COLUMN "CALIFICACIONES"."id_calificacion"    IS 'UUID.';
COMMENT ON COLUMN "CALIFICACIONES"."id_reserva"         IS 'FK a RESERVAS.';
COMMENT ON COLUMN "CALIFICACIONES"."id_evaluador"       IS 'FK a USUARIOS.';
COMMENT ON COLUMN "CALIFICACIONES"."id_evaluado"        IS 'FK a USUARIOS.';
COMMENT ON COLUMN "CALIFICACIONES"."puntuacion"         IS 'Entero entre 1 y 5.';
COMMENT ON COLUMN "CALIFICACIONES"."comentario"         IS 'SENSIBLE (copia: comentario_enc).';
COMMENT ON COLUMN "CALIFICACIONES"."created_at"         IS 'Fecha de la calificación.';
COMMENT ON COLUMN "CALIFICACIONES"."comentario_enc"     IS 'Cifrado pgp_sym.';

-- NOTIFICACIONES
COMMENT ON TABLE  "NOTIFICACIONES"                    IS 'Avisos para el usuario.';
COMMENT ON COLUMN "NOTIFICACIONES"."id_notificacion"    IS 'UUID.';
COMMENT ON COLUMN "NOTIFICACIONES"."id_usuario"         IS 'FK a USUARIOS; destinatario.';
COMMENT ON COLUMN "NOTIFICACIONES"."tipo"               IS 'solicitud | reserva | cancelacion | ...';
COMMENT ON COLUMN "NOTIFICACIONES"."titulo"             IS 'Título corto.';
COMMENT ON COLUMN "NOTIFICACIONES"."mensaje"            IS 'SENSIBLE (copia: mensaje_enc).';
COMMENT ON COLUMN "NOTIFICACIONES"."leida"              IS 'true si ya fue leída.';
COMMENT ON COLUMN "NOTIFICACIONES"."created_at"         IS 'Fecha de envío.';
COMMENT ON COLUMN "NOTIFICACIONES"."mensaje_enc"        IS 'Cifrado pgp_sym.';

-- AUDITORIA
COMMENT ON TABLE  "AUDITORIA"                       IS 'Bitácora de cambios. Nadie la edita ni la borra.';
COMMENT ON COLUMN "AUDITORIA"."id_auditoria"          IS 'UUID.';
COMMENT ON COLUMN "AUDITORIA"."id_usuario"            IS 'Quién hizo el cambio (app.usuario_actual).';
COMMENT ON COLUMN "AUDITORIA"."accion"                IS 'INSERT | UPDATE | DELETE.';
COMMENT ON COLUMN "AUDITORIA"."entidad"               IS 'Tabla afectada.';
COMMENT ON COLUMN "AUDITORIA"."entidad_id"            IS 'UUID de la fila afectada.';
COMMENT ON COLUMN "AUDITORIA"."datos_anteriores"      IS 'SENSIBLE (copia: datos_anteriores_enc).';
COMMENT ON COLUMN "AUDITORIA"."datos_nuevos"          IS 'SENSIBLE (copia: datos_nuevos_enc).';
COMMENT ON COLUMN "AUDITORIA"."ip"                    IS 'IP del cliente.';
COMMENT ON COLUMN "AUDITORIA"."created_at"            IS 'Fecha del evento.';
COMMENT ON COLUMN "AUDITORIA"."datos_anteriores_enc"  IS 'Cifrado pgp_sym.';
COMMENT ON COLUMN "AUDITORIA"."datos_nuevos_enc"      IS 'Cifrado pgp_sym.';
