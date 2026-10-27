# Despliegue

## URLs públicas

| Componente | URL |
|---|---|
| Frontend | https://timebank-frontend.onrender.com |
| Backend | https://timebank-backend-51q9.onrender.com |
| Swagger | https://timebank-backend-51q9.onrender.com/docs |
| Estado del backend y la base | https://timebank-backend-51q9.onrender.com/health/ready |

## Servicios

| Componente | Servicio | Plan |
|---|---|---|
| Base de datos PostgreSQL 16 | Neon, proyecto `timebank`, región AWS São Paulo | Free: 0,5 GB, sin vencimiento |
| Backend NestJS | Render, Web Service con Docker, región Oregon | Free |
| Frontend Vue | Render, Static Site | Free |

La configuración de Render está en `render.yaml`, en la raíz del repositorio. Render vuelve a desplegar cada servicio cuando cambia su carpeta en `main`: el backend con cambios en `backend/` y el frontend con cambios en `frontend/`.

## Variables de entorno

| Servicio | Variable | Valor |
|---|---|---|
| Backend | `PERSISTENCE_MODE` | `prisma` |
| Backend | `DATABASE_ENABLED` | `true` |
| Backend | `DATABASE_URL` | Cadena directa de Neon (sin `-pooler`), terminada en `?sslmode=require`. Se carga solo en el panel de Render |
| Backend | `JWT_SECRET` | Generado por Render |
| Backend | `CORS_ORIGINS` | `https://timebank-frontend.onrender.com,http://localhost:5173` |
| Backend | `SWAGGER_ENABLED` | `true` |
| Frontend | `VITE_API_URL` | `https://timebank-backend-51q9.onrender.com` |

Las credenciales nunca se suben al repositorio.

## Limitaciones del plan gratuito

- El backend se suspende tras 15 minutos sin tráfico y tarda cerca de un minuto en despertar. Antes de una demostración, abrir `/health/ready` y esperar la respuesta.
- La base de Neon también se suspende sin uso; la primera consulta después de una pausa tarda unos segundos más.
- El plan gratuito de Render no ejecuta comandos previos al despliegue. Las migraciones y los catálogos se aplican desde una computadora del equipo (sección siguiente).

## Aplicar migraciones y catálogos

Desde `backend/`, con `npm ci` ejecutado. En cmd de Windows:

```cmd
set "DATABASE_URL=CADENA_DIRECTA_DE_NEON"
npx prisma migrate deploy
set "LOCAL_DEVELOPMENT_SEED=true"
node scripts/seed-local.cjs
```

En PowerShell se usa `$env:DATABASE_URL="..."` en lugar de `set`.

## Problemas resueltos durante el despliegue

| Problema | Causa | Solución |
|---|---|---|
| El build del backend fallaba con `lstat .../backend/backend: no such file or directory` | `rootDir: backend` se combinaba con rutas que ya incluían `backend/` | Se quitó `rootDir` y se usa `buildFilter` (PR #6) |
| `/health/ready` y todos los endpoints con base de datos respondían 503 | En Docker, `prisma generate` corre antes de copiar `tsconfig.json` y genera imports con extensión `.ts`; el cliente compilado no carga (`Cannot find module './internal/class.ts'`) | Se fijó `importFileExtension = ""` en el generador de `backend/prisma/schema.prisma` (PR #7) |
| El frontend publicado se veía en blanco | `frontend/vite.config.js` compila con la ruta base de GitHub Pages `/front_end_decisiones_gerenciales/` | El build de Render usa `npm run build -- --base=/` (PR #8) |

Para diagnosticar fallos del backend que no aparecen en Render, conviene construir la imagen desde un clon limpio del repositorio: una copia local puede incluir archivos generados en Windows que ocultan el problema.
