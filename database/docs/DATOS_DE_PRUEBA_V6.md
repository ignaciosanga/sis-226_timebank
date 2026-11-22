# SkillSwap V6 - datos de prueba adicionales (solo para desarrollo / QA)

Este ZIP conserva **sin cambios** el esquema, el bootstrap, la economía, las penalizaciones,
los roles y los scripts de pruebas originales de la V6. Se agregan **solo tres archivos**:

- `04_datos_prueba_v6_extendidos.sql`: dataset ficticio adicional para tablas y flujos V6.
- `tests/20_verificar_datos_prueba_v6.sql`: verificaciones de solo lectura.
- `DATOS_DE_PRUEBA_V6.md`: esta guia de ejecución.

El archivo original `03_datos_demo_skillswap.sql` ya existía en el ZIP recibido.
No se ejecuta ningún seed automáticamente al levantar Docker.

## Paso 1. Iniciar la base en un entorno de prueba

Configura `.env` según `.env.example`, con claves de 32 caracteres o más.
En una base de pruebas **nueva**, ejecuta:

```bash
docker compose up -d db
```

Si ya tienes un volumen con datos importantes, **no uses `docker compose down -v`**.
Las tablas y funciones de esta V6 solo se inicializan al crear una base vacía.

## Paso 2. Cargar datos ficticios

Ejecutar desde la carpeta que contiene `docker-compose.yml`:

```bash
docker compose exec -T db psql -X -v ON_ERROR_STOP=1 -U skillswap_admin -d skillswap < 03_datos_demo_skillswap.sql
docker compose exec -T db psql -X -v ON_ERROR_STOP=1 -U skillswap_admin -d skillswap < 04_datos_prueba_v6_extendidos.sql
```

El segundo seed no hace cambios si ya estaba cargado. No modifica usuarios reales:
usa UUID reservados `90..99`, correos `@skillswap.test` y hashes inválidos
para que no puedan iniciar sesión. **No ejecutar en producción.**

## Paso 3. Verificar que cargó bien

```bash
docker compose exec -T db psql -X -v ON_ERROR_STOP=1 -U skillswap_admin -d skillswap < tests/20_verificar_datos_prueba_v6.sql
```

Resultados esperados **solo del seed adicional**:

| Datos | Cantidad / esperado |
|---|---|
| Usuarios ficticios | 4 |
| Categorías / habilidades | 2 / 3 (una sin tutor) |
| Ofertas de tutoría | 2 (3.7 y 2.5 créditos) |
| Solicitudes | 4 |
| Reservas | 6: 1 completada, 1 confirmada y 4 canceladas |
| Calificaciones / notificaciones | 2 / 3 |
| Penalizaciones pendientes | 2 (Pablo y Hugo) |
| Penalizaciones cobradas | 1 (Lucía, después de recibir pago) |
| Sofía | saldo 6.3, retenidos 2.5 |
| Lucía | saldo 3.2 (recibe 3.7 y paga multa 0.5) |

Las cancelaciones cubren casos con menos y más de 5 horas de anticipación.
Los valores de crédito son **créditos reales** (`NUMERIC(12,2)`), sin escala ×10.

## Qué NO se alteró

- No se cambió el bootstrap, triggers, tablas, índices, seguridad ni código de otros equipos.
- No se incluyeron scripts nuevos de seguridad contra SQL Injection.
- El seed es **opcional** y se carga manualmente en una base de pruebas.
- Las cuentas ficticias no pueden usarse para iniciar sesión; son para inspección
  de base de datos, vistas y API con identidades de prueba apropiadas.

## Validación pendiente

Se revisaron estáticamente los nombres de tablas, columnas y la lógica del seed.
**No se ha ejecutado este ZIP en Docker/PostgreSQL en el entorno de preparación**;
la comprobación real queda a cargo del equipo que lo instalará. Si falla,
`ON_ERROR_STOP=1` y `BEGIN/COMMIT` hacen que la segunda carga falle sin dejar
un dataset parcialmente insertado.

Nota: el seed original `03_datos_demo_skillswap.sql` incluye algunos comentarios
antiguos sobre la escala de créditos. La lógica SQL y las columnas de V6
utilizan créditos reales: **10.0 son diez créditos**, no un crédito.
