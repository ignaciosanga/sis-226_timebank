import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { ListQueryDto, paginate } from '../../common/dto/list-query.dto';
import {
  EXCHANGE_REPOSITORY,
  ExchangeRepository,
} from '../exchanges/exchange.repository';
import { ExchangeState, ReservationStatus } from '../exchanges/exchange.types';
import { OfferRating, offerMetrics } from '../tutoring/offer-metrics';
import { ReviewDto, ReviewsQueryDto } from './academic.dto';

export function validReviews(
  state: ExchangeState,
  now = Date.now(),
): OfferRating[] {
  return [...state.ratings.values()].filter((review) => {
    const r = state.reservations.get(review.id_reserva);
    return (
      r &&
      r.estado === ReservationStatus.COMPLETADA &&
      r.fecha_fin.getTime() <= now &&
      r.id_solicitante !== r.id_ofertante &&
      review.id_evaluador === r.id_solicitante &&
      review.id_evaluado === r.id_ofertante &&
      Number.isInteger(review.puntuacion) &&
      review.puntuacion >= 1 &&
      review.puntuacion <= 5
    );
  });
}

function response(review: OfferRating) {
  return {
    id_calificacion: review.id_calificacion,
    id_reserva: review.id_reserva,
    calificacion: review.puntuacion,
    comentario: review.comentario ?? '',
    created_at: review.created_at,
  };
}

@Injectable()
export class ReviewsService {
  constructor(
    @Inject(EXCHANGE_REPOSITORY)
    private readonly repository: ExchangeRepository,
  ) {}

  create(actor: string, reservationId: string, input: ReviewDto, key?: string) {
    if (!key || !/^[A-Za-z0-9._:-]{16,128}$/.test(key))
      throw new BadRequestException(
        'Idempotency-Key requerida: 16–128 caracteres',
      );
    const fingerprint = createHash('sha256')
      .update(
        JSON.stringify([reservationId, input.calificacion, input.comentario]),
      )
      .digest('hex');
    return this.repository.transaction((state) => {
      const r = state.reservations.get(reservationId);
      if (!r) throw new NotFoundException('Reserva no encontrada');
      if (r.id_solicitante !== actor || r.id_ofertante === actor)
        throw new ForbiddenException('Solo quien aprendió puede calificar');
      const scope = `${actor}:review:${key}`;
      const prior = state.idempotency.get(scope);
      if (prior) {
        if (prior.fingerprint !== fingerprint)
          throw new ConflictException(
            'Idempotency-Key usada con otro contenido',
          );
        return prior.result;
      }
      if (
        r.estado !== ReservationStatus.COMPLETADA ||
        r.fecha_fin.getTime() > Date.now()
      )
        throw new ConflictException(
          'La clase debe estar completada y haber finalizado',
        );
      if (
        [...state.ratings.values()].some(
          (review) => review.id_reserva === reservationId,
        )
      )
        throw new ConflictException('La reserva ya tiene una opinión');
      const review: OfferRating = {
        id_calificacion: randomUUID(),
        id_reserva: reservationId,
        id_evaluador: actor,
        id_evaluado: r.id_ofertante,
        puntuacion: input.calificacion,
        comentario: input.comentario,
        created_at: new Date(),
      };
      state.ratings.set(review.id_calificacion, review);
      const result = response(review);
      state.idempotency.set(scope, { fingerprint, result });
      return result;
    });
  }

  list(query: ListQueryDto, actor?: string, filter?: ReviewsQueryDto) {
    return this.repository.read((state) =>
      paginate(
        validReviews(state)
          .filter((review) =>
            actor
              ? review.id_evaluador === actor
              : review.id_evaluado === filter!.tutorId &&
                state.reservations.get(review.id_reserva)!.id_habilidad ===
                  filter!.skillId,
          )
          .sort(
            (a, b) =>
              b.created_at.getTime() - a.created_at.getTime() ||
              a.id_calificacion.localeCompare(b.id_calificacion),
          )
          .map(response),
        query,
      ),
    );
  }

  reputation(query: ReviewsQueryDto) {
    return this.repository.read((state) => ({
      tutorId: query.tutorId,
      skillId: query.skillId,
      ...offerMetrics(state, query.tutorId, query.skillId),
      knowledge_score: null,
      cancelaciones_injustificadas: null,
      formula_estado: 'pendiente_aprobacion_PO',
    }));
  }
}
