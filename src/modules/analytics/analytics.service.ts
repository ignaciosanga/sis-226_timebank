import { BadRequestException, Injectable } from '@nestjs/common';
import { UserStatus } from '../../common/enums/record-status.enum';
import {
  RequestStatus,
  ReservationStatus,
} from '../exchanges/exchange.types';
import { AnalyticsRepository } from './analytics.repository';
import { AnalyticsQueryDto, Period } from './dto/analytics-query.dto';

const DEFAULT_DAYS = 30;
/** Tasa en porcentaje con dos decimales; null cuando el denominador es cero. */
const rate = (part: number, total: number): number | null =>
  total > 0 ? Math.round((part / total) * 10000) / 100 : null;

@Injectable()
export class AnalyticsService {
  constructor(private readonly repository: AnalyticsRepository) {}

  /** Periodo [from, to); por defecto los ultimos 30 dias hasta ahora. */
  resolvePeriod(query: AnalyticsQueryDto): Period {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - DEFAULT_DAYS * 86400000);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()))
      throw new BadRequestException('Fechas invalidas');
    if (from >= to)
      throw new BadRequestException('from debe ser anterior a to');
    return { from, to };
  }
  private periodView(period: Period) {
    return { from: period.from.toISOString(), to: period.to.toISOString() };
  }

  async overview(query: AnalyticsQueryDto) {
    const period = this.resolvePeriod(query);
    const [users, requests, completed, cancelled, movements, balances] =
      await Promise.all([
        this.repository.usersByStatus(),
        this.repository.requestsByStatus(),
        this.repository.completedReservations(period),
        this.repository.cancelledReservations(period),
        this.repository.movementsByType(period),
        this.repository.currentBalances(),
      ]);
    return {
      periodo: this.periodView(period),
      usuarios: {
        total: Object.values(users).reduce((sum, n) => sum + n, 0),
        activos: users[UserStatus.ACTIVO],
        inactivos: users[UserStatus.INACTIVO],
        suspendidos: users[UserStatus.SUSPENDIDO],
      },
      solicitudes: {
        totalHistorico: Object.values(requests).reduce((s, n) => s + n, 0),
      },
      intercambios: {
        completados: completed.cantidad,
        cancelados: cancelled,
        minutosProgramados: completed.minutos,
        horasProgramadas: Math.round((completed.minutos / 60) * 100) / 100,
      },
      creditos: {
        transferidos: movements.Transferencia?.creditos ?? '0',
        retenidosActuales: balances.retenidos,
        saldoTotalActual: balances.saldo,
      },
    };
  }

  async users(query: AnalyticsQueryDto) {
    const period = this.resolvePeriod(query);
    const [byStatus, byCareer, nuevos, serie, conHabilidades] =
      await Promise.all([
        this.repository.usersByStatus(),
        this.repository.usersByCareer(),
        this.repository.newUsers(period),
        this.repository.usersSeries(period, query.groupBy),
        this.repository.usersWithSkills(),
      ]);
    return {
      periodo: this.periodView(period),
      total: Object.values(byStatus).reduce((sum, n) => sum + n, 0),
      porEstado: byStatus,
      porCarrera: byCareer,
      nuevosEnPeriodo: nuevos,
      registrosPorPeriodo: serie,
      conHabilidadesPublicadas: conHabilidades,
    };
  }

  async exchanges(query: AnalyticsQueryDto) {
    const period = this.resolvePeriod(query);
    const [
      requestStatus,
      requestsCreated,
      reservationStatus,
      reservationsCreated,
      completed,
      cancelled,
      serie,
    ] = await Promise.all([
      this.repository.requestsByStatus(),
      this.repository.requestsCreated(period),
      this.repository.reservationsByStatus(),
      this.repository.reservationsCreated(period),
      this.repository.completedReservations(period),
      this.repository.cancelledReservations(period),
      this.repository.completedSeries(period, query.groupBy),
    ]);
    const resolved = completed.cantidad + cancelled;
    return {
      periodo: this.periodView(period),
      solicitudes: {
        creadasEnPeriodo: requestsCreated,
        estadoActual: {
          solicitadas: requestStatus[RequestStatus.PENDIENTE],
          aceptadas: requestStatus[RequestStatus.ACEPTADA],
          rechazadas: requestStatus[RequestStatus.RECHAZADA],
          canceladas: requestStatus[RequestStatus.CANCELADA],
        },
      },
      reservas: {
        creadasEnPeriodo: reservationsCreated,
        estadoActual: {
          confirmadas: reservationStatus[ReservationStatus.CONFIRMADA],
          completadas: reservationStatus[ReservationStatus.COMPLETADA],
          canceladas: reservationStatus[ReservationStatus.CANCELADA],
        },
        completadasEnPeriodo: completed.cantidad,
        canceladasEnPeriodo: cancelled,
        minutosProgramadosCompletadas: completed.minutos,
        horasProgramadasCompletadas:
          Math.round((completed.minutos / 60) * 100) / 100,
        creditosCompletadas: completed.creditos,
      },
      tasas: {
        finalizacion: rate(completed.cantidad, resolved),
        cancelacion: rate(cancelled, resolved),
        denominador: resolved,
      },
      completadasPorPeriodo: serie,
    };
  }

  async credits(query: AnalyticsQueryDto) {
    const period = this.resolvePeriod(query);
    const [movements, balances, serie] = await Promise.all([
      this.repository.movementsByType(period),
      this.repository.currentBalances(),
      this.repository.transfersSeries(period, query.groupBy),
    ]);
    const sum = (type: string) => movements[type]?.creditos ?? '0';
    return {
      periodo: this.periodView(period),
      transferidos: sum('Transferencia'),
      liberadosPorCancelacion: sum('Liberacion'),
      bonosIniciales: sum('BonoInicial'),
      recompensas: sum('Recompensa'),
      ajustes: sum('Ajuste'),
      penalizaciones: sum('Penalizacion'),
      retenidosActuales: balances.retenidos,
      saldoTotalActual: balances.saldo,
      transferidosPorPeriodo: serie,
      movimientosPorTipo: movements,
    };
  }

  async skills(query: AnalyticsQueryDto) {
    const period = this.resolvePeriod(query);
    const [totals, byCategory, requested, completed, categories, providers] =
      await Promise.all([
        this.repository.skillTotals(),
        this.repository.skillsByCategory(),
        this.repository.mostRequestedSkills(period, query.limit),
        this.repository.mostCompletedSkills(period, query.limit),
        this.repository.completedByCategory(period),
        this.repository.providersPerSkill(query.limit),
      ]);
    return {
      periodo: this.periodView(period),
      totalActivas: totals.total,
      ofrecidasPorEstudiantes: totals.ofrecidas,
      porCategoria: byCategory,
      masSolicitadas: requested,
      masCompletadas: completed,
      completadasPorCategoria: categories,
      estudiantesPorHabilidad: providers,
    };
  }
}
