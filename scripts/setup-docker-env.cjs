const { existsSync, readFileSync, writeFileSync } = require('node:fs');
const { randomBytes } = require('node:crypto');
const { resolve } = require('node:path');
const { parse } = require('dotenv');

const path = resolve(__dirname, '../.env');
let contents = readFileSync(
  existsSync(path) ? path : resolve(__dirname, '../.env.example'),
  'utf8',
);
const values = parse(contents);
const user = values.POSTGRES_USER || 'timebank';
const database = values.POSTGRES_DB || 'timebank_local';
const password = values.POSTGRES_PASSWORD || randomBytes(32).toString('hex');
const port = values.POSTGRES_PORT || '55432';
if (
  !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(user) ||
  !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(database) ||
  !/^[a-zA-Z0-9_-]{24,}$/.test(password) ||
  !/^\d+$/.test(port) ||
  Number(port) < 1 ||
  Number(port) > 65535
)
  throw new Error(
    'POSTGRES_* invalidos: usar identificadores simples, puerto valido y password URL-safe de al menos 24 caracteres.',
  );

const updates = {
  POSTGRES_USER: user,
  POSTGRES_DB: database,
  POSTGRES_PASSWORD: password,
  POSTGRES_PORT: port,
  JWT_SECRET: values.JWT_SECRET || randomBytes(48).toString('hex'),
};
// Configura tambien npm start para el puerto publicado por Compose.
// Una conexion existente a otro destino se conserva y Compose usa su URL interna.
const localUrl = `postgresql://${user}:${password}@127.0.0.1:${port}/${database}`;
if (!values.DATABASE_URL || values.DATABASE_URL === localUrl) {
  Object.assign(updates, {
    DATABASE_URL: localUrl,
    DATABASE_ENABLED: 'true',
    PERSISTENCE_MODE: 'prisma',
  });
}
for (const [key, value] of Object.entries(updates)) {
  const line = new RegExp(`^${key}=.*$`, 'm');
  contents = line.test(contents)
    ? contents.replace(line, () => `${key}=${value}`)
    : `${contents.trimEnd()}\n${key}=${value}\n`;
}
writeFileSync(path, contents, { mode: 0o600 });
console.log(
  '.env preparado para PostgreSQL local y Compose. Secretos existentes conservados; no versionar .env.',
);
