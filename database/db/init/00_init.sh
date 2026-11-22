#!/usr/bin/env bash
# Orquestador único para la imagen oficial de PostgreSQL.
# Los SQL están en subdirectorio para que el entrypoint no los ejecute dos veces.
set -Eeuo pipefail

: "${POSTGRES_DB:=skillswap}"
: "${POSTGRES_USER:=postgres}"
: "${APP_DB_PASSWORD:?Debes definir APP_DB_PASSWORD}"
: "${LECTURA_DB_PASSWORD:?Debes definir LECTURA_DB_PASSWORD}"
: "${APP_ENCRYPTION_KEY:?Debes definir APP_ENCRYPTION_KEY}"
: "${APP_HASH_PEPPER:?Debes definir APP_HASH_PEPPER}"

if (( ${#APP_ENCRYPTION_KEY} < 32 )); then
  echo "ERROR: APP_ENCRYPTION_KEY debe tener al menos 32 caracteres" >&2
  exit 1
fi
if (( ${#APP_HASH_PEPPER} < 32 )); then
  echo "ERROR: APP_HASH_PEPPER debe tener al menos 32 caracteres" >&2
  exit 1
fi
if [[ "$APP_ENCRYPTION_KEY" == "$APP_HASH_PEPPER" ]]; then
  echo "ERROR: APP_ENCRYPTION_KEY y APP_HASH_PEPPER deben ser secretos diferentes" >&2
  exit 1
fi

psql \
  --no-psqlrc \
  --set=ON_ERROR_STOP=1 \
  --single-transaction \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set="enc_key=$APP_ENCRYPTION_KEY" \
  --set="hash_pepper=$APP_HASH_PEPPER" \
  --set="app_pw=$APP_DB_PASSWORD" \
  --set="lec_pw=$LECTURA_DB_PASSWORD" \
  --set="db=$POSTGRES_DB" \
  --file=/docker-entrypoint-initdb.d/sql/00_bootstrap.sql

echo "SkillSwap inicializado correctamente en la base '$POSTGRES_DB'."
echo "Roles creados/actualizados: rol_app y rol_lectura."
echo "Las claves criptográficas no se persistieron dentro de PostgreSQL."
