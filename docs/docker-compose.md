# Ejecución local con Docker Compose



Esta guia explica como ejecutar el sistema Timebank localmente desde la raiz del repositorio.



## 1. Requisitos previos



- Docker Desktop instalado y en ejecución.

- Git instalado.

- Puertos disponibles: `5173` para el frontend, `4000` para el backend y `55432` para PostgreSQL.



## 2. Configurar las variables de entorno



Crear el archivo `.env` a partir de la plantilla:



```powershell

Copy-Item .env.example .env

```



Editar el archivo `.env` y configurar valores locales seguros para `POSTGRES_PASSWORD` y `JWT_SECRET`.



**Importante:** no publicar el archivo `.env` ni subir contraseñas o secretos reales al repositorio.



## 3. Validar y ejecutar los servicios



Validar la configuración de Docker Compose:



```powershell

docker compose config --quiet

```



Construir las imágenes y ejecutar los servicios en segundo plano:



```powershell

docker compose up --build -d

```



Docker Compose administra PostgreSQL, la inicialización de la base de datos, el backend y el frontend. El servicio `db-init` espera a que PostgreSQL esté saludable antes de ejecutar la inicialización de la base de datos.



## 4. Comprobar el funcionamiento



Consultar el estado de los contenedores:



```powershell

docker compose ps

```



Consultar los registros de los servicios:



```powershell

docker compose logs --tail 100

```



Comprobar el estado del backend:



```powershell

Invoke-RestMethod http://localhost:4000/health/ready

```



La respuesta esperada debe indicar que el servicio está disponible y que utiliza PostgreSQL como sistema de persistencia.



Abrir el frontend en el navegador:



- **Frontend:** http://localhost:5173

- **Backend:** http://localhost:4000

- **PostgreSQL:** `localhost:55432`



## 5. Problemas frecuentes



### Docker Desktop no está iniciado



Abrir Docker Desktop, esperar a que esté listo y volver a ejecutar los comandos.



### Falta el archivo `.env`



Crear el archivo `.env` a partir de `.env.example` y configurar las variables requeridas.



### Un puerto está ocupado



Cambiar la variable correspondiente en `.env`: `FRONTEND_PORT`, `BACKEND_PORT` o `POSTGRES_PORT`. Después, volver a ejecutar los servicios.



### El backend no está saludable



Consultar los registros de PostgreSQL, la inicialización y el backend:



```powershell

docker compose logs --tail 100 postgres db-init backend

```



Comprobar el estado de PostgreSQL y verificar que el servicio `db-init` haya terminado correctamente.



### El frontend no se construye o no carga



Consultar los registros y reconstruir la imagen del frontend:



```powershell

docker compose logs --tail 100 frontend

docker compose build frontend

```



Verificar que estén presentes los archivos y las dependencias necesarios para construir el frontend.



## 6. Detener los servicios



Detener los contenedores sin eliminar el volumen de datos:



```powershell

docker compose down

```



**Importante:** no utilizar `docker compose down -v` si se desean conservar los datos locales de PostgreSQL, ya que este comando elimina también los volúmenes asociados.



## 7. Consideraciones finales



- El archivo `.env` contiene configuración local y no debe publicarse.

- El archivo `.env.example` debe contener únicamente valores de ejemplo, nunca secretos reales.

- Los datos de PostgreSQL se guardan en el volumen `postgres_data`.

- Si se modifican archivos necesarios para construir una imagen, reconstruir los servicios afectados antes de probarlos nuevamente.
