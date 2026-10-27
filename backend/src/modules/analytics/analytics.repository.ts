import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PrismaClient } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  RecordStatus,
  UserStatus,
} from '../../common/enums/record-status.enum';
import {
  RequestStatus,
  ReservationStatus,
} from '../exchanges/exchange.types';
import { GroupBy, Period } from './dto/analytics-query.dto';

export interface SeriesPoint {
  periodo: string;
  cantidad: number;
  creditos?: string;
}
export interface NamedCount {
  id: string;
  nombre: string;
  cantidad: number;
}

const toNumber = (value: unknown): number => Number(value ?? 0);
const toInt = (value: unknown): string => String(BigInt(String(value ?? 0)));
const range = (period: Period) => ({ gte: period.from, lt: period.to });

/**
 * Lecturas agregadas de solo lectura sobre PostgreSQL (count/aggregate/groupBy
 * y SQL parametrizado para series temporales). No usa las transacciones de
 * escritura ni modifica saldos o movimientos.
 */
@Injectable()
export class AnalyticsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private client(): Promise<PrismaClient> {
    if (this.config.get('PERSISTENCE_MODE') !== 'prisma')
      throw new ServiceUnavailableException(
        'Estadisticas disponibles solo con PERSISTENCE_MODE=prisma (PostgreSQL)',
      );
    return this.prisma.connect();
  }

  /** groupBy validado por DTO; nunca proviene sin filtrar del cliente. */
  private async series(
    table: string,
    column: string,
    period: Period,
    groupBy: GroupBy,
    extra = '',
    sumColumn?: string,
  ): Promise<SeriesPoint[]> {
    const unit = groupBy === 'month' ? 'month' : 'day';
    const db = await this.client();
    const rows = await db.$queryRawUnsafe<
      { periodo: Date; cantidad: bigint; creditos: bigint | null }[]
    >(
      `SELECT date_trunc('${unit}', "${column}") AS periodo, COUNT(*) AS cantidad,
              ${sumColumn ? `SUM("${sumColumn}")` : 'NULL'} AS creditos
       FROM "${table}" WHERE "${column}" >= $1 AND "${column}" < $2 ${extra}
       GROUP BY 1 ORDER BY 1`,
      period.from,
      period.to,
    );
    return rows.map((row) => ({
      periodo: row.periodo.toISOString(),
      cantidad: toNumber(row.cantidad),
      ...(sumColumn ? { creditos: toInt(row.creditos) } : {}),
    }));
  }

  async usersByStatus(): Promise<Record<string, number>> {
    const db = await this.client();
    const rows = await db.usuario.groupBy({ by: ['estado'], _count: true });
    const result: Record<string, number> = {};
    for (const status of Object.values(UserStatus)) result[status] = 0;
    for (const row of rows) result[row.estado] = row._count;
    return result;
  }
  async usersByCareer(): Promise<NamedCount[]> {
    const db = await this.client();
    const rows = await db.usuario.groupBy({ by: ['id_carrera'], _count: true });
    const ids = rows.flatMap((row) => (row.id_carrera ? [row.id_carrera] : []));
    const careers = await db.carrera.findMany({
      where: { id_carrera: { in: ids } },
      select: { id_carrera: true, nombre: true },
    });
    const names = new Map(careers.map((c) => [c.id_carrera, c.nombre]));
    return rows
      .map((row) => ({
        id: row.id_carrera ?? '',
        nombre: row.id_carrera
          ? (names.get(row.id_carrera) ?? 'Desconocida')
          : 'Sin carrera',
        cantidad: row._count,
      }))
      .sort((a, b) => b.cantidad - a.cantidad);
  }
  async newUsers(period: Period): Promise<number> {
    const db = await this.client();
    return db.usuario.count({ where: { fecha_registro: range(period) } });
  }
  usersSeries(period: Period, groupBy: GroupBy): Promise<SeriesPoint[]> {
    return this.series('USUARIOS', 'fecha_registro', period, groupBy);
  }
  async usersWithSkills(): Promise<number> {
    const db = await this.client();
    const rows = await db.$queryRawUnsafe<{ cantidad: bigint }[]>(
      'SELECT COUNT(DISTINCT "id_usuario") AS cantidad FROM "USUARIO_HABILIDADES"',
    );
    return toNumber(rows[0]?.cantidad);
  }

  async requestsByStatus(): Promise<Record<string, number>> {
    const db = await this.client();
    const rows = await db.solicitudIntercambio.groupBy({
      by: ['estado'],
      _count: true,
    });
    const result: Record<string, number> = {};
    for (const status of Object.values(RequestStatus)) result[status] = 0;
    for (const row of rows) result[row.estado] = row._count;
    return result;
  }
  async requestsCreated(period: Period): Promise<number> {
    const db = await this.client();
    return db.solicitudIntercambio.count({
      where: { created_at: range(period) },
    });
  }
  async reservationsByStatus(): Promise<Record<string, number>> {
    const db = await this.client();
    const rows = await db.reserva.groupBy({ by: ['estado'], _count: true });
    const result: Record<string, number> = {};
    for (const status of Object.values(ReservationStatus)) result[status] = 0;
    for (const row of rows) result[row.estado] = row._count;
    return result;
  }
  async reservationsCreated(period: Period): Promise<number> {
    const db = await this.client();
    return db.reserva.count({ where: { created_at: range(period) } });
  }
  /** Completadas en el periodo por completed_at, con minutos programados y creditos. */
  async completedReservations(
    period: Period,
  ): Promise<{ cantidad: number; minutos: number; creditos: string }> {
    const db = await this.client();
    const rows = await db.$queryRawUnsafe<
      { cantidad: bigint; minutos: number | null; creditos: bigint | null }[]
    >(
      `SELECT COUNT(*) AS cantidad,
              COALESCE(SUM(EXTRACT(EPOCH FROM ("fecha_fin" - "fecha_inicio")) / 60), 0)::float AS minutos,
              SUM("creditos") AS creditos
       FROM "RESERVAS" WHERE "estado" = $3 AND "completed_at" >= $1 AND "completed_at" < $2`,
      period.from,
      period.to,
      ReservationStatus.COMPLETADA,
    );
    return {
      cantidad: toNumber(rows[0]?.cantidad),
      minutos: Math.round(toNumber(rows[0]?.minutos)),
      creditos: toInt(rows[0]?.creditos),
    };
  }
  async cancelledReservations(period: Period): Promise<number> {
    const db = await this.client();
    return db.reserva.count({
      where: {
        estado: ReservationStatus.CANCELADA,
        cancelled_at: range(period),
      },
    });
  }
  completedSeries(period: Period, groupBy: GroupBy): Promise<SeriesPoint[]> {
    return this.series(
      'RESERVAS',
      'completed_at',
      period,
      groupBy,
      `AND "estado" = '${ReservationStatus.COMPLETADA}'`,
      'creditos',
    );
  }

  /** Suma de MOVIMIENTOS_CREDITO por tipo dentro del periodo (cantidad con su signo). */
  async movementsByType(
    period: Period,
  ): Promise<Record<string, { cantidad: number; creditos: string }>> {
    const db = await this.client();
    const rows = await db.movimientoCredito.groupBy({
      by: ['tipo'],
      where: { created_at: range(period) },
      _count: true,
      _sum: { cantidad: true },
    });
    const result: Record<string, { cantidad: number; creditos: string }> = {};
    for (const row of rows)
      result[row.tipo] = {
        cantidad: row._count,
        creditos: toInt(row._sum.cantidad),
      };
    return result;
  }
  transfersSeries(period: Period, groupBy: GroupBy): Promise<SeriesPoint[]> {
    return this.series(
      'MOVIMIENTOS_CREDITO',
      'created_at',
      period,
      groupBy,
      `AND "tipo" = 'Transferencia'`,
      'cantidad',
    );
  }
  /** Saldos actuales de USUARIOS, no historicos. */
  async currentBalances(): Promise<{ saldo: string; retenidos: string }> {
    const db = await this.client();
    const totals = await db.usuario.aggregate({
      _sum: { saldo: true, creditos_retenidos: true },
    });
    return {
      saldo: toInt(totals._sum.saldo),
      retenidos: toInt(totals._sum.creditos_retenidos),
    };
  }

  async skillTotals(): Promise<{ total: number; ofrecidas: number }> {
    const db = await this.client();
    const [total, offered] = await Promise.all([
      db.habilidad.count({ where: { estado: RecordStatus.ACTIVO } }),
      db.usuarioHabilidad.groupBy({ by: ['id_habilidad'] }),
    ]);
    return { total, ofrecidas: offered.length };
  }
  async skillsByCategory(): Promise<NamedCount[]> {
    const db = await this.client();
    const rows = await db.habilidad.groupBy({
      by: ['id_categoria'],
      where: { estado: RecordStatus.ACTIVO },
      _count: true,
    });
    return this.named(
      rows.map((row) => ({ id: row.id_categoria, cantidad: row._count })),
      'categoria',
    );
  }
  async mostRequestedSkills(
    period: Period,
    limit: number,
  ): Promise<NamedCount[]> {
    const db = await this.client();
    const rows = await db.solicitudIntercambio.groupBy({
      by: ['id_habilidad'],
      where: { created_at: range(period) },
      _count: true,
      orderBy: { _count: { id_habilidad: 'desc' } },
      take: limit,
    });
    return this.named(
      rows.map((row) => ({ id: row.id_habilidad, cantidad: row._count })),
      'habilidad',
    );
  }
  async mostCompletedSkills(
    period: Period,
    limit: number,
  ): Promise<NamedCount[]> {
    const db = await this.client();
    const rows = await db.reserva.groupBy({
      by: ['id_habilidad'],
      where: {
        estado: ReservationStatus.COMPLETADA,
        completed_at: range(period),
      },
      _count: true,
      orderBy: { _count: { id_habilidad: 'desc' } },
      take: limit,
    });
    return this.named(
      rows.map((row) => ({ id: row.id_habilidad, cantidad: row._count })),
      'habilidad',
    );
  }
  async completedByCategory(period: Period): Promise<NamedCount[]> {
    const db = await this.client();
    const rows = await db.$queryRawUnsafe<
      { id: string; nombre: string; cantidad: bigint }[]
    >(
      `SELECT c."id_categoria" AS id, c."nombre" AS nombre, COUNT(*) AS cantidad
       FROM "RESERVAS" r
       JOIN "HABILIDADES" h ON h."id_habilidad" = r."id_habilidad"
       JOIN "CATEGORIAS" c ON c."id_categoria" = h."id_categoria"
       WHERE r."estado" = $3 AND r."completed_at" >= $1 AND r."completed_at" < $2
       GROUP BY 1, 2 ORDER BY 3 DESC`,
      period.from,
      period.to,
      ReservationStatus.COMPLETADA,
    );
    return rows.map((row) => ({ ...row, cantidad: toNumber(row.cantidad) }));
  }
  async providersPerSkill(limit: number): Promise<NamedCount[]> {
    const db = await this.client();
    const rows = await db.usuarioHabilidad.groupBy({
      by: ['id_habilidad'],
      _count: true,
      orderBy: { _count: { id_habilidad: 'desc' } },
      take: limit,
    });
    return this.named(
      rows.map((row) => ({ id: row.id_habilidad, cantidad: row._count })),
      'habilidad',
    );
  }

  /** Resuelve nombres en una sola consulta para evitar N+1. */
  private async named(
    rows: { id: string; cantidad: number }[],
    kind: 'habilidad' | 'categoria',
  ): Promise<NamedCount[]> {
    if (!rows.length) return [];
    const db = await this.client();
    const ids = rows.map((row) => row.id);
    const catalog =
      kind === 'habilidad'
        ? (
            await db.habilidad.findMany({
              where: { id_habilidad: { in: ids } },
              select: { id_habilidad: true, nombre: true },
            })
          ).map((row) => [row.id_habilidad, row.nombre] as const)
        : (
            await db.categoria.findMany({
              where: { id_categoria: { in: ids } },
              select: { id_categoria: true, nombre: true },
            })
          ).map((row) => [row.id_categoria, row.nombre] as const);
    const names = new Map<string, string>(catalog);
    return rows.map((row) => ({
      ...row,
      nombre: names.get(row.id) ?? 'Desconocida',
    }));
  }
}
