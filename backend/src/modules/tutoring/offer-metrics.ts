import {
  type ExchangeState,
  ReservationStatus,
} from '../exchanges/exchange.types';

/** Lectura de CALIFICACIONES; esta fase no incorpora escritura de opiniones. */
export interface OfferRating {
  id_calificacion: string;
  id_reserva: string;
  id_evaluador: string;
  id_evaluado: string;
  puntuacion: number;
  comentario: string | null;
  created_at: Date;
}

export function offerMetrics(
  state: ExchangeState,
  tutorId: string,
  skillId: string,
  now = Date.now(),
): {
  promedio: number | null;
  opiniones: number;
  tutorias_completadas: number;
} {
  const completed = new Map(
    [...state.reservations.values()]
      .filter(
        (reservation) =>
          reservation.id_ofertante === tutorId &&
          reservation.id_habilidad === skillId &&
          reservation.id_solicitante !== tutorId &&
          reservation.estado === ReservationStatus.COMPLETADA &&
          reservation.fecha_fin.getTime() <= now,
      )
      .map((reservation) => [reservation.id_reserva, reservation]),
  );

  const ratings = [...state.ratings.values()].filter((rating) => {
    const reservation = completed.get(rating.id_reserva);
    return (
      !!reservation &&
      rating.id_evaluado === tutorId &&
      rating.id_evaluador === reservation.id_solicitante &&
      Number.isInteger(rating.puntuacion) &&
      rating.puntuacion >= 1 &&
      rating.puntuacion <= 5
    );
  });

  return {
    promedio: ratings.length
      ? ratings.reduce((sum, rating) => sum + rating.puntuacion, 0) /
        ratings.length
      : null,
    opiniones: ratings.length,
    tutorias_completadas: completed.size,
  };
}
