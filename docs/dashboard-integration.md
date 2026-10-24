# Integración Dashboard — Endpoints Analytics

Estadísticas agregadas de solo lectura sobre las 12 tablas del modelo optimizado. Requieren `PERSISTENCE_MODE=prisma` (PostgreSQL); en modo memoria responden 503.

## Autenticación

Todos los endpoints exigen `Authorization: Bearer <token>` obtenido en `POST /auth/login` con una cuenta `Administrador`. Respuestas: 200 datos, 400 parámetros inválidos, 401 sin sesión, 403 sin rol ADMIN, 503 persistencia no soportada. URL base: la del backend (`http://localhost:4000` en local; `CORS_ORIGINS` debe incluir el origen del dashboard).

## Parámetros comunes (query)

| Parámetro | Descripción |
|---|---|
| `from` | Inicio ISO-8601 con zona (`2026-10-01T00:00:00Z`), incluido. |
| `to` | Fin ISO-8601, excluido. Periodo `[from, to)`. |
| `groupBy` | `day` (defecto) o `month` para series temporales. |
| `limit` | 1–50 (defecto 10) para rankings de habilidades. |

Sin fechas se usan los últimos 30 días hasta el instante actual. `from` debe ser anterior a `to`.

## Endpoints

- `GET /analytics/overview`: `usuarios` (total/activos/inactivos/suspendidos, estado actual), `solicitudes.totalHistorico`, `intercambios` del periodo (completadas por `completed_at`, canceladas por `cancelled_at`, minutos/horas programados) y `creditos` (`transferidos` del periodo; `retenidosActuales` y `saldoTotalActual` son saldos vigentes).
- `GET /analytics/users`: `porEstado`, `porCarrera`, `nuevosEnPeriodo`, `registrosPorPeriodo` (serie por `fecha_registro`), `conHabilidadesPublicadas`. Solo agregados; sin correos ni datos personales.
- `GET /analytics/exchanges`: `solicitudes.estadoActual` (Solicitada/Aceptada/Rechazada/Cancelada), `reservas.estadoActual` (Confirmada/Completada/Cancelada), `creadasEnPeriodo`, `completadasEnPeriodo`, `canceladasEnPeriodo`, minutos/horas/créditos de completadas, `tasas` (finalización y cancelación en %, `null` si no hay reservas resueltas en el periodo) y `completadasPorPeriodo`.
- `GET /analytics/credits`: `transferidos`, `liberadosPorCancelacion`, `bonosIniciales`, `recompensas`, `ajustes`, `penalizaciones` (sumas del periodo), `retenidosActuales`, `saldoTotalActual`, `transferidosPorPeriodo` y `movimientosPorTipo` (conteo y suma por tipo).
- `GET /analytics/skills`: `totalActivas`, `ofrecidasPorEstudiantes`, `porCategoria`, `masSolicitadas`, `masCompletadas`, `completadasPorCategoria`, `estudiantesPorHabilidad`.

Ejemplo (`GET /analytics/overview?from=2026-10-01T00:00:00Z&to=2026-11-01T00:00:00Z`):

```json
{
  "periodo": { "from": "2026-10-01T00:00:00.000Z", "to": "2026-11-01T00:00:00.000Z" },
  "usuarios": { "total": 0, "activos": 0, "inactivos": 0, "suspendidos": 0 },
  "solicitudes": { "totalHistorico": 0 },
  "intercambios": { "completados": 0, "cancelados": 0, "minutosProgramados": 0, "horasProgramadas": 0 },
  "creditos": { "transferidos": "0", "retenidosActuales": "0", "saldoTotalActual": "0" }
}
```

Las series tienen la forma `[{ "periodo": "2026-10-05T00:00:00.000Z", "cantidad": 3, "creditos": "12" }]`; los rankings `[{ "id": "uuid", "nombre": "Cálculo I", "cantidad": 5 }]`. Una base vacía devuelve ceros, `"0"` y arreglos vacíos.

## Reglas de cálculo

- 1 crédito = 15 minutos; 1 hora = 4 créditos. Los créditos son enteros y se devuelven como strings.
- `transferidos` suma solo movimientos `Transferencia` (acreditación al ofertante). El `Consumo` del solicitante es el débito del mismo intercambio y no se suma, evitando duplicar.
- Bonos (`BonoInicial`, `Recompensa`) y ajustes se informan aparte y no se mezclan con transferencias.
- Una solicitud y su reserva se cuentan como un solo intercambio: los indicadores de intercambios usan RESERVAS.
- `estadoActual` refleja el estado presente de cada registro, no su estado en cada mes del periodo.
- Los minutos programados provienen de `fecha_fin - fecha_inicio` de reservas completadas; el sistema no registra asistencia real.
- Las estadísticas nunca modifican saldos ni movimientos.

## Limitaciones

Sin calificaciones suficientes no se publican indicadores de reputación. Las notificaciones y auditoría no se agregan. La verificación contra PostgreSQL real queda pendiente de ejecución por el equipo.
