# Fuentes y decisiones del esquema optimizado

Fecha: 22 de octubre de 2026.

El usuario eligió expresamente las **12 tablas optimizadas** de
`documentaci_n_de_la_base_de_datos.md` como estructura objetivo. El esquema
Prisma reproduce todas las columnas y tipos de su diagrama, junto con las
relaciones y restricciones únicas descritas en el texto. No se introspeccionó,
migró ni modificó una base de datos durante esta preparación.

## Por qué no se utilizó el SQL original como estructura objetivo

`sis-226_timebank/sis-226_timebank/base de datos v0.31.sql` y su archivo JSON
describen **18 tablas**, anteriores a la optimización. No son un DDL de las 12
tablas elegidas. Las diferencias se resuelven así:

| Modelo de 18 tablas             | Modelo objetivo de 12 tablas                              |
| ------------------------------- | --------------------------------------------------------- |
| `ROLES`, `USUARIO_ROLES`        | `USUARIOS.rol`, una cadena por usuario                    |
| `CUENTAS_CREDITO`               | `USUARIOS.saldo` y `USUARIOS.creditos_retenidos`          |
| `CONFIRMACIONES`                | Fechas de confirmación de cada participante en `RESERVAS` |
| `CANCELACIONES`                 | Autor, motivo y horas de anticipación en `RESERVAS`       |
| `TRANSFERENCIAS_CREDITO`        | Libro mayor `MOVIMIENTOS_CREDITO`                         |
| `MOVIMIENTOS_CREDITO.id_cuenta` | `MOVIMIENTOS_CREDITO.id_usuario`                          |

Los archivos fuente permanecen intactos como material de referencia. No deben
ejecutarse como si fueran scripts compatibles con el nuevo contrato.

## Detalles explícitos del contrato Prisma

- Nombres físicos exactos: tablas en mayúsculas mediante `@@map` y columnas en
  `snake_case`. Las relaciones distinguen solicitante, ofertante, autor de la
  cancelación, evaluador y evaluado.
- Identificadores y referencias `uuid`; fechas `timestamptz(6)`; créditos y
  saldos `int`; auditoría `jsonb`. No se añadieron tablas de apoyo ni enums SQL.
- Una solicitud origina como máximo una reserva (`id_solicitud` único y
  nullable). Cada usuario puede evaluar una reserva una sola vez. El vínculo
  usuario/habilidad conserva su clave primaria compuesta.
- Los campos `created_at`, `respondida_at`, `completed_at` y `cancelled_at`
  presentes en el diagrama se incluyen aunque la descripción abreviada de
  algunas tablas no los enumere.
- `id_carrera` y `semestre` son opcionales para conservar registro y perfil
  incompletos; una carrera presente sigue siendo una referencia UUID. El
  documento no especifica de forma exhaustiva los `NOT NULL`. Los datos de
  identidad y credenciales, participantes, habilidad, fechas y cantidades son
  obligatorios en el contrato nuevo.
- Las fechas de último acceso, respuesta, confirmaciones, fin y cancelación,
  así como autor y datos de cancelación, permiten `NULL` mientras no ocurra el
  evento. Reserva de origen y reserva del movimiento son opcionales según la
  documentación. Comentario, descripción, IP y snapshots JSON ausentes también
  permiten `NULL`; la auditoría admite acciones sin usuario identificado.
- Defaults explícitos: saldos y retenciones `0`, notificación `leida=false`,
  creación `now()`. Las PK usan `uuid()` generado por Prisma; esto no equivale a
  instalar `gen_random_uuid()` como default en PostgreSQL. El SQL legado no
  proporciona defaults para sus PK.
- Se declaran índices para consultas por usuario, estado, fechas y relaciones.
  Declararlos en el archivo no crea índices en una base existente.
- Se preserva el historial con relaciones `onDelete: Restrict`. Eliminar un
  usuario o catálogo referenciado exige resolver su historial; no hay borrado
  en cascada de créditos o reservas.

La documentación alterna etiquetas con mayúscula inicial y el SQL legado usa
minúsculas. El esquema conserva los tipos `varchar`; las normalizaciones de
roles, estados y niveles pertenecen a los adaptadores del backend. El archivo
Prisma no instala restricciones de intervalos, `CHECK`, triggers ni mecanismos
de exclusión de reservas. Sus relaciones y restricciones únicas no sustituyen
las transacciones y verificaciones de concurrencia de la aplicación.

## Problemas concretos en los scripts auxiliares recibidos

Estos hallazgos son de lectura estática de los archivos; no se ejecutaron:

1. `recomendaciones_adicionales.sql` y `vistas_bd.sql` dependen de las tablas
   eliminadas (`CUENTAS_CREDITO`, roles, transferencias y confirmaciones). Las
   rutinas financieras usan `id_cuenta`; se deben rediseñar para `id_usuario`
   antes de poder utilizarlas con las 12 tablas.
2. El trigger genérico `trf_auditar_cambio_estado` accede a `NEW.id_usuario`,
   `NEW.id_solicitud` y `NEW.id_reserva` en una misma función. No todas esas
   columnas existen en los registros de solicitudes y reservas: `COALESCE` no
   evita el error de un campo inexistente. Debe usar datos específicos por
   entidad o extracción explícita de JSON.
3. Las rutinas `transferir_creditos`, `retener_creditos` y
   `liberar_creditos_retenidos` consultan saldo sin `FOR UPDATE` antes de
   validar y escribir. Otra transacción puede cambiarlo entre ambos pasos.
   Tampoco todas las operaciones validan cantidades positivas, crédito
   disponible descontando retenciones o existencia de ambas cuentas. Los
   snapshots del libro mayor pueden quedar desfasados en concurrencia.
4. El DDL principal contiene comentarios que mencionan `CHECK`; un comentario
   no impone la restricción. Algunas restricciones reales aparecen en el
   script adicional, todavía sobre el esquema anterior.
5. `encriptacion_bd.sql` referencia `CANCELACIONES`, ya eliminada; incorpora una
   clave fija de ejemplo en una función y crea columnas cifradas paralelas.
   Sus triggers solamente actualizan el cifrado cuando la columna cifrada es
   `NULL`, por lo que editar un dato que ya estaba cifrado conserva su copia
   anterior. No constituye una migración de cifrado lista para instalar.
6. `v_reservas_usuario` hace `CROSS JOIN` con usuarios y puede devolver más de
   una fila por reserva. Para el backend es preferible filtrar directamente
   por el participante autenticado y evitar esa expansión de resultados.

## Validación sin acceso a PostgreSQL

La prueba `src/infrastructure/prisma/schema-contract.spec.ts` compara las 12
tablas y todas sus columnas/tipos contra el Mermaid de la documentación, impide
reintroducir las seis tablas retiradas y revisa las claves compuestas relevantes.
`prisma validate` comprueba el contrato y `prisma generate` construye el cliente
local; ninguna de esas operaciones aplica el esquema a PostgreSQL. Una conexión
real y la migración de datos legados requieren un trabajo posterior verificable
sobre una instancia identificada y respaldada.
