#!/usr/bin/env bash
# =====================================================================
#  Aplica sql/encriptacion_bd_v2.sql con la clave del .env
#
#  La clave NUNCA se escribe en un archivo SQL: llega por la variable de
#  entorno APP_ENCRYPTION_KEY y se pasa a psql como variable (:'k'), que la
#  entrega escapada. set_config la deja solo en ESTA sesión (no se guarda
#  en la base).
#
#  Docker lo ejecuta una sola vez, al crear la base. La imagen oficial
#  puede hacer "source" de este archivo: por eso no usa $1, set -u ni exit.
# =====================================================================
if [ -z "${APP_ENCRYPTION_KEY:-}" ] || [ "${#APP_ENCRYPTION_KEY}" -lt 32 ]; then
  echo "ERROR: APP_ENCRYPTION_KEY falta en .env o tiene menos de 32 caracteres" >&2
  return 1 2>/dev/null || exit 1
fi

_dir_enc="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

psql -v ON_ERROR_STOP=1 --no-psqlrc -q \
     --username "${POSTGRES_USER:-postgres}" --dbname "${POSTGRES_DB:-banco_tiempo}" \
     -v k="$APP_ENCRYPTION_KEY" <<SQL
SELECT set_config('app.encryption_key', :'k', false) IS NOT NULL AS clave_cargada \gset
\i ${_dir_enc}/sql/encriptacion_bd_v2.sql
SQL
_resultado=$?
unset _dir_enc
if [ "$_resultado" -ne 0 ]; then
  echo "ERROR: falló encriptacion_bd_v2.sql (código $_resultado)" >&2
  return 1 2>/dev/null || exit 1
fi
echo "Encriptación aplicada (pgcrypto, pgp_sym_encrypt)."
