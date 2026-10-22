import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const schema = readFileSync(resolve('prisma/schema.prisma'), 'utf8');
const documentation = readFileSync(
  resolve('documentaci_n_de_la_base_de_datos.md'),
  'utf8',
);

function documentedTables(): Map<string, Map<string, string>> {
  const diagram = documentation.match(/```mermaid\s*([\s\S]*?)```/)?.[1] ?? '';
  return new Map(
    [...diagram.matchAll(/^\s{4}([A-Z_]+)\s*\{([^}]+)\}/gm)].map(
      ([, table, body]) => [
        table!,
        new Map(
          [...body!.matchAll(/^\s*(\w+)\s+(\w+)(?:\s|$)/gm)].map(
            ([, type, column]) => [column!, type!],
          ),
        ),
      ],
    ),
  );
}

function prismaTables(): Map<string, Map<string, string>> {
  const nativeTypes: Record<string, string> = {
    String: 'varchar',
    Int: 'int',
    DateTime: 'timestamptz',
    Boolean: 'boolean',
    Json: 'jsonb',
  };
  return new Map(
    [...schema.matchAll(/^model\s+\w+\s*\{([\s\S]*?)^\}/gm)].map(([, body]) => [
      body!.match(/@@map\("([A-Z_]+)"\)/)?.[1] ?? '',
      new Map(
        [
          ...body!.matchAll(
            /^[ \t]+(\w+)[ \t]+(String|Int|DateTime|Boolean|Json)\??[ \t]*(.*)$/gm,
          ),
        ].map(([, column, type, attributes]) => [
          column!,
          attributes!.includes('@db.Uuid')
            ? 'uuid'
            : attributes!.includes('@db.Text')
              ? 'text'
              : nativeTypes[type!]!,
        ]),
      ),
    ]),
  );
}

describe('Contrato Prisma del modelo optimizado elegido', () => {
  it('incluye las 12 tablas y todas sus columnas con los tipos de la documentacion', () => {
    const tables = documentedTables();
    expect(tables.size).toBe(12);
    expect(prismaTables()).toEqual(tables);
  });

  it('evita tablas legadas y vincula movimientos directamente al usuario', () => {
    const tables = prismaTables();
    for (const removed of [
      'ROLES',
      'USUARIO_ROLES',
      'CUENTAS_CREDITO',
      'CONFIRMACIONES',
      'CANCELACIONES',
      'TRANSFERENCIAS_CREDITO',
    ]) {
      expect(tables.has(removed)).toBe(false);
    }
    expect(tables.get('MOVIMIENTOS_CREDITO')?.has('id_usuario')).toBe(true);
    expect(tables.get('MOVIMIENTOS_CREDITO')?.has('id_cuenta')).toBe(false);
  });

  it('conserva las restricciones unicas de reserva y evaluador', () => {
    const reservation = schema.match(/model Reserva\s*\{([\s\S]*?)^\}/m)?.[1];
    const rating = schema.match(/model Calificacion\s*\{([\s\S]*?)^\}/m)?.[1];
    expect(reservation).toMatch(/id_solicitud\s+String\?\s+@unique\s+@db.Uuid/);
    expect(rating).toContain('@@unique([id_reserva, id_evaluador])');
    expect(schema).toMatch(/@@id\(\[id_usuario, id_habilidad\]\)/);
  });
});
