# INT-04: Unificación del esquema de base de datos

## Contexto

En el repositorio había dos versiones del mismo modelo de datos:

| Origen | Ubicación | Tablas | Uso |
|---|---|---|---|
| Equipo Base de Datos | `database/` | 12 tablas en minúsculas (`usuarios`, `reservas`…), encriptación y 32 vistas | Docker local del equipo de BD |
| Equipo Backend | `backend/prisma/migrations/` | 12 tablas en mayúsculas (`"USUARIOS"`, `"RESERVAS"`…) | Sistema desplegado en Render y Neon |

Las dos versiones tienen las mismas 12 tablas y las mismas columnas. Las diferencias son tres: el nombre de las tablas, los valores de los estados y la encriptación. Por eso las vistas del equipo de Base de Datos no se podían usar sobre la base real (Issue #10).

## Decisión

El esquema del backend es la única fuente de verdad, porque es el que usa el sistema desplegado. Las vistas del equipo de Base de Datos se adaptan a ese esquema mediante una migración de Prisma, para que se apliquen con el mismo comando que el resto de la base.

## Equivalencias

| Concepto | `database/` | Backend |
|---|---|---|
| Tablas | `usuarios`, `solicitudes_intercambio`… | `"USUARIOS"`, `"SOLICITUDES_INTERCAMBIO"`… |
| Usuario activo | `activo` | `Activo` |
| Rol | `usuario` | `Estudiante`, `Profesor`, `Administrador` |
| Solicitud pendiente | `pendiente` / `solicitada` | `Solicitada` |
| Solicitud aceptada | `aceptada` | `Aceptada` |
| Reserva vigente | `pendiente` / `confirmada` | `Confirmada` |
| Reserva completada | `completada` | `Completada` |
| Disponibilidad libre | `disponible` | `disponible` |
| Catálogos | `activo` | `activo` |

## Qué se integró

La migración `backend/prisma/migrations/20261025000000_vistas_reporte` crea las 32 vistas y las 4 funciones del equipo de Base de Datos, con los mismos nombres y columnas, sobre las tablas del backend. Hay cuatro diferencias con las originales:

1. `v_usuarios_completo` no incluye `password_hash`, para que las herramientas de reportes no puedan leer los hashes de las contraseñas.
2. `v_ranking_creditos` considera solo a estudiantes, sin las cuentas de administración.
3. `v_actividad_mensual` se calcula desde las fechas de creación de solicitudes, reservas y usuarios, en lugar de la auditoría, porque el backend no registra esos eventos en `AUDITORIA`.
4. Las funciones `fn_*` están escritas en SQL de solo lectura (`STABLE`). Conservan `SECURITY DEFINER` con `search_path` fijo, igual que las originales, para que el usuario de solo lectura pueda llamarlas.

## Qué no se integró

La encriptación (`encriptacion_bd_v2.sql`) queda fuera. Sus triggers necesitan que cada conexión cargue la clave con `set_config('app.encryption_key', …)`, y el backend no lo hace. Si se aplicara, fallarían el registro de usuarios, las notificaciones y la cancelación de reservas con motivo. Aplicarla exige un cambio coordinado entre Backend y Base de Datos, que queda como trabajo futuro.

## Cómo aplicarla en Neon

Desde la carpeta `backend`, con la cadena directa de Neon (sin `-pooler`):

```cmd
set "DATABASE_URL=CADENA_DIRECTA_DE_NEON"
npx prisma migrate deploy
```

La migración solo crea vistas y funciones. No modifica tablas ni datos.

## Acceso de solo lectura para Dashboards

Para Looker Studio o Power BI conviene un usuario que solo pueda leer las vistas. En el editor SQL de Neon:

```sql
CREATE ROLE dashboards_lectura LOGIN PASSWORD 'CONTRASEÑA_SEGURA';
GRANT CONNECT ON DATABASE neondb TO dashboards_lectura;
GRANT USAGE ON SCHEMA public TO dashboards_lectura;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO dashboards_lectura;
REVOKE SELECT ON "USUARIOS" FROM dashboards_lectura;
```

`ALL TABLES` incluye las vistas. El `REVOKE` evita que ese usuario lea la tabla de usuarios, que tiene los hashes de las contraseñas. Los datos de los usuarios se consultan con las vistas. La contraseña se comparte en privado con el equipo de Dashboards y nunca se sube al repositorio.

## Verificación

Se aplicaron las tres migraciones en orden sobre PostgreSQL 16, con datos de prueba que cubren todos los estados del backend. Las 32 vistas y las 4 funciones devolvieron los resultados esperados. También se probó el usuario de solo lectura: puede consultar las vistas y las funciones, pero no la tabla `USUARIOS` ni escribir en ninguna tabla. Por ejemplo, `v_estadisticas_generales` contó 3 usuarios activos, 1 solicitud pendiente, 1 reserva confirmada y 1 completada, igual que los datos cargados.
