import { isMap } from 'node:util/types';
const serialize = (value: unknown) =>
  JSON.stringify(value, (_key, entry: unknown) =>
    isMap(entry) ? [...entry] : entry,
  );
import { AvailabilityStatus } from '../../common/enums/record-status.enum';
import { ExchangeState, ReservationStatus } from './exchange.types';
import { inspectIntegrity } from './integrity';
import { MemoryExchangeRepository } from './memory-exchange.repository';
import { addReservation } from './test-fixtures';

async function fixture(
  status = ReservationStatus.CONFIRMADA,
): Promise<ExchangeState> {
  const store = new MemoryExchangeRepository();
  await store.transaction((state) => addReservation(state, { status }));
  return store.read((state) => state);
}
describe('Integridad de las 12 tablas optimizadas', () => {
  it.each(Object.values(ReservationStatus))(
    'valida ledger y estado %s',
    async (status) => {
      expect(inspectIntegrity(await fixture(status))).toEqual([]);
    },
  );
  const corruptions: Array<[string, (state: ExchangeState) => void]> = [
    [
      'saldo negativo',
      (s) => {
        s.users.get('student')!.saldo = -1;
      },
    ],
    [
      'saldo desbordado',
      (s) => {
        s.users.get('student')!.saldo = 2147483648;
      },
    ],
    [
      'retenidos negativos',
      (s) => {
        s.users.get('student')!.creditos_retenidos = -1;
      },
    ],
    [
      'retenidos mayores al saldo',
      (s) => {
        s.users.get('student')!.creditos_retenidos = 100;
      },
    ],
    [
      'retencion perdida',
      (s) => {
        s.users.get('student')!.creditos_retenidos = 0;
      },
    ],
    [
      'usuario mal indexado',
      (s) => {
        s.users.get('student')!.id_usuario = 'other';
      },
    ],
    [
      'usuario ausente',
      (s) => {
        s.users.delete('student');
      },
    ],
    [
      'movimiento huerfano',
      (s) => {
        s.movements.get('hold-r1')!.id_usuario = 'missing';
      },
    ],
    [
      'importe incorrecto',
      (s) => {
        s.movements.get('hold-r1')!.cantidad = 3;
      },
    ],
    [
      'snapshot invalido',
      (s) => {
        s.movements.get('hold-r1')!.saldo_anterior = -1;
      },
    ],
    [
      'snapshot descuadrado',
      (s) => {
        s.movements.get('hold-r1')!.saldo_posterior = 39;
      },
    ],
    [
      'movimiento reserva inexistente',
      (s) => {
        s.movements.get('hold-r1')!.id_reserva = 'missing';
      },
    ],
    [
      'movimiento sin reserva',
      (s) => {
        s.movements.get('hold-r1')!.id_reserva = null;
      },
    ],
    [
      'movimiento duplicado',
      (s) => {
        s.movements.set('dup', {
          ...s.movements.get('hold-r1')!,
          id_movimiento: 'dup',
        });
      },
    ],
    [
      'fecha movimiento invalida',
      (s) => {
        s.movements.get('hold-r1')!.created_at = new Date('invalid');
      },
    ],
    [
      'solicitud ausente',
      (s) => {
        s.requests.clear();
      },
    ],
    [
      'solicitud incompatible',
      (s) => {
        s.requests.get('request-r1')!.id_habilidad = 'other';
      },
    ],
    [
      'precio solicitud incorrecto',
      (s) => {
        s.requests.get('request-r1')!.creditos_requeridos = 5;
      },
    ],
    [
      'respuesta solicitud ausente',
      (s) => {
        s.requests.get('request-r1')!.respondida_at = null;
      },
    ],
    [
      'reserva duplicada por solicitud',
      (s) => {
        s.reservations.set('dup', {
          ...s.reservations.get('r1')!,
          id_reserva: 'dup',
        });
      },
    ],
    [
      'mismos participantes',
      (s) => {
        s.reservations.get('r1')!.id_ofertante = 'student';
      },
    ],
    [
      'precio reserva incorrecto',
      (s) => {
        s.reservations.get('r1')!.creditos = 3;
      },
    ],
    [
      'intervalo invalido',
      (s) => {
        s.reservations.get('r1')!.fecha_fin =
          s.reservations.get('r1')!.fecha_inicio;
      },
    ],
    [
      'horario inexistente',
      (s) => {
        s.availability.clear();
      },
    ],
    [
      'horario cancelado',
      (s) => {
        s.availability.get('availability-provider')!.estado =
          AvailabilityStatus.CANCELADO;
      },
    ],
    [
      'horario fuera de cobertura',
      (s) => {
        s.availability.get('availability-provider')!.fecha_fin = new Date(
          '2029-01-01',
        );
      },
    ],
    [
      'horario otro usuario',
      (s) => {
        s.availability.get('availability-provider')!.id_usuario = 'other';
      },
    ],
    [
      'dos confirmaciones sin liquidar',
      (s) => {
        const r = s.reservations.get('r1')!;
        r.confirmacion_solicitante_at = r.fecha_fin;
        r.confirmacion_ofertante_at = r.fecha_fin;
      },
    ],
    [
      'cancelacion en reserva activa',
      (s) => {
        s.reservations.get('r1')!.cancelado_por = 'student';
      },
    ],
  ];
  it.each(corruptions)(
    'detecta %s sin modificar datos',
    async (_name, corrupt) => {
      const state = await fixture();
      corrupt(state);
      const before = serialize(state);
      expect(inspectIntegrity(state).length).toBeGreaterThan(0);
      expect(serialize(state)).toEqual(before);
    },
  );
  it.each(['confirmacion', 'movimiento', 'timestamp'])(
    'detecta liquidacion incompleta: %s',
    async (kind) => {
      const s = await fixture(ReservationStatus.COMPLETADA);
      if (kind === 'confirmacion')
        s.reservations.get('r1')!.confirmacion_solicitante_at = null;
      if (kind === 'movimiento') s.movements.delete('Transferencia-r1');
      if (kind === 'timestamp') s.reservations.get('r1')!.completed_at = null;
      expect(inspectIntegrity(s).length).toBeGreaterThan(0);
    },
  );
  it('detecta cancelacion sin liberacion', async () => {
    const s = await fixture(ReservationStatus.CANCELADA);
    s.movements.delete('release-r1');
    expect(inspectIntegrity(s).length).toBeGreaterThan(0);
  });
  it.each([false, true])(
    'detecta cruces de participantes, roles invertidos=%s',
    async (swapped) => {
      const s = await fixture();
      addReservation(s, {
        id: 'r2',
        requester: swapped ? 'provider' : 'student',
        provider: 'other',
      });
      expect(
        inspectIntegrity(s).some(
          (i) => i.code === 'PARTICIPANT_RESERVATION_OVERLAP',
        ),
      ).toBe(true);
    },
  );
  it('permite intervalos contiguos', async () => {
    const s = await fixture();
    addReservation(s, { id: 'r2', hour: 11 });
    expect(inspectIntegrity(s)).toEqual([]);
  });
});
