const { readFileSync, writeFileSync } = require('node:fs');
const { randomBytes } = require('node:crypto');
const { resolve } = require('node:path');

try {
  const example = readFileSync(resolve(__dirname, '../.env.example'), 'utf8');
  const contents = example.replace(
    /^JWT_SECRET=$/m,
    `JWT_SECRET=${randomBytes(48).toString('hex')}`,
  );
  writeFileSync(resolve(__dirname, '../.env'), contents, {
    flag: 'wx',
    mode: 0o600,
  });
  console.log('.env local creado. No compartir ni versionar este archivo.');
} catch (error) {
  if (error.code === 'EEXIST')
    console.log('.env ya existe; se conserva su contenido.');
  else {
    console.error('No se pudo crear .env.');
    process.exitCode = 1;
  }
}
