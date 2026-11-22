# Procedencia de SQL

Copia sin modificaciones de los archivos indicados de la entrega de Base de Datos `skillswap-docker-v4-penalizaciones_c.zip`.

SHA-256 del ZIP recibido: `eaa6b99435fea8025612c180994086ae73c03fb0a4382b02b4baa28dab9f009a`.

Autoría: equipo de Base de Datos. Kevin integra y prueba estos contratos en Backend; no se atribuye su diseño original. No se copiaron `.env`, contraseñas, respaldos ni volúmenes. Las claves que aparecen en 12/14 son fixtures públicos de pruebas revertidas, no credenciales de despliegue.

`prepare-skillswap.cjs` aplica los módulos seleccionados exclusivamente con preparación explícita. El archivo 05 es la plantilla original de roles de BD: el comando no la ejecuta ni cambia sus contraseñas. La prueba aislada reutiliza sólo sus permisos con cuentas aleatorias. El complemento propio se mantiene separado en `prisma/proposals/skillswap-backend-bridge.sql`.

Consultar `docs/skillswap-v4-integration.md` desde la raíz del backend. No ejecutar estos scripts sobre v3 o una base poblada sin revisar unidades, historial, respaldo y permisos con BD.
