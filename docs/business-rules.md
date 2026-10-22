# Reglas de negocio

## Aplicadas en la base de seguridad

- Correo normalizado; detección previa de duplicados y contrato de restricción única en BD. La garantía concurrente permanece pendiente del adaptador oficial.
- Contraseñas hasheadas con Argon2id; hashes fuera de respuestas.
- El registro público fuerza ESTUDIANTE; ADMIN solo podrá asignarse por un flujo autorizado futuro.
- Cuenta, usuario y rol deberán crearse en una transacción única; el puerto del repositorio exige esta atomicidad.
- El saldo inicial requiere aprobación explícita del PO. No se asume un saldo de bienvenida, tampoco cero.
- Usuarios suspendidos no pueden iniciar sesión ni usar JWT vigente; el estado se consulta en cada autenticación protegida.
- Perfil sin edición de créditos, roles, identidad ni hashes. El usuario se identifica a partir del JWT verificado.

Los servicios se verifican con mocks. Estas reglas no se declaran aplicadas a PostgreSQL hasta implementar y probar el adaptador.

## Reglas reservadas para siguientes fases

- Un estudiante no puede solicitar un intercambio consigo mismo.
- Solo se pueden ofrecer habilidades registradas para ese estudiante.
- Inicio de intervalo estrictamente anterior al fin.
- No permitir reservas activas superpuestas para ninguno de los participantes.
- Créditos disponibles = saldo - creditos_retenidos.
- No comprometer créditos superiores a los disponibles.
- Retener, liberar y transferir con control de concurrencia y registro coherente de movimientos.
- Una confirmación repetida no produce una transferencia adicional.
- Descuento, abono, transferencia y movimientos deben ser atómicos.
- Una cancelación válida libera la retención exactamente una vez.
- Una reserva completada no puede volver a completarse.
- Cada participante requiere autorización sobre su operación.
- Auditoría sin contraseñas, tokens, hashes ni secretos.

Ninguna de estas reglas posteriores se implementa en esta etapa.

## Políticas por confirmar con el PO

Saldo inicial y origen de esos créditos; unidad y precisión decimal; equivalencia tiempo/crédito y redondeo; duración mínima/máxima; penalizaciones; plazos de confirmación y cancelación; efectos de suspensión en reservas activas; modalidades; zona horaria de almacenamiento y presentación.

No se implementan penalizaciones, mínimos de sesión ni créditos iniciales hasta aprobación. Los estados concretos y transiciones dependen del diseño oficial de BD y del contrato de APIs.
