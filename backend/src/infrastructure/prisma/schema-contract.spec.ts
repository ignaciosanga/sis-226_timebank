import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const schema = readFileSync(resolve('prisma/schema.prisma'), 'utf8');
const documentation = readFileSync(
  resolve('documentaci_n_de_la_base_de_datos.md'),
  'utf8',
);
// Ampliación del modelo documentado por la migración decimal oficial.
const decimalCredits: Record<string, string[]> = {
  USUARIOS: ['saldo', 'creditos_retenidos'],
  SOLICITUDES_INTERCAMBIO: ['creditos_requeridos'],
  RESERVAS: ['creditos'],
  MOVIMIENTOS_CREDITO: [
    'cantidad',
    'saldo_anterior',
    'saldo_posterior',
    'retenidos_anterior',
    'retenidos_posterior',
  ],
};

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
    Decimal: 'numeric',
  };
  return new Map(
    [...schema.matchAll(/^model\s+\w+\s*\{([\s\S]*?)^\}/gm)].map(([, body]) => [
      body!.match(/@@map\("([A-Z_]+)"\)/)?.[1] ?? '',
      new Map(
        [
          ...body!.matchAll(
            /^[ \t]+(\w+)[ \t]+(String|Int|DateTime|Boolean|Json|Decimal)\??[ \t]*(.*)$/gm,
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
  it('conserva el modelo base y los tipos de la migración decimal oficial', () => {
    const tables = documentedTables();
    expect(tables.size).toBe(12);
    for (const [table, columns] of Object.entries(decimalCredits))
      for (const column of columns) tables.get(table)!.set(column, 'numeric');
    tables.get('SOLICITUDES_INTERCAMBIO')!.set('id_oferta', 'uuid');
    const actual = prismaTables();
    const verification = actual.get('VERIFICACIONES_CORREO');
    expect(verification).toEqual(
      new Map([
        ['id_verificacion', 'uuid'],
        ['id_usuario', 'uuid'],
        ['token_hash', 'varchar'],
        ['created_at', 'timestamptz'],
        ['expires_at', 'timestamptz'],
        ['consumed_at', 'timestamptz'],
      ]),
    );
    actual.delete('VERIFICACIONES_CORREO');
    expect(actual.get('OFERTAS')).toEqual(
      new Map([
        ['id_oferta', 'uuid'],
        ['id_tutor', 'uuid'],
        ['id_habilidad', 'uuid'],
        ['id_disponibilidad', 'uuid'],
        ['id_banner', 'uuid'],
        ['nivel', 'varchar'],
        ['titulo', 'varchar'],
        ['descripcion', 'varchar'],
        ['costo_creditos', 'numeric'],
        ['estado', 'varchar'],
        ['created_at', 'timestamptz'],
      ]),
    );
    expect(actual.get('BANNERS_TUTORIA')).toEqual(
      new Map([
        ['id_banner', 'uuid'],
        ['id_tutor', 'uuid'],
        ['storage_name', 'varchar'],
        ['mime_type', 'varchar'],
        ['byte_size', 'int'],
        ['sha256', 'varchar'],
        ['created_at', 'timestamptz'],
        ['expires_at', 'timestamptz'],
        ['attached_offer_id', 'uuid'],
        ['deleted_at', 'timestamptz'],
      ]),
    );
    actual.delete('OFERTAS');
    actual.delete('BANNERS_TUTORIA');
    const academic: Record<string, Record<string, string>> = {
      CURRICULOS: { codigo: 'varchar', nombre: 'varchar', id_carrera: 'uuid' },
      AREAS_ACADEMICAS: { codigo: 'varchar', nombre: 'varchar' },
      MATERIAS_ACADEMICAS: {
        curriculum: 'varchar',
        codigo: 'varchar',
        nombre: 'varchar',
        semestre: 'int',
        area: 'varchar',
        externo: 'boolean',
        id_habilidad: 'uuid',
      },
      PRERREQUISITOS_ACADEMICOS: {
        curriculum: 'varchar',
        codigo: 'varchar',
        requisito: 'varchar',
      },
      PROGRESO_ACADEMICO: {
        id_usuario: 'uuid',
        curriculum: 'varchar',
        codigo: 'varchar',
        estado: 'varchar',
        updated_at: 'timestamptz',
      },
    };
    for (const [table, columns] of Object.entries(academic)) {
      expect(actual.get(table)).toEqual(new Map(Object.entries(columns)));
      actual.delete(table);
    }
    const user = actual.get('USUARIOS')!;
    for (const [column, type] of Object.entries({
      cuenta_previa: 'boolean',
      email_verificado_at: 'timestamptz',
      metodo_verificacion: 'varchar',
      bono_decidido_at: 'timestamptz',
      google_sub: 'varchar',
    })) {
      expect(user.get(column)).toBe(type);
      user.delete(column);
    }
    expect(actual).toEqual(tables);
  });

  it('declara NUMERIC sin typmod y la FK nullable de oferta sin alterar sus acciones SQL', () => {
    const models = new Map(
      [...schema.matchAll(/^model\s+\w+\s*\{([\s\S]*?)^\}/gm)].map(
        ([, body]) => [body!.match(/@@map\("([A-Z_]+)"\)/)?.[1], body!],
      ),
    );
    for (const [table, columns] of Object.entries(decimalCredits))
      for (const column of columns)
        expect(models.get(table)).toMatch(
          new RegExp(
            `^[ \\t]+${column}\\s+Decimal\\s+[^\\n]*@db\\.Decimal(?:[ \\t]*\\r?$)`,
            'm',
          ),
        );
    const request = models.get('SOLICITUDES_INTERCAMBIO')!;
    expect(request).toMatch(/id_oferta\s+String\?\s+@db.Uuid/);
    expect(request).toMatch(
      /oferta\s+OfertaTutoria\?\s+@relation\(fields: \[id_oferta\], references: \[id_oferta\], onDelete: Restrict, onUpdate: NoAction\)/,
    );
    expect(request).toContain('@@index([id_oferta])');
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
