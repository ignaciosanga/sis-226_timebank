import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  AcademicPeriodDto,
  ClassesQueryDto,
  CurriculumQueryDto,
  RoadmapUpdateDto,
} from './academic.dto';

export function academicPeriod(query: AcademicPeriodDto, now = new Date()) {
  const to = query.to ? new Date(query.to) : now;
  const from = query.from
    ? new Date(query.from)
    : new Date(to.getTime() - 30 * 86400000);
  if (
    ![from, to].every((d) => Number.isFinite(d.getTime())) ||
    from >= to ||
    to.getTime() - from.getTime() > 366 * 86400000
  )
    throw new BadRequestException(
      'Período inválido: from < to y máximo 366 días',
    );
  return { from, to, timezone: 'America/La_Paz', intervalo: '[from,to)' };
}

const validRating = `r.estado='Completada' AND r.fecha_fin <= now()
  AND r.id_solicitante<>r.id_ofertante AND c.id_evaluador=r.id_solicitante
  AND c.id_evaluado=r.id_ofertante AND c.puntuacion BETWEEN 1 AND 5`;
const courseFilter = `m.curriculum='systems' AND NOT m.externo
  AND ($3::text IS NULL OR m.codigo=$3) AND ($4::text IS NULL OR m.area=$4)
  AND ($5::integer IS NULL OR m.semestre=$5)`;

