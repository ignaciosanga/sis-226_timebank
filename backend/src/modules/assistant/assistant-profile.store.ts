import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Environment } from '../../config/environment';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export const AVATAR_STYLES = ['orbe', 'gota', 'burbuja', 'chispa'] as const;
export const AVATAR_COLORS = ['azul', 'amarillo', 'verde', 'coral'] as const;
export type AvatarStyle = (typeof AVATAR_STYLES)[number];
export type AvatarColor = (typeof AVATAR_COLORS)[number];

export interface AssistantProfile {
  avatar_estilo: AvatarStyle;
  avatar_color: AvatarColor;
  avatar_nombre: string;
  groq_key_cifrada: string | null;
  groq_key_pista: string | null;
  mensajes_dia: string | null;
  mensajes_usados: number;
}

const defaults = (): AssistantProfile => ({
  avatar_estilo: 'orbe',
  avatar_color: 'azul',
  avatar_nombre: 'Nexo',
  groq_key_cifrada: null,
  groq_key_pista: null,
  mensajes_dia: null,
  mensajes_usados: 0,
});

const COLUMNS = `avatar_estilo, avatar_color, avatar_nombre, groq_key_cifrada, groq_key_pista,
  to_char(mensajes_dia, 'YYYY-MM-DD') AS mensajes_dia, mensajes_usados`;

@Injectable()
export class AssistantProfileStore {
  private readonly memory = new Map<string, AssistantProfile>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  private get usesDatabase() {
    return this.config.get('PERSISTENCE_MODE', { infer: true }) === 'prisma';
  }

  async get(userId: string): Promise<AssistantProfile> {
    if (!this.usesDatabase)
      return { ...(this.memory.get(userId) ?? defaults()) };
    const db = await this.prisma.connect();
    const [row] = await db.$queryRawUnsafe<AssistantProfile[]>(
      `SELECT ${COLUMNS} FROM "ASISTENTE_PERFILES" WHERE id_usuario = $1::uuid`,
      userId,
    );
    return row ?? defaults();
  }

  private async upsert(
    userId: string,
    changes: Partial<AssistantProfile>,
  ): Promise<AssistantProfile> {
    if (!this.usesDatabase) {
      const next = { ...(this.memory.get(userId) ?? defaults()), ...changes };
      this.memory.set(userId, next);
      return { ...next };
    }
    const fields = Object.keys(changes) as (keyof AssistantProfile)[];
    const values = fields.map((field) => changes[field] ?? null);
    const casts = fields.map((field) =>
      field === 'mensajes_dia'
        ? '::date'
        : field === 'mensajes_usados'
          ? '::integer'
          : '',
    );
    const db = await this.prisma.connect();
    const [row] = await db.$queryRawUnsafe<AssistantProfile[]>(
      `INSERT INTO "ASISTENTE_PERFILES" (id_usuario, ${fields.join(', ')})
       VALUES ($1::uuid, ${fields.map((_, i) => `$${i + 2}${casts[i]}`).join(', ')})
       ON CONFLICT (id_usuario) DO UPDATE SET
       ${fields.map((field) => `${field} = EXCLUDED.${field}`).join(', ')}, updated_at = now()
       RETURNING ${COLUMNS}`,
      userId,
      ...values,
    );
    return row ?? defaults();
  }

  saveAvatar(
    userId: string,
    avatar: Pick<
      AssistantProfile,
      'avatar_estilo' | 'avatar_color' | 'avatar_nombre'
    >,
  ) {
    return this.upsert(userId, avatar);
  }

  saveKey(userId: string, cipher: string, hint: string) {
    return this.upsert(userId, {
      groq_key_cifrada: cipher,
      groq_key_pista: hint,
    });
  }

  clearKey(userId: string) {
    return this.upsert(userId, {
      groq_key_cifrada: null,
      groq_key_pista: null,
    });
  }

  async countFreeMessage(userId: string, today: string): Promise<number> {
    if (!this.usesDatabase) {
      const current = this.memory.get(userId) ?? defaults();
      const used =
        current.mensajes_dia === today ? current.mensajes_usados + 1 : 1;
      this.memory.set(userId, {
        ...current,
        mensajes_dia: today,
        mensajes_usados: used,
      });
      return used;
    }
    const db = await this.prisma.connect();
    const [row] = await db.$queryRawUnsafe<{ mensajes_usados: number }[]>(
      `INSERT INTO "ASISTENTE_PERFILES" (id_usuario, mensajes_dia, mensajes_usados)
       VALUES ($1::uuid, $2::date, 1)
       ON CONFLICT (id_usuario) DO UPDATE SET
         mensajes_usados = CASE WHEN "ASISTENTE_PERFILES".mensajes_dia = EXCLUDED.mensajes_dia
           THEN "ASISTENTE_PERFILES".mensajes_usados + 1 ELSE 1 END,
         mensajes_dia = EXCLUDED.mensajes_dia,
         updated_at = now()
       RETURNING mensajes_usados`,
      userId,
      today,
    );
    return Number(row?.mensajes_usados ?? 1);
  }
}
