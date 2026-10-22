# Pendientes y dependencias

## Equipo de BD — bloquea persistencia real

No se encontró SQL, DBML, .env previo ni DATABASE_URL configurada. No se efectuó introspección ni se generó un cliente contra las tablas oficiales. No se aplicaron migraciones ni se ejecutaron consultas a una BD compartida.

Se necesita:

- SQL/DBML definitivo y acceso autorizado de desarrollo; confirmar esquema y uso de identificadores en mayúsculas.
- Tipos, nulabilidad, PK/FK, secuencias, defaults, catálogos, índices y nombres exactos.
- Estados oficiales de USUARIOS y su equivalencia con active.
- Catálogo de ROLES y cómo se vinculan ESTUDIANTE/ADMIN.
- Unicidad de correo con la normalización acordada; tratar correctamente la carrera de registros simultáneos.
- Precisión/unidad de saldo y creditos_retenidos; restricciones de cuentas por usuario.
- Implementar USERS_REPOSITORY con el cliente introspectado y una transacción usuario–rol–cuenta. Probar rollback y duplicados contra una BD aislada autorizada.
- Actualización de ultimo_acceso y perfil condicionada al estado activo en la escritura.

Inventario recibido: CARRERAS, CATEGORIAS, USUARIOS, ROLES, USUARIO_ROLES, HABILIDADES, USUARIO_HABILIDADES, DISPONIBILIDADES, SOLICITUDES_INTERCAMBIO, RESERVAS, CONFIRMACIONES, CANCELACIONES, CUENTAS_CREDITO, MOVIMIENTOS_CREDITO, TRANSFERENCIAS_CREDITO, CALIFICACIONES, NOTIFICACIONES y AUDITORIA. No se infieren modelos a partir de sus nombres.

## PO — bloquea registro

Confirmar saldo inicial mediante una política explícita. REGISTRATION_POLICY.initialCredits permanece null. Valores usados en mocks son datos de prueba y no configuran una política.

Ver más reglas pendientes en business-rules.md.

## Equipo de APIs y Frontend

Revisar y aprobar el contrato previsto: nombres de campos, IDs opacos, límites de entrada, normalización de correo, errores, estado de usuario y edición de perfil. Definir orígenes CORS reales de desarrollo. Después de integrar BD, agregar controladores finos y sus decoradores Swagger, con guards y límites más estrictos de autenticación.

No se implementa API Gateway ni Frontend.

## Entorno

Docker CLI y Compose están presentes; el motor no está activo. No se pudo verificar una imagen ni ejecutar contenedores. Los archivos no arrancan otra BD ni importan datos.

La base de seguridad usa rate limiting en memoria. Para varias instancias futuras se necesitará almacenamiento compartido y política de proxies. Refresh tokens, recuperación de contraseña, verificación de correo y administración de roles quedan fuera de esta primera etapa.

## Próxima etapa recomendada

Completar Users/Auth sobre el esquema oficial y su política inicial. Publicar sus endpoints solo tras pruebas de integración reales. Luego continuar con Skills y Availability antes de intercambios, reservas, confirmaciones y créditos.