@Injectable()
export class AcademicRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private async client(academic = true) {
    if (this.config.get('PERSISTENCE_MODE') !== 'prisma')
      throw new ServiceUnavailableException(
        'Datos académicos y analíticos requieren PostgreSQL; no se simula persistencia',
      );
    const db = await this.prisma.connect();
    if (academic) {
      const [ready] = await db.$queryRawUnsafe<{ ready: boolean }[]>(
        `SELECT to_regclass('public."PROGRESO_ACADEMICO"') IS NOT NULL AS ready`,
      );
      if (!ready?.ready)
        throw new ServiceUnavailableException(
          'Esquema académico pendiente de coordinación y migración con BD',
        );
      const count = await db.$queryRawUnsafe<{ n: number }[]>(
        `SELECT count(*)::integer n FROM "MATERIAS_ACADEMICAS" WHERE curriculum='systems'`,
      );
      if (count[0]?.n !== 50)
        throw new ServiceUnavailableException(
          'Cargar el pensum académico validado (49 materias y requisito externo)',
        );
    }
    return db;
  }

  async curriculum(query: CurriculumQueryDto) {
    const db = await this.client();
    const courses = await db.$queryRawUnsafe(
      `SELECT m.codigo,m.nombre,m.semestre,m.area,m.externo,m.id_habilidad,
      COALESCE((SELECT json_agg(p.requisito ORDER BY p.requisito) FROM "PRERREQUISITOS_ACADEMICOS" p
        WHERE p.curriculum=m.curriculum AND p.codigo=m.codigo),'[]') requisitos
      FROM "MATERIAS_ACADEMICAS" m WHERE m.curriculum='systems'
      AND ($1::text IS NULL OR m.codigo=$1) AND ($2::text IS NULL OR m.area=$2)
      AND ($3::integer IS NULL OR m.semestre=$3) ORDER BY m.semestre,m.codigo`,
      query.codigo ?? null,
      query.area ?? null,
      query.semestre ?? null,
    );
    return {
      curriculum: 'systems',
      declaracion: 'manual_no_institucional',
      courses,
    };
  }

  async roadmap(actor: string) {
    const db = await this.client();
    const rows = await db.$queryRawUnsafe<{ codigo: string; estado: string }[]>(
      `SELECT codigo,estado FROM "PROGRESO_ACADEMICO" WHERE id_usuario=$1::uuid AND curriculum='systems' ORDER BY codigo`,
      actor,
    );
    return {
      curriculum: 'systems',
      courses: Object.fromEntries(rows.map((r) => [r.codigo, r.estado])),
    };
  }

  async updateRoadmap(actor: string, code: string, input: RoadmapUpdateDto) {
    const db = await this.client();
    return db.$transaction(async (tx) => {
      // Serializa solamente esta cuenta. Distintas materias no sobrescriben un documento entero.
      await tx.$queryRawUnsafe(
        'SELECT pg_advisory_xact_lock(hashtextextended($1,22603))::text',
        actor,
      );
      const [course] = await tx.$queryRawUnsafe<{ externo: boolean }[]>(
        `SELECT externo FROM "MATERIAS_ACADEMICAS" WHERE curriculum='systems' AND codigo=$1`,
        code,
      );
      if (!course || (course.externo && input.estado === 'current'))
        throw new BadRequestException(
          'Materia/estado inválido; MAT-030 solo approved/pending; electivas excluidas',
        );
      if (input.estado === 'pending')
        await tx.$executeRawUnsafe(
          `DELETE FROM "PROGRESO_ACADEMICO" WHERE id_usuario=$1::uuid AND curriculum='systems' AND codigo=$2`,
          actor,
          code,
        );
      else
        await tx.$executeRawUnsafe(
          `INSERT INTO "PROGRESO_ACADEMICO"(id_usuario,curriculum,codigo,estado)
        VALUES($1::uuid,'systems',$2,$3) ON CONFLICT(id_usuario,curriculum,codigo)
        DO UPDATE SET estado=EXCLUDED.estado,updated_at=now()`,
          actor,
          code,
          input.estado,
        );
      const rows = await tx.$queryRawUnsafe<
        { codigo: string; estado: string }[]
      >(
        `SELECT codigo,estado FROM "PROGRESO_ACADEMICO" WHERE id_usuario=$1::uuid AND curriculum='systems' ORDER BY codigo`,
        actor,
      );
      return {
        curriculum: 'systems',
        courses: Object.fromEntries(rows.map((r) => [r.codigo, r.estado])),
      };
    });
  }

  async commandCenter(query: AcademicPeriodDto) {
    const db = await this.client();
    const period = academicPeriod(query);
    const data = await db.$queryRawUnsafe(
      `SELECT m.codigo,m.nombre,m.area,m.semestre,
      (SELECT count(DISTINCT o.id_tutor)::integer FROM "OFERTAS" o JOIN "USUARIOS" u ON u.id_usuario=o.id_tutor
       JOIN "DISPONIBILIDADES" d ON d.id_disponibilidad=o.id_disponibilidad
       WHERE o.id_habilidad=m.id_habilidad AND o.estado='Activa' AND u.estado='Activo' AND d.estado='disponible' AND d.fecha_fin>now()) tutores_activos,
      (SELECT count(*)::integer FROM "OFERTAS" o JOIN "USUARIOS" u ON u.id_usuario=o.id_tutor
       JOIN "DISPONIBILIDADES" d ON d.id_disponibilidad=o.id_disponibilidad
       WHERE o.id_habilidad=m.id_habilidad AND o.estado='Activa' AND u.estado='Activo' AND d.estado='disponible' AND d.fecha_fin>now()) ofertas_activas,
      s.solicitudes, s.cubiertas, CASE WHEN s.solicitudes=0 THEN NULL ELSE s.cubiertas::float/s.solicitudes END tasa_cobertura,
      (SELECT count(*)::integer FROM "RESERVAS" r WHERE r.id_habilidad=m.id_habilidad AND r.created_at >= $1 AND r.created_at < $2) reservas,
      (s.solicitudes>=5 AND (SELECT count(DISTINCT o.id_tutor) FROM "OFERTAS" o JOIN "USUARIOS" u ON u.id_usuario=o.id_tutor
        JOIN "DISPONIBILIDADES" d ON d.id_disponibilidad=o.id_disponibilidad
        WHERE o.id_habilidad=m.id_habilidad AND o.estado='Activa' AND u.estado='Activo' AND d.estado='disponible' AND d.fecha_fin>now())<=1) alta_demanda_pocos_tutores,
      (SELECT count(*)::integer FROM "USUARIOS" u WHERE u.estado='Activo'
        AND EXISTS(SELECT 1 FROM "PROGRESO_ACADEMICO" p WHERE p.id_usuario=u.id_usuario AND p.curriculum=m.curriculum)
        AND NOT EXISTS(SELECT 1 FROM "PROGRESO_ACADEMICO" p WHERE p.id_usuario=u.id_usuario AND p.curriculum=m.curriculum AND p.codigo=m.codigo)
        AND NOT EXISTS(SELECT 1 FROM "PRERREQUISITOS_ACADEMICOS" pr WHERE pr.curriculum=m.curriculum AND pr.codigo=m.codigo
          AND NOT EXISTS(SELECT 1 FROM "PROGRESO_ACADEMICO" p WHERE p.id_usuario=u.id_usuario AND p.curriculum=pr.curriculum AND p.codigo=pr.requisito AND p.estado='approved'))) demanda_proyectada_estimada
      FROM "MATERIAS_ACADEMICAS" m CROSS JOIN LATERAL (
        SELECT count(*)::integer solicitudes,count(*) FILTER(WHERE EXISTS(SELECT 1 FROM "RESERVAS" r WHERE r.id_solicitud=s.id_solicitud AND r.estado<>'Cancelada'))::integer cubiertas
        FROM "SOLICITUDES_INTERCAMBIO" s WHERE s.id_habilidad=m.id_habilidad AND s.created_at >= $1 AND s.created_at < $2
      ) s WHERE ${courseFilter} ORDER BY m.semestre,m.codigo`,
      period.from,
      period.to,
      query.codigo ?? null,
      query.area ?? null,
      query.semestre ?? null,
    );
    return {
      period,
      snapshot_at: new Date(),
      proyeccion:
        'Estimación de elegibilidad según declaraciones manuales; no solicitudes futuras confirmadas',
      umbral_alerta: { solicitudes: 5, max_tutores: 1 },
      data,
    };
  }

  async ranking(query: AcademicPeriodDto) {
    const db = await this.client();
    const period = academicPeriod(query);
    const data = await db.$queryRawUnsafe(
      `SELECT m.codigo,r.id_ofertante tutor_id,
      count(DISTINCT r.id_reserva)::integer tutorias_completadas,
      count(c.id_calificacion)::integer opiniones, avg(c.puntuacion)::float promedio,
      CASE WHEN count(c.id_calificacion)>=3 THEN 'suficientes_para_orden_descriptivo' ELSE 'pocos_datos' END evidencia
      FROM "MATERIAS_ACADEMICAS" m JOIN "RESERVAS" r ON r.id_habilidad=m.id_habilidad
      LEFT JOIN "CALIFICACIONES" c ON c.id_reserva=r.id_reserva AND ${validRating}
      WHERE ${courseFilter} AND r.estado='Completada' AND r.id_ofertante<>r.id_solicitante
      AND r.fecha_fin<=now() AND r.completed_at >= $1 AND r.completed_at < $2
      GROUP BY m.codigo,r.id_ofertante ORDER BY (count(c.id_calificacion)>=3) DESC,
      avg(c.puntuacion) DESC NULLS LAST,count(c.id_calificacion) DESC,m.codigo,r.id_ofertante`,
      period.from,
      period.to,
      query.codigo ?? null,
      query.area ?? null,
      query.semestre ?? null,
    );
    return {
      period,
      knowledge_score: null,
      cancelaciones_injustificadas: null,
      formula_estado: 'pendiente_aprobacion_PO',
      data,
    };
  }

  async classes(actor: string, query: ClassesQueryDto) {
    const db = await this.client(false);
    const period = academicPeriod(query);
    // El historial no depende del pensum. Filtros académicos se ofrecen en los indicadores.
    if (query.codigo || query.area || query.semestre)
      throw new BadRequestException('Mis clases admite from, to, page y limit');
    return db.$transaction(
      async (tx) => {
        const data = await tx.$queryRawUnsafe(
          `SELECT r.id_reserva,r.id_habilidad,h.nombre materia,
        CASE WHEN r.id_solicitante=$1::uuid THEN 'aprendi' ELSE 'ensene' END participacion,
        r.fecha_inicio,r.fecha_fin,r.completed_at,EXTRACT(EPOCH FROM r.fecha_fin-r.fecha_inicio)::float/3600 horas,
        r.creditos::text creditos,c.puntuacion calificacion,c.comentario
        FROM "RESERVAS" r JOIN "HABILIDADES" h USING(id_habilidad)
        LEFT JOIN "CALIFICACIONES" c ON c.id_reserva=r.id_reserva AND ${validRating}
        WHERE (r.id_solicitante=$1::uuid OR r.id_ofertante=$1::uuid) AND r.estado='Completada' AND r.fecha_fin<=now()
        AND r.completed_at >= $2 AND r.completed_at < $3
        ORDER BY r.completed_at DESC,r.id_reserva LIMIT $4 OFFSET $5`,
          actor,
          period.from,
          period.to,
          query.limit,
          (query.page - 1) * query.limit,
        );
        const summary = await tx.$queryRawUnsafe<
          {
            participacion: string;
            clases: number;
            horas: number;
            creditos: string;
            materias: number;
            opiniones: number;
            promedio: number | null;
          }[]
        >(
          `SELECT
        CASE WHEN r.id_solicitante=$1::uuid THEN 'aprendi' ELSE 'ensene' END participacion,
        count(*)::integer clases,COALESCE(sum(EXTRACT(EPOCH FROM r.fecha_fin-r.fecha_inicio)/3600),0)::float horas,
        COALESCE(sum(r.creditos),0)::text creditos,count(DISTINCT r.id_habilidad)::integer materias,
        count(c.id_calificacion)::integer opiniones,avg(c.puntuacion)::float promedio
        FROM "RESERVAS" r LEFT JOIN "CALIFICACIONES" c ON c.id_reserva=r.id_reserva AND ${validRating}
        WHERE (r.id_solicitante=$1::uuid OR r.id_ofertante=$1::uuid) AND r.estado='Completada' AND r.fecha_fin<=now()
        AND r.completed_at >= $2 AND r.completed_at < $3 GROUP BY 1`,
          actor,
          period.from,
          period.to,
        );
        const total = summary.reduce((sum, row) => sum + row.clases, 0);
        return {
          period,
          data,
          meta: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.ceil(total / query.limit),
          },
          resumen: Object.fromEntries(
            ['aprendi', 'ensene'].map((role) => [
              role,
              summary.find((r) => r.participacion === role) ?? {
                clases: 0,
                horas: 0,
                creditos: '0',
                materias: 0,
                opiniones: 0,
                promedio: null,
              },
            ]),
          ),
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  async economy(query: AcademicPeriodDto) {
    const db = await this.client();
    const period = academicPeriod(query);
    return db.$transaction(
      async (tx) => {
        const prices = await tx.$queryRawUnsafe(
          `SELECT 'publicado' tipo,o.costo_creditos::text creditos,count(*)::integer cantidad
        FROM "OFERTAS" o JOIN "MATERIAS_ACADEMICAS" m ON m.id_habilidad=o.id_habilidad
        WHERE ${courseFilter} AND o.created_at >= $1 AND o.created_at < $2 GROUP BY o.costo_creditos
        UNION ALL SELECT 'pactado',r.creditos::text,count(*)::integer FROM "RESERVAS" r
        JOIN "MATERIAS_ACADEMICAS" m ON m.id_habilidad=r.id_habilidad
        WHERE ${courseFilter} AND r.created_at >= $1 AND r.created_at < $2 GROUP BY r.creditos
        ORDER BY 1,2`,
          period.from,
          period.to,
          query.codigo ?? null,
          query.area ?? null,
          query.semestre ?? null,
        );
        const hours = await tx.$queryRawUnsafe(
          `SELECT EXTRACT(HOUR FROM r.fecha_inicio AT TIME ZONE 'America/La_Paz')::integer hora,
        count(*)::integer reservas,count(*) FILTER(WHERE r.estado='Cancelada')::integer cancelaciones
        FROM "RESERVAS" r JOIN "MATERIAS_ACADEMICAS" m ON m.id_habilidad=r.id_habilidad
        WHERE ${courseFilter} AND r.fecha_inicio >= $1 AND r.fecha_inicio < $2 GROUP BY 1 ORDER BY 1`,
          period.from,
          period.to,
          query.codigo ?? null,
          query.area ?? null,
          query.semestre ?? null,
        );
        const [inactivity] = (await tx.$queryRawUnsafe(
          `SELECT count(*)::integer cuentas_sin_movimientos,
        COALESCE(sum(u.saldo),0)::text saldo_actual_sin_movimientos,
        COALESCE(sum(u.creditos_retenidos),0)::text retenidos_actuales_sin_movimientos
        FROM "USUARIOS" u WHERE u.estado='Activo' AND u.fecha_registro < $1
        AND NOT EXISTS(SELECT 1 FROM "MOVIMIENTOS_CREDITO" mc WHERE mc.id_usuario=u.id_usuario AND mc.created_at >= $1 AND mc.created_at < $2)`,
          period.from,
          period.to,
        )) as Record<string, unknown>[];
        const cancellations = await tx.$queryRawUnsafe(
          `SELECT count(*)::integer registradas,
        count(*) FILTER(WHERE r.cancelado_por=r.id_solicitante)::integer por_solicitante,
        count(*) FILTER(WHERE r.cancelado_por=r.id_ofertante)::integer por_ofertante,
        count(*) FILTER(WHERE r.cancelado_por<>r.id_solicitante AND r.cancelado_por<>r.id_ofertante)::integer por_administrador,
        avg(r.horas_anticipacion_cancelacion)::float anticipacion_media_horas
        FROM "RESERVAS" r JOIN "MATERIAS_ACADEMICAS" m ON m.id_habilidad=r.id_habilidad
        WHERE ${courseFilter} AND r.estado='Cancelada' AND r.cancelled_at >= $1 AND r.cancelled_at < $2`,
          period.from,
          period.to,
          query.codigo ?? null,
          query.area ?? null,
          query.semestre ?? null,
        );
        return {
          period,
          precios: prices,
          horarios: hours,
          cancelaciones: cancellations,
          reglas_economia: {
            estado: 'pendiente_migracion_BD',
            factores: null,
            umbral_cancelacion_horas: null,
            penalizacion: null,
          },
          inactividad: {
            ...inactivity,
            poblacion:
              'Todas las cuentas activas anteriores al inicio; no segmentada por materia',
            definicion:
              'Sin movimientos en el período; saldos actuales, no históricos',
            criterio_sin_uso_PO: null,
          },
          cancelaciones_injustificadas: null,
          incentivos: 'No aplicados',
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
}
