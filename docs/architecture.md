# Arquitectura del backend — 22/11/2026

Monolito NestJS con DTO, guards JWT/roles, servicios de aplicación y repositorios. Conserva los módulos del núcleo transaccional y añade currículo, progreso académico, opiniones e indicadores. TypeScript 5.9, Prisma 7.10.1, PostgreSQL 16; versiones de ejecución en README.

## Persistencia y transacciones

`PERSISTENCE_MODE=prisma` selecciona el repositorio PostgreSQL compartido. Cada escritura de intercambio toma un bloqueo asesor transaccional, carga un snapshot, valida el cambio y persiste sus efectos atómicamente. Los reintentos conservan usuario, operación y huella de contenido. La memoria sirve para pruebas y no certifica persistencia; las consultas académicas que necesitan SQL devuelven 503 en ese modo.

Las declaraciones de Mi ruta usan transacciones y bloqueo por usuario: dos materias distintas no sobrescriben el estado de otra. La semilla académica preserva UUID y falla ante equivalencias ambiguas. Los indicadores usan consultas parametrizadas y permisos ADMIN; el historial personal se filtra por identidad de sesión.

## Créditos y BD v4

Hay tres adaptaciones de almacenamiento: INTEGER legado en créditos enteros, NUMERIC provisional y SkillSwap v4 INTEGER en décimas. La detección se basa en columnas y objetos reales de BD. La API entrega strings exactos con hasta una décima; las conversiones usan BigInt y límites de INTEGER, no aritmética monetaria de coma flotante.

En v4, la oferta muestra el precio calculado con configuración, tutores activos, hora de La Paz y promedio del tutor. La solicitud conserva un snapshot; aceptación y doble confirmación no recalculan el precio. La aceptación crea reserva y retención; después del fin, ambas confirmaciones realizan una sola liquidación. Los conflictos de saldo y solapamientos revierten todos los efectos.

La cancelación guarda actor/motivo/fecha, libera retención y deja actuar al trigger de BD. Sólo BD aplica penalizaciones y cobra deudas pendientes. El adaptador vuelve a leer los saldos y la fecha de cancelación después de los triggers antes de guardar la respuesta idempotente. Así un reintento no repite un cobro ni muestra un saldo anterior al descuento.

## Auditoría y permisos

Prisma usa un pool pg con inicialización de las dos claves criptográficas en cada conexión. La configuración de claves es obligatoria para v4. El repositorio recupera metadatos desde la vista de auditoría descifrada, porque los JSON originales se guardan nulos por el trigger de cifrado.

El rol de aplicación conserva acceso de lectura a AUDITORIA y de inserción al libro de créditos. La función controlada `fn_backend_audit` permite acciones específicas del backend y sólo actualiza metadatos de la misma entidad. El resto de la auditoría lo generan los triggers originales. No se concede escritura directa sobre deudas ni acceso BI a datos personales desde la API.

## Instalación y límites

La API no ejecuta migraciones al abrir una conexión. `db:prepare:skillswap` instala explícitamente el complemento v4 y el catálogo; `db:init` corresponde únicamente al esquema legado. La guía v4 explica claves, permisos y recuperación. Los scripts originales de BD están separados de las extensiones del backend para conservar atribución y facilitar la consolidación de migraciones por BD/APIs.

La validación se realiza con PostgreSQL real aislado y llamadas HTTP; no implica despliegue de Neon ni pruebas visuales del frontend. El registro captura correo en tests, sin certificar SMTP externo. Consultar [la guía v4](skillswap-v4-integration.md) y [la evidencia](verification-2026-11-22.md).
