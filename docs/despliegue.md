# Despliegue

El sistema se publica con servicios gratuitos que no requieren tarjeta:

| Componente | Servicio | Plan |
|---|---|---|
| Base de datos PostgreSQL | Neon | Free: 0,5 GB, sin vencimiento |
| Backend NestJS | Render, Web Service con Docker | Free |
| Frontend Vue | Render, Static Site | Free |

La configuración de Render está en `render.yaml`, en la raíz del repositorio.

## Limitaciones del plan gratuito

- El backend se suspende tras 15 minutos sin tráfico y tarda cerca de un minuto en despertar. Antes de una demostración, abrir `/health/ready` y esperar la respuesta.
- La base de datos de Neon se suspende cuando no se usa; la primera consulta después de una pausa es más lenta.
- El plan gratuito de Render no ejecuta comandos previos al despliegue, por lo que las migraciones y los catálogos se aplican desde una computadora del equipo (paso 2).

## 1. Crear la base de datos en Neon

1. Crear una cuenta en https://neon.com y un proyecto llamado `timebank`.
2. Copiar la cadena de conexión directa (sin `-pooler` en el host). Tiene la forma `postgresql://usuario:clave@host/neondb?sslmode=require`.

## 2. Aplicar migraciones y catálogos

Desde la carpeta `backend/`, con Node instalado y `npm ci` ejecutado:

```powershell
$env:DATABASE_URL="CADENA_DE_NEON"
npx prisma migrate deploy
$env:LOCAL_DEVELOPMENT_SEED="true"
node scripts/seed-local.cjs
```

Para crear un administrador:

```powershell
node scripts/create-dev-admin.cjs admin@ucb.edu.bo
```

El comando muestra una contraseña aleatoria una sola vez.

## 3. Publicar en Render

1. Crear una cuenta en https://render.com con la cuenta de GitHub dueña del repositorio.
2. New > Blueprint, elegir el repositorio y la rama `main`.
3. Completar las variables que Render solicita:
   - `DATABASE_URL`: la cadena de Neon.
   - `CORS_ORIGINS`: la URL del frontend, por ejemplo `https://timebank-frontend.onrender.com`, sin barra final.
   - `VITE_API_URL`: la URL del backend, por ejemplo `https://timebank-backend.onrender.com`, sin barra final.
4. Si Render asigna URLs distintas a las previstas, corregir `CORS_ORIGINS` y `VITE_API_URL` en Environment y volver a desplegar ambos servicios.

## 4. Verificar

- `https://<backend>/health/ready` responde `{"status":"ok","persistence":"postgresql"}`.
- `https://<backend>/docs` muestra Swagger.
- El frontend carga en `https://<frontend>`.
