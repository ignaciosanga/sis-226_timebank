# Integración Backend + SkillSwap BD v4 — 22/11/2026

Esta guía sustituye los pendientes de HU-06/HU-08 del 21/11. La entrega v4 de BD aporta reglas y SQL; no aporta un historial Prisma Migrate unificado. El backend integra esos objetos mediante `db:prepare:skillswap`, sin alterar las seis migraciones heredadas ni marcar migraciones como ejecutadas artificialmente.

## Compatibilidad y reglas entregadas

Node >=26.8.2 <27 (verificado 26.13.1), npm 11.20.0, NestJS 11.2.7, TypeScript 5.9, Prisma 7.10.1, PostgreSQL 16.15. No se añadieron dependencias.

| Regla v4 | Valor inicial y comportamiento |
| --- | --- |
| Unidad SQL | INTEGER en décimas: 25 = 2,5 créditos. La API devuelve texto exacto `"2.5"`. |
| Base | 1 crédito por clase; no depende de duración. |
| Escasez | Suma 1,5 cuando hay menos de tres tutores estudiantes activos para la materia. |
| Demanda | Suma 1,3 si la hora de inicio en America/La_Paz está entre 18 y 21 inclusive. |
| Impacto | Suma 1,2 cuando el promedio global del tutor supera 4,5. |
| Snapshot | Se calcula al solicitar; aceptar y liquidar usan el importe guardado aunque cambie configuración. |
| Cancelación tardía | Anticipación estrictamente menor a cinco horas: 0,5 al actor que cancela, según trigger de BD. |
| Saldo insuficiente | Sin descuento parcial: movimiento cero `penalizacion_sin_saldo` y deuda pendiente. |
| Cobro posterior | Al aumentar saldo libre, BD cobra deudas completas en orden FIFO. No cobra dos veces. |
| Knowledge Score | 0,5 × clases completadas + 1,5 × promedio. Sin opiniones: promedio público `null`, componente de puntuación cero. |

Los valores se leen de `config_economia`; los nombres `mult_*` del SQL representan **sumandos**, no multiplicadores. La puntuación del endpoint de reputación se calcula por tutor/materia; la vista de BD conserva su alcance global. No se añade una resta por cancelaciones que el SQL entregado no define. Se informa por separado su conteo registrado. `costoCreditos` continúa siendo obligatorio en el DTO de ofertas para compatibilidad, pero en v4 el servidor calcula el importe efectivo; no permite fijar un precio arbitrario desde el navegador. `modelo_precio` identifica este contrato.

El backend conserva soporte para INTEGER legado y NUMERIC provisional. Sólo reconoce décimas cuando existen configuración económica y tabla de deudas v4. No convertir una base existente multiplicando saldos sin comprobar primero su unidad. Los límites SQL INTEGER se verifican antes de escribir. OFERTAS conserva NUMERIC en créditos reales, no décimas.

## Conectar a la entrega Docker del equipo

1. Usar la entrega **v4** suministrada por BD, con sus claves privadas. Mantener volúmenes y claves existentes; no ejecutar `down -v`. v3 no incluye el contrato de deudas necesario para esta integración.
2. En la carpeta del backend, instalar con `npm.cmd ci` y configurar `.env` (ignorado por Git). `DATABASE_URL` debe apuntar al puerto publicado por ese Docker. El backend requiere `DATABASE_ENABLED=true`, `PERSISTENCE_MODE=prisma`, JWT y correo SMTP configurados para registro real. Para correo local puede usarse el Mailpit ya documentado en el README.
3. Configurar `APP_ENCRYPTION_KEY` y `APP_HASH_PEPPER` con **las mismas claves** de BD, no valores nuevos para una base ya cifrada. Se configuran en cada conexión del pool. No compartir el `.env` ni pegarlo en Issues.
4. Con la API detenida, usar temporalmente una conexión del propietario de la base para instalar el complemento:

```powershell
$env:SKILLSWAP_PREPARE_APPROVED = 'true'
$env:SKILLSWAP_FRESH = 'false'
npm.cmd run db:prepare:skillswap
Remove-Item Env:SKILLSWAP_PREPARE_APPROVED
Remove-Item Env:SKILLSWAP_FRESH
npm.cmd run prisma:generate
npm.cmd run build
```

5. Volver a `DATABASE_URL` con el usuario de aplicación de BD (`rol_app`), conservar las claves y ejecutar `npm.cmd start`. Comprobar `/health/ready` y `/docs`. No ejecutar `db:init`, `db:migrate` ni `db push` sobre esta base v4: esos comandos pertenecen al esquema legado.

