# Actualización de PostgreSQL y Docker

Fecha: 22 de octubre de 2026. Complementa el reporte v0.4; sus límites de PostgreSQL pendiente corresponden a la entrega anterior.

## Cambios

- Compose incorpora PostgreSQL 16.15, volumen persistente, puerto local 55432, inicialización de ejecución única y backend en modo Prisma. La API espera a que la BD esté disponible y la inicialización termine correctamente.
- Dos migraciones crean las 12 tablas de negocio y sus claves, relaciones, índices y restricciones de saldos, retenciones, intervalos, participantes, semestre y puntuaciones. Prisma añade su tabla técnica `_prisma_migrations`. No se aplica el modelo legado de 18 tablas.
- Semilla repetible de desarrollo: una carrera, cuatro categorías y cinco habilidades, sin usuarios ni saldos. Solo el inicializador local activa la semilla automáticamente.
- Dockerfile genera Prisma con el esquema disponible durante la instalación, compila y conserva dependencias y binarios nativos de ejecución. Incluye OpenSSL y certificados para Prisma.
- `setup:docker` genera credenciales locales, conserva secretos existentes y configura la URL publicada cuando no existía otra. Compose usa su propia URL interna. `.env` y los scripts legados no se copian a la imagen.
- `/health/ready` comprueba conexión y presencia de las tablas; responde 503 si fallan. `/health` conserva el estado del proceso.
- Comando para crear ADMIN local persistente con contraseña aleatoria y guía del frontend con URL, CORS, JWT, rutas, estados, importes y reintentos.

## Verificaciones anteriores a la instrucción de detener pruebas

Aprobaron 157 pruebas unitarias en 17 suites y 132 HTTP en 5 suites. Compilación, ESLint y validación de Prisma también aprobaron en ese punto.

Se ejecutó un escenario real sobre PostgreSQL en Docker, en una BD temporal independiente que se eliminó al finalizar: migraciones y semilla repetibles, registro/login, dos instancias de la API, carga concurrente idempotente, competencia por disponibilidad con una sola aceptación, rechazo de reutilización de clave con otro contenido, rollback, liquidación única con confirmaciones concurrentes, conservación de saldo e idempotencia después de reiniciar y auditoría íntegra.

El usuario pidió detener las pruebas y publicar. No se ejecutaron nuevas pruebas después. La construcción completa de Docker se detuvo durante la descarga de la imagen Node; los ajustes finales y el despliegue completo quedan sin nueva verificación. PostgreSQL local se inició en 55432; no se modificó una BD compartida ni se reemplazó la instancia anterior en memoria que ocupaba 4000.

## Arranque y límites

Consultar [README](../README.md) y [guía del frontend](frontend-integration.md). Detener la instancia anterior para usar 4000 o cambiar `BACKEND_PORT`.

Las transacciones y el bloqueo asesor coordinan instancias de este backend. Escritores externos que no respeten el protocolo necesitan medidas adicionales. El adaptador carga snapshots y requiere optimización antes de manejar grandes volúmenes. Notificaciones, calificaciones, recuperación de contraseña y búsqueda global de ofertantes no tienen endpoints en esta entrega. Compose configura un entorno local de desarrollo.
