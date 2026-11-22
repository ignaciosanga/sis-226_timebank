# Verificación real — 22/11/2026

Responsable del aporte: Kevin Tapia Ali. Base del núcleo: `8fe275b`; continuación previa: `4bd465d`. Este registro sustituye los pendientes técnicos de integración local del 21/11; no afirma que Neon ni las pantallas del frontend estén desplegados.

| Comprobación ejecutada | Resultado |
| --- | --- |
| Prisma generate / validate | Cliente 7.10.1 generado; esquema válido, incluyendo configuración y deudas de BD v4. |
| Build TypeScript | Correcto. |
| ESLint `--max-warnings=0` | Correcto, sin avisos. |
| Unitarias | 264 casos únicos en 29 suites. La comparación del esquema inicialmente detectó las dos tablas nuevas; se actualizó el contrato y se reejecutaron sus tres casos, todos correctos. Las otras 28 suites habían pasado. |
| HTTP E2E | 188 casos, 10 suites, todos correctos. Incluyen respuestas de error esperadas; el 503 de académico en memoria es deliberado. |
| PostgreSQL legado | Comando `scripts/test-postgres.cjs` finalizado con código 0: migraciones/semillas repetibles, dos instancias, idempotencia, rollback, registro institucional, ofertas, solicitudes y liquidación. Incluye fixtures NUMERIC provisionales separados. |
| PostgreSQL SkillSwap v4 | Comando `scripts/test-skillswap.cjs` finalizado con código 0 usando permisos de aplicación, claves propias y base temporal. |
| SQL suministrado por BD | Archivos 12 (economía/match), 13 (vistas BI) y 14 (deudas/cobro/ETL) ejecutados sin excepción dentro de la prueba v4. |
| Integridad de créditos v4 | `GET /exchanges/integrity` devuelve `status: ok` después de liquidación, cancelación y cobro de deuda. |

## Flujos v4 comprobados

- Preparación repetida del puente y semilla: 49 materias publicables más MAT-030, sin duplicación.
- Registro, verificación de correo capturado, login y permisos JWT. ADMIN controla indicadores; estudiantes no pueden consultar datos privados de otra cuenta.
- Mi ruta: escrituras simultáneas en materias distintas, aislamiento entre cuentas, eliminación pending y restricciones del requisito externo/códigos inexistentes.
- Precio API coincide con `fn_calcular_costo_clase`. El importe 30,5 se almacena como 305, y los endpoints devuelven `"30.5"`.
- Cambio de costo base después de solicitar: aceptación conserva el snapshot original, con y sin oferta.
- Doble confirmación, una liquidación, opinión única y reintento. Score 8 para una clase con opinión 5 y promedio 5.
- Cancelación tardía con saldo: descuento de 0,5; cancelación con más de cinco horas: sin descuento.
- Cancelación tardía sin saldo: deuda pendiente, replay sin duplicación y nueva clave rechazada con 409.
- Saldo de 0,3 no se descuenta parcialmente. Al ingresar 0,7, se cobra 0,5 de deuda y quedan 0,5. La respuesta y el saldo persistido coinciden.
- La auditoría mantiene JSON claros nulos y reintentos recuperables desde la vista descifrada. Se comprueba reapertura de la aplicación y recuperación de ruta, saldo y respuesta idempotente.
- Mis clases presenta crédito exacto; consultas académicas, reputación, economía, overview y créditos responden correctamente.

## Entorno y límites

Windows/PowerShell, Node 26.13.1, npm 11.20.0, PostgreSQL 16.15-alpine en un contenedor aislado publicado sólo en loopback. Las bases de las pruebas tienen nombres aleatorios y se eliminan al terminar; no se borra ningún volumen existente ni se modifica PostgreSQL compartido. No se usan las contraseñas del ZIP.

Los errores iniciales de fixtures de reloj/horarios y la incompatibilidad de permisos de auditoría se corrigieron antes de la ejecución final satisfactoria. Se conserva la distinción entre código propio del backend y funciones originales de BD. Las seis migraciones anteriores permanecen sin cambios.

Falta validación conjunta de pantallas/flags de Frontend, tableros de Dashboards, correo/OAuth externos y despliegue en Neon. BD/APIs deben consolidar el historial Prisma antes de migrar una base compartida. Estas tareas no se presentan como realizadas por Kevin. La publicación de código en GitHub no ejecuta automáticamente el puente SQL en un servidor remoto.

Comandos e instrucciones reproducibles: [integración v4](skillswap-v4-integration.md).