El comando agrega verificación institucional/ofertas si faltan, la relación solicitud-oferta, las cinco tablas académicas, carga el pensum de forma idempotente e instala el puente de auditoría/permisos. No crea usuarios de prueba ni regala saldo. La semilla preserva UUID existentes y aborta ante equivalencias ambiguas. `schema.prisma` incluye configuración y deudas; los triggers, vistas y columnas cifradas adicionales pertenecen al SQL de BD y no se deben eliminar mediante sincronización automática de esquema.

Para una base **vacía y aislada**, `SKILLSWAP_FRESH=true` instala también los SQL originales de v4. Rechaza una base que ya contiene USUARIOS. Esa opción no importa contraseñas del ZIP ni aprovisiona cuentas de aplicación: en la entrega Docker se usan sus roles; en una instalación propia el administrador debe aprovisionarlos antes del puente. Nunca emplear `fresh` como actualización de v3.

El Compose legado del repositorio conserva `db:init`; no es el comando de arranque de v4. Con la BD Docker v4 se ejecuta la API como indica esta guía. No se ha desplegado una base compartida ni Neon como parte de esta entrega.

## Auditoría, privacidad y reintentos

BD cifra los JSON de AUDITORIA y los deja nulos en las columnas claras. El adaptador lee `v_auditoria_desencriptada` para recuperar metadatos y reintentos. `fn_backend_audit` permite insertar únicamente acciones del backend y actualizar exclusivamente `BACKEND_METADATA` de la misma entidad. `rol_app` no recibe INSERT/UPDATE/DELETE directos en AUDITORIA; el historial normal lo generan los triggers de BD. Los movimientos son de sólo inserción y las deudas de sólo lectura para la aplicación. El backend no duplica penalizaciones ni cobros de los triggers.

Después de persistir una operación, se consulta el saldo real afectado por triggers y se guarda esa respuesta para sus reintentos. Las claves de idempotencia siguen siendo por usuario/operación/contenido, dentro de la misma transacción. `GET /credits/penalties/me` sólo expone deudas del usuario autenticado, importes exactos, estado y fechas. Los indicadores requieren ADMIN.

Las columnas personales claras originales siguen existiendo en la entrega de BD: no se afirma cifrado completo en reposo.

## Verificación reproducible

```powershell
npm.cmd run prisma:validate
npm.cmd run build
npm.cmd test -- --silent
npm.cmd run test:e2e -- --silent
npm.cmd run lint
# URL privada de un servidor AISLADO con permiso CREATE DATABASE/ROLE:
$env:TEST_DATABASE_URL = '<URL privada del servidor de pruebas>'
npm.cmd run test:skillswap
npm.cmd run test:postgres
Remove-Item Env:TEST_DATABASE_URL
```

`test:skillswap` crea una base de nombre aleatorio, aplica v4/puente dos veces, ejecuta las pruebas SQL 12/13/14 del proveedor y prueba la API con un usuario restringido heredero de `rol_app`. Comprueba registro/verificación/login, ruta concurrente por cuenta, precios SQL/API, cambios de tarifa, snapshots, retención/liquidación, reseñas, penalización inmediata, cancelación oportuna, deuda/cobro sin parcial, integridad e indicadores, y persistencia/replay tras reconectar. El correo se captura en la prueba; no certifica entrega SMTP externa. El reloj simulado sólo sirve para completar el fixture, y se restaura al terminar. Elimina exclusivamente su base y usuario aleatorios. Los roles sin login `rol_app`/`rol_lectura` se crean si faltan en ese servidor aislado.

`test:postgres` verifica separadamente el flujo heredado en otra base temporal. Esto evita confundir compatibilidad histórica con integración v4. No se probaron pantallas de Frontend, OAuth de proveedores externos ni despliegue en Neon. Esas integraciones siguen siendo responsabilidad del equipo correspondiente.

## Procedencia y recuperación

Los SQL bajo `prisma/vendor/skillswap-v4` son copia de la entrega `skillswap-docker-v4-penalizaciones_c.zip`, sin sus `.env`. El complemento propio está en `prisma/proposals/skillswap-backend-bridge.sql`; la propuesta académica previa se reutiliza sin cambiar las seis migraciones del núcleo. Antes de usar una base compartida, el responsable de BD debe respaldarla y consolidar el historial de migraciones. No hay un downgrade automático de saldos ni una eliminación de tablas deudas: la recuperación de una actualización fallida se hace con el respaldo verificado por BD.
