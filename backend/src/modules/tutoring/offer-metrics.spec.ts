import {
  type ExchangeState,
  type Reservation,
  ReservationStatus,
} from '../exchanges/exchange.types';
import { MemoryExchangeRepository } from '../exchanges/memory-exchange.repository';
import { offerMetrics, type OfferRating } from './offer-metrics';

const NOW = Date.parse('2030-01-02T00:00:00Z');

function reservation(
  id: string,
  overrides: Partial<Reservation> = {},
): Reservation {
  return {
    id_reserva: id,
    id_solicitud: null,
    id_solicitante: `student-${id}`,
    id_ofertante: 'tutor',
    id_habilidad: 'skill',
    fecha_inicio: new Date('2030-01-01T10:00:00Z'),
    fecha_fin: new Date('2030-01-01T10:45:00Z'),
    creditos: 3,
    modalidad: 'Virtual',
    lugar: 'Por coordinar',
    estado: ReservationStatus.COMPLETADA,
    confirmacion_solicitante_at: new Date('2030-01-01T10:45:00Z'),
    confirmacion_ofertante_at: new Date('2030-01-01T10:45:00Z'),
    cancelado_por: null,
    motivo_cancelacion: null,
    horas_anticipacion_cancelacion: null,
    created_at: new Date('2029-12-31T00:00:00Z'),
    completed_at: new Date('2030-01-01T10:45:00Z'),
    cancelled_at: null,
    ...overrides,
  };
}

function rating(
  id: string,
  score: number,
  overrides: Partial<OfferRating> = {},
): OfferRating {
  return {
    id_calificacion: `rating-${id}`,
    id_reserva: id,
    id_evaluador: `student-${id}`,
    id_evaluado: 'tutor',
    puntuacion: score,
    comentario: null,
    created_at: new Date('2030-01-01T11:00:00Z'),
    ...overrides,
  };
}

async function emptyState(): Promise<ExchangeState> {
  return new MemoryExchangeRepository().read((state) => state);
}

describe('Métricas de ofertas por tutor y materia', () => {
  it('distingue ausencia de opiniones de una calificación cero', async () => {
    const state = await emptyState();
    expect(offerMetrics(state, 'tutor', 'skill', NOW)).toEqual({
      promedio: null,
      opiniones: 0,
      tutorias_completadas: 0,
    });
    state.reservations.set('one', reservation('one'));
    expect(offerMetrics(state, 'tutor', 'skill', NOW)).toEqual({
      promedio: null,
      opiniones: 0,
      tutorias_completadas: 1,
    });
  });

  it('calcula opiniones reales sin mezclar materias ni tutores', async () => {
    const state = await emptyState();
    state.reservations.set('one', reservation('one'));
    state.reservations.set('two', reservation('two'));
    state.reservations.set('unrated', reservation('unrated'));
    state.reservations.set(
      'other-skill',
      reservation('other-skill', { id_habilidad: 'other-skill' }),
    );
    state.reservations.set(
      'other-tutor',
      reservation('other-tutor', { id_ofertante: 'other-tutor' }),
    );
    state.ratings.set('one', rating('one', 4));
    state.ratings.set('two', rating('two', 5));
    state.ratings.set('other-skill', rating('other-skill', 1));
    state.ratings.set(
      'other-tutor',
      rating('other-tutor', 1, { id_evaluado: 'other-tutor' }),
    );

    expect(offerMetrics(state, 'tutor', 'skill', NOW)).toEqual({
      promedio: 4.5,
      opiniones: 2,
      tutorias_completadas: 3,
    });
  });

  it('excluye opiniones inversas, ajenas, sin reserva y autoevaluaciones', async () => {
    const state = await emptyState();
    state.reservations.set('one', reservation('one'));
    state.reservations.set(
      'self',
      reservation('self', { id_solicitante: 'tutor' }),
    );
    state.ratings.set(
      'reverse',
      rating('one', 1, {
        id_evaluador: 'tutor',
        id_evaluado: 'student-one',
      }),
    );
    state.ratings.set(
      'foreign',
      rating('one', 1, { id_evaluador: 'outsider' }),
    );
    state.ratings.set(
      'wrong-target',
      rating('one', 1, { id_evaluado: 'other' }),
    );
    state.ratings.set('orphan', rating('unknown-reservation', 1));
    state.ratings.set('self', rating('self', 5, { id_evaluador: 'tutor' }));

    expect(offerMetrics(state, 'tutor', 'skill', NOW)).toEqual({
      promedio: null,
      opiniones: 0,
      tutorias_completadas: 1,
    });
  });

  it.each([ReservationStatus.CONFIRMADA, ReservationStatus.CANCELADA])(
    'excluye reservas %s aunque tengan una opinión',
    async (status) => {
      const state = await emptyState();
      state.reservations.set('one', reservation('one', { estado: status }));
      state.ratings.set('one', rating('one', 5));
      expect(offerMetrics(state, 'tutor', 'skill', NOW)).toEqual({
        promedio: null,
        opiniones: 0,
        tutorias_completadas: 0,
      });
    },
  );

  it('excluye el fin futuro y acepta el límite exacto de fin', async () => {
    const state = await emptyState();
    state.reservations.set(
      'future',
      reservation('future', { fecha_fin: new Date(NOW + 1) }),
    );
    state.reservations.set(
      'boundary',
      reservation('boundary', { fecha_fin: new Date(NOW) }),
    );
    state.ratings.set('future', rating('future', 1));
    state.ratings.set('boundary', rating('boundary', 5));
    expect(offerMetrics(state, 'tutor', 'skill', NOW)).toEqual({
      promedio: 5,
      opiniones: 1,
      tutorias_completadas: 1,
    });
  });

  it.each([0, 6, 4.5, Number.NaN])(
    'excluye puntuación incompatible %s sin inventar promedio',
    async (score) => {
      const state = await emptyState();
      state.reservations.set('one', reservation('one'));
      state.ratings.set('one', rating('one', score));
      expect(offerMetrics(state, 'tutor', 'skill', NOW)).toEqual({
        promedio: null,
        opiniones: 0,
        tutorias_completadas: 1,
      });
    },
  );
});
