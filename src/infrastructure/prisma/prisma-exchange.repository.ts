import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type { Prisma } from '../../generated/prisma/client';
import type { Auditoria } from '../../generated/prisma/client';
import { subtractCredits } from '../../modules/exchanges/credits';
import {
  AvailabilityStatus,
  UserStatus,
} from '../../common/enums/record-status.enum';
import { DatabaseRole } from '../../common/enums/role.enum';
import { ExchangeRepository } from '../../modules/exchanges/exchange.repository';
import {
  ExchangeRequest,
  ExchangeState,
  Movement,
  RequestStatus,
  Reservation,
  ReservationStatus,
} from '../../modules/exchanges/exchange.types';
import { StoredUser } from '../../modules/users/user.types';
import { SkillLevel } from '../../modules/user-skills/user-skill.types';
import { TutoringOffer } from '../../modules/tutoring/offer.types';
import { PrismaService } from './prisma.service';
import {
  detectCreditSchema,
  legacyCredit,
  persistDecimalMovement,
  persistDecimalRequest,
  persistDecimalReservation,
  persistDecimalUser,
  postgresErrorCode,
  readCreditRows,
} from './prisma-credit-sql';

type Transaction = Prisma.TransactionClient;
const json = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const same = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

function stableId(scope: string): string {
  const hex = createHash('sha256')
    .update(`timebank:optimized12:${scope}`)
    .digest('hex')
    .slice(0, 32)
    .split('');
  hex[12] = '5';
  hex[16] = '8';
  const value = hex.join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

/** Adaptador real al esquema optimizado. No crea tablas ni ejecuta migraciones. */
@Injectable()
export class PrismaExchangeRepository implements ExchangeRepository {
  readonly scope = 'postgresql-transaction' as const;
  constructor(private readonly prisma: PrismaService) {}

  private async load(tx: Transaction): Promise<ExchangeState> {
    const creditSchema = await detectCreditSchema(tx);
    const [
      { users, requests, reservations, movements },
      availability,
      skills,
      metadata,
      verifications,
      offers,
      banners,
      ratings,
    ] = await Promise.all([
      readCreditRows(tx, creditSchema),
      tx.disponibilidad.findMany(),
      tx.usuarioHabilidad.findMany(),
      creditSchema === 'scaled'
        ? tx.$queryRawUnsafe<Auditoria[]>(
            `SELECT * FROM v_auditoria_desencriptada WHERE accion IN ('BACKEND_METADATA','IDEMPOTENCY') ORDER BY created_at`,
          )
        : tx.auditoria.findMany({
            where: { accion: { in: ['BACKEND_METADATA', 'IDEMPOTENCY'] } },
            orderBy: { created_at: 'asc' },
          }),
      tx.verificacionCorreo.findMany(),
      tx.ofertaTutoria.findMany(),
      tx.bannerTutoria.findMany(),
      tx.calificacion.findMany(),
    ]);
    const state: ExchangeState = {
      creditSchema,
      offers: new Map(
        offers.map((row) => [
          row.id_oferta,
          {
            ...row,
            costo_creditos: row.costo_creditos.toString(),
            nivel: row.nivel as SkillLevel,
            estado: row.estado as TutoringOffer['estado'],
          },
        ]),
      ),
      banners: new Map(banners.map((row) => [row.id_banner, row])),
      ratings: new Map(ratings.map((row) => [row.id_calificacion, row])),
      verifications: new Map(verifications.map((row) => [row.token_hash, row])),
      users: new Map(),
      availability: new Map(),
      userSkills: new Map(),
      requests: new Map(),
      reservations: new Map(),
      movements: new Map(),
      requestMetadata: new Map(),
      reservationMetadata: new Map(),
      idempotency: new Map(),
      adminAudit: new Map(),
    };
    if (creditSchema === 'scaled') {
      const config = await tx.$queryRawUnsafe<
        { clave: string; valor: number }[]
      >('SELECT clave,valor FROM config_economia');
      state.economy = Object.fromEntries(config.map((r) => [r.clave, r.valor]));
      for (const key of [
        'costo_base',
        'mult_escasez',
        'mult_demanda',
        'mult_impacto',
        'umbral_tutores_escasez',
        'horas_minimas_cancelacion',
        'penalizacion_creditos',
      ])
        if (
          !Number.isSafeInteger(state.economy[key]) ||
          state.economy[key]! < 0
        )
          throw new ServiceUnavailableException(
            'Configuración económica BD incompleta',
          );
    }
    for (const row of users) {
      if (
        !Object.values(DatabaseRole).includes(row.rol as DatabaseRole) ||
        !Object.values(UserStatus).includes(row.estado as UserStatus)
      )
        throw new ServiceUnavailableException(
          'Valores de rol o estado incompatibles con el modelo optimizado',
        );
      state.users.set(row.id_usuario, row as StoredUser);
    }
    for (const row of availability)
      state.availability.set(row.id_disponibilidad, {
        ...row,
        estado: row.estado as AvailabilityStatus,
      });
    for (const row of skills)
      state.userSkills.set(`${row.id_usuario}:${row.id_habilidad}`, {
        ...row,
        nivel: row.nivel as SkillLevel,
      });
    for (const row of requests)
      state.requests.set(row.id_solicitud, {
        ...row,
        estado: row.estado as RequestStatus,
      });
    for (const row of reservations)
      state.reservations.set(row.id_reserva, {
        ...row,
        estado: row.estado as ReservationStatus,
        modalidad: row.modalidad as Reservation['modalidad'],
      });
    for (const row of movements)
      state.movements.set(row.id_movimiento, {
        ...row,
        tipo: row.tipo as Movement['tipo'],
      });
    for (const row of metadata) {
      const data = row.datos_nuevos;
      if (!data || typeof data !== 'object' || Array.isArray(data)) continue;
      if (
        row.accion === 'IDEMPOTENCY' &&
        typeof data.scope === 'string' &&
        typeof data.fingerprint === 'string' &&
        'result' in data
      )
        state.idempotency.set(data.scope, {
          fingerprint: data.fingerprint,
          result: data.result,
        });
      else if (
        row.accion === 'BACKEND_METADATA' &&
        typeof data.availabilityId === 'string'
      ) {
        if (row.entidad === 'SOLICITUDES_INTERCAMBIO')
          state.requestMetadata.set(row.entidad_id, {
            availabilityId: data.availabilityId,
            descripcion:
              typeof data.descripcion === 'string' ? data.descripcion : '',
          });
        if (row.entidad === 'RESERVAS')
          state.reservationMetadata.set(row.entidad_id, {
            availabilityId: data.availabilityId,
            administrativa: data.administrativa === true,
          });
      }
    }
    // Datos creados por otros clientes pueden carecer de metadata de API.
    for (const row of state.requests.values()) {
      if (state.requestMetadata.has(row.id_solicitud)) continue;
      const slot = availability.find(
        (item) =>
          item.id_usuario === row.id_ofertante &&
          item.fecha_inicio <= row.fecha_inicio_propuesta &&
          item.fecha_fin >= row.fecha_fin_propuesta &&
          item.estado !== AvailabilityStatus.CANCELADO,
      );
      if (slot)
        state.requestMetadata.set(row.id_solicitud, {
          availabilityId: slot.id_disponibilidad,
          descripcion: '',
        });
    }
    for (const row of state.reservations.values()) {
      if (state.reservationMetadata.has(row.id_reserva)) continue;
      const requestContext = row.id_solicitud
        ? state.requestMetadata.get(row.id_solicitud)
        : undefined;
      const slot = availability.find(
        (item) =>
          item.id_usuario === row.id_ofertante &&
          item.fecha_inicio <= row.fecha_inicio &&
          item.fecha_fin >= row.fecha_fin,
      );
      const availabilityId =
        requestContext?.availabilityId ?? slot?.id_disponibilidad;
      if (availabilityId)
        state.reservationMetadata.set(row.id_reserva, {
          availabilityId,
          administrativa:
            !!row.cancelado_por &&
            state.users.get(row.cancelado_por)?.rol === DatabaseRole.ADMIN,
        });
    }
    return state;
  }

  private async persist(
    tx: Transaction,
    before: ExchangeState,
    after: ExchangeState,
  ): Promise<void> {
    const write = async <T>(
      previous: Map<string, T>,
      next: Map<string, T>,
      save: (row: T) => Promise<unknown>,
    ) => {
      for (const id of previous.keys())
        if (!next.has(id))
          throw new ConflictException(
            'No se permite borrar historial desde una operacion transaccional',
          );
      for (const [id, row] of next)
        if (!same(previous.get(id), row)) await save(row);
    };
    await write(before.ratings, after.ratings, (row) => {
      if (before.ratings.has(row.id_calificacion))
        throw new ConflictException('Las opiniones publicadas son inmutables');
      return tx.calificacion.create({ data: row });
    });
    await write(before.users, after.users, (row) => {
      if (before.creditSchema !== 'integer')
        return persistDecimalUser(tx, row, before.creditSchema === 'scaled');
      const integerRow = {
        ...row,
        saldo: legacyCredit(row.saldo),
        creditos_retenidos: legacyCredit(row.creditos_retenidos),
      };
      return tx.usuario.upsert({
        where: { id_usuario: row.id_usuario },
        create: integerRow,
        update: integerRow,
      });
    });
    await write(before.verifications, after.verifications, (row) =>
      tx.verificacionCorreo.upsert({
        where: { token_hash: row.token_hash },
        create: row,
        update: row,
      }),
    );
    await write(before.availability, after.availability, (row) =>
      tx.disponibilidad.upsert({
        where: { id_disponibilidad: row.id_disponibilidad },
        create: row,
        update: row,
      }),
    );
    await write(before.banners, after.banners, (row) =>
      tx.bannerTutoria.upsert({
        where: { id_banner: row.id_banner },
        create: row,
        update: row,
      }),
    );
    await write(before.offers, after.offers, (row) =>
      tx.ofertaTutoria.upsert({
        where: { id_oferta: row.id_oferta },
        create: row,
        update: row,
      }),
    );
    for (const [key, row] of before.userSkills)
      if (!after.userSkills.has(key))
        await tx.usuarioHabilidad.delete({
          where: {
            id_usuario_id_habilidad: {
              id_usuario: row.id_usuario,
              id_habilidad: row.id_habilidad,
            },
          },
        });
    for (const [key, row] of after.userSkills)
      if (!same(before.userSkills.get(key), row))
        await tx.usuarioHabilidad.upsert({
          where: {
            id_usuario_id_habilidad: {
              id_usuario: row.id_usuario,
              id_habilidad: row.id_habilidad,
            },
          },
          create: row,
          update: row,
        });
    await write(before.requests, after.requests, (row) => {
      if (before.creditSchema !== 'integer')
        return persistDecimalRequest(tx, row, before.creditSchema === 'scaled');
      const { id_oferta, ...fields } = row as ExchangeRequest;
      if (id_oferta)
        throw new ConflictException({
          code: 'OFFER_PRICE_FLOW_PENDING',
          message: 'La base INTEGER no admite solicitudes vinculadas a ofertas',
        });
      const integerRow = {
        ...fields,
        creditos_requeridos: legacyCredit(row.creditos_requeridos),
      };
      return tx.solicitudIntercambio.upsert({
        where: { id_solicitud: row.id_solicitud },
        create: integerRow,
        update: integerRow,
      });
    });
    await write(before.reservations, after.reservations, (row) => {
      if (before.creditSchema !== 'integer')
        return persistDecimalReservation(
          tx,
          row,
          before.creditSchema === 'scaled',
        );
      const integerRow = { ...row, creditos: legacyCredit(row.creditos) };
      return tx.reserva.upsert({
        where: { id_reserva: row.id_reserva },
        create: integerRow,
        update: integerRow,
      });
    });
    for (const [id, row] of before.movements)
      if (!same(after.movements.get(id), row))
        throw new ConflictException('El libro de movimientos es inmutable');
    for (const [id, row] of after.movements)
      if (!before.movements.has(id)) {
        if (before.creditSchema !== 'integer')
          await persistDecimalMovement(
            tx,
            row,
            before.creditSchema === 'scaled',
          );
        else
          await tx.movimientoCredito.create({
            data: {
              ...row,
              cantidad: legacyCredit(row.cantidad),
              saldo_anterior: legacyCredit(row.saldo_anterior),
              saldo_posterior: legacyCredit(row.saldo_posterior),
              retenidos_anterior: legacyCredit(row.retenidos_anterior),
              retenidos_posterior: legacyCredit(row.retenidos_posterior),
            },
          });
      }

    // BD es el único escritor de penalizaciones. Sus triggers pueden cambiar
    // los saldos después del pago/liberación: responder y guardar replay del estado real.
    if (before.creditSchema === 'scaled') {
      const actual = await readCreditRows(tx, 'scaled');
      const accounts = new Map(actual.users.map((u) => [u.id_usuario, u]));
      for (const [scope, value] of after.idempotency) {
        if (
          before.idempotency.has(scope) ||
          !value.result ||
          typeof value.result !== 'object'
        )
          continue;
        const result = value.result as Record<string, unknown>;
        if (result.cuenta && typeof result.cuenta === 'object') {
          const account = result.cuenta as Record<string, unknown>;
          const fresh = accounts.get(String(account.id_usuario));
          if (fresh)
            Object.assign(account, {
              saldo: fresh.saldo,
              creditos_retenidos: fresh.creditos_retenidos,
              disponibles: subtractCredits(
                fresh.saldo,
                fresh.creditos_retenidos,
              ),
            });
        }
        if (result.id_reserva) {
          const fresh = actual.reservations.find(
            (r) => r.id_reserva === result.id_reserva,
          );
          if (fresh?.cancelled_at) {
            Object.assign(result, {
              cancelled_at: fresh.cancelled_at,
              horas_anticipacion_cancelacion:
                fresh.horas_anticipacion_cancelacion,
            });
            if (result.cancelacion && typeof result.cancelacion === 'object')
              Object.assign(result.cancelacion, { fecha: fresh.cancelled_at });
          }
        }
      }
    }
    const writeAudit = async (data: Prisma.AuditoriaUncheckedCreateInput) => {
      if (before.creditSchema === 'scaled')
        await tx.$queryRawUnsafe(
          'SELECT fn_backend_audit($1::jsonb,false)::text AS saved',
          JSON.stringify(data),
        );
      else await tx.auditoria.create({ data });
    };
    const saveMetadata = async (
      entity: string,
      id: string,
      actor: string | null,
      value: unknown,
    ) => {
      const id_auditoria = stableId(`metadata:${entity}:${id}`);
      const payload = {
        accion: 'BACKEND_METADATA',
        entidad: entity,
        entidad_id: id,
        id_usuario: actor,
        datos_nuevos: json(value),
      };
      if (before.creditSchema === 'scaled') {
        await tx.$queryRawUnsafe(
          'SELECT fn_backend_audit($1::jsonb,true)::text AS saved',
          JSON.stringify({ id_auditoria, ...payload }),
        );
        return;
      }
      await tx.auditoria.upsert({
        where: { id_auditoria },
        create: { id_auditoria, ...payload },
        update: payload,
      });
    };
    for (const [id, value] of after.requestMetadata)
      if (!same(before.requestMetadata.get(id), value))
        await saveMetadata(
          'SOLICITUDES_INTERCAMBIO',
          id,
          after.requests.get(id)?.id_solicitante ?? null,
          value,
        );
    for (const [id, value] of after.reservationMetadata)
      if (!same(before.reservationMetadata.get(id), value))
        await saveMetadata(
          'RESERVAS',
          id,
          after.reservations.get(id)?.cancelado_por ??
            after.reservations.get(id)?.id_solicitante ??
            null,
          value,
        );
    for (const [scope, value] of after.idempotency)
      if (!before.idempotency.has(scope)) {
        const id_auditoria = stableId(`idempotency:${scope}`);
        await writeAudit({
          id_auditoria,
          id_usuario: scope.split(':')[0],
          accion: 'IDEMPOTENCY',
          entidad: 'OPERACIONES_BACKEND',
          entidad_id: id_auditoria,
          datos_nuevos: json({ scope, ...value }),
        });
      }
    for (const [id, entry] of after.adminAudit)
      if (!before.adminAudit.has(id))
        await writeAudit({
          id_auditoria: entry.id_auditoria,
          id_usuario: entry.id_usuario,
          accion: entry.accion,
          entidad: entry.entidad,
          entidad_id: entry.entidad_id,
          ...(entry.datos_anteriores
            ? { datos_anteriores: json(entry.datos_anteriores) }
            : {}),
          datos_nuevos: json(entry.datos_nuevos),
          created_at: entry.created_at,
        });
    if (before.creditSchema === 'scaled') return; // BD ya audita mediante triggers.
    // Historial seguro del cambio de entidades: no registrar password_hash.
    const auditRows = async <T>(
      entity: string,
      previous: Map<string, T>,
      next: Map<string, T>,
      actor: (row: T) => string | null,
    ) => {
      const sanitize = (row: T | undefined): unknown => {
        if (!row || typeof row !== 'object') return row;
        const safe = { ...row } as Record<string, unknown>;
        delete safe.password_hash;
        return safe;
      };
      for (const [id, row] of next)
        if (!same(previous.get(id), row))
          await tx.auditoria.create({
            data: {
              id_auditoria: randomUUID(),
              id_usuario: actor(row),
              accion: previous.has(id) ? 'UPDATE' : 'INSERT',
              entidad: entity,
              entidad_id: id,
              ...(previous.has(id)
                ? { datos_anteriores: json(sanitize(previous.get(id))) }
                : {}),
              datos_nuevos: json(sanitize(row)),
            },
          });
    };
    await auditRows(
      'USUARIOS',
      before.users,
      after.users,
      (row) => row.id_usuario,
    );
    await auditRows(
      'SOLICITUDES_INTERCAMBIO',
      before.requests,
      after.requests,
      (row) => row.id_solicitante,
    );
    await auditRows(
      'RESERVAS',
      before.reservations,
      after.reservations,
      (row) => row.cancelado_por ?? row.id_solicitante,
    );
  }

  async read<T>(reader: (state: ExchangeState) => T): Promise<T> {
    const client = await this.prisma.connect();
    return client.$transaction(
      async (tx) => structuredClone(reader(await this.load(tx))),
      { isolationLevel: 'RepeatableRead', timeout: 15000 },
    );
  }
  async transaction<T>(
    work: (state: ExchangeState) => Promise<T> | T,
  ): Promise<T> {
    const client = await this.prisma.connect();
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await client.$transaction(
          async (tx) => {
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(22603112)::text AS locked`;
            const before = await this.load(tx);
            const draft = structuredClone(before);
            const result = structuredClone(await work(draft));
            await this.persist(tx, before, draft);
            const saved = [...draft.idempotency].find(
              ([scope]) => !before.idempotency.has(scope),
            );
            return before.creditSchema === 'scaled' && saved
              ? (structuredClone(saved[1].result) as T)
              : result;
          },
          { isolationLevel: 'ReadCommitted', timeout: 15000, maxWait: 5000 },
        );
      } catch (error) {
        const code =
          typeof error === 'object' && error !== null && 'code' in error
            ? error.code
            : undefined;
        const sqlCode = postgresErrorCode(error);
        if (
          (code === 'P2034' || sqlCode === '40001' || sqlCode === '40P01') &&
          attempt < 2
        )
          continue;
        if (code === 'P2002' || sqlCode === '23505')
          throw new ConflictException('Un registro con esa clave ya existe');
        if (code === 'P2003' || sqlCode === '23503')
          throw new ConflictException(
            'La relacion de base de datos ya no es valida',
          );
        throw error;
      }
    }
    throw new ConflictException(
      'Conflicto concurrente; reintenta con la misma Idempotency-Key',
    );
  }
}
