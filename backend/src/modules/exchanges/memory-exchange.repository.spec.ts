import { AvailabilityStatus } from '../../common/enums/record-status.enum';
import { ExchangeState } from './exchange.types';
import { storedUser } from './test-fixtures';
import { MemoryExchangeRepository } from './memory-exchange.repository';

describe('MemoryExchangeRepository', () => {
  let repository: MemoryExchangeRepository;
  const account = (userId = 'student') => storedUser(userId, 1000);

  beforeEach(() => {
    repository = new MemoryExchangeRepository();
  });

  it('confirma los datos y devuelve Map, Date y creditos INTEGER preservados', async () => {
    const now = new Date('2030-01-01T10:00:00Z');
    const result = await repository.transaction((state) => {
      state.users.set('student', account());
      state.movements.set('movement', {
        id_movimiento: 'movement',
        id_usuario: 'student',
        id_reserva: null,
        tipo: 'Ajuste',
        cantidad: 1000,
        created_at: now,
        saldo_anterior: 0,
        saldo_posterior: 1000,
        retenidos_anterior: 0,
        retenidos_posterior: 0,
        descripcion: null,
      });
      return state;
    });
    expect(result.users.get('student')).toEqual(account());
    expect(result.movements.get('movement')?.created_at.getTime()).toBe(
      now.getTime(),
    );
    expect(await repository.read((state) => state.users.size)).toBe(1);
  });

  it('revierte todas las escrituras si falla despues de alterar varios registros', async () => {
    await repository.transaction((state) => {
      state.users.set('student', account());
    });
    const before = await repository.read((state) => state);
    await expect(
      repository.transaction((state) => {
        state.users.get('student')!.saldo -= 100;
        state.users.get('student')!.creditos_retenidos += 100;
        state.users.set('provider', account('provider'));
        state.movements.set('hold', {
          id_movimiento: 'hold',
          id_usuario: 'student',
          id_reserva: 'reservation',
          tipo: 'Retencion',
          cantidad: 100,
          created_at: new Date(),
          saldo_anterior: 1000,
          saldo_posterior: 900,
          retenidos_anterior: 0,
          retenidos_posterior: 100,
          descripcion: null,
        });
        state.idempotency.set('key', {
          fingerprint: 'operation',
          result: { accepted: true },
        });
        throw new Error('fallo inducido antes del commit');
      }),
    ).rejects.toThrow('fallo inducido antes del commit');
    expect(await repository.read((state) => state)).toEqual(before);
  });

  it('revierte un fallo asincrono y libera la cola para la siguiente operacion', async () => {
    const failing = repository.transaction(async (state) => {
      state.users.set('discarded', account('discarded'));
      await Promise.resolve();
      throw new Error('fallo asincrono');
    });
    const succeeding = repository.transaction((state) => {
      expect(state.users.has('discarded')).toBe(false);
      state.users.set('student', account());
      return 'ok';
    });
    await expect(failing).rejects.toThrow('fallo asincrono');
    await expect(succeeding).resolves.toBe('ok');
    expect(await repository.read((state) => state.users.size)).toBe(1);
  });

  it('serializa operaciones simultaneas sin perder escrituras', async () => {
    await repository.transaction((state) => {
      state.users.set('student', account());
    });
    await Promise.all(
      Array.from({ length: 50 }, () =>
        repository.transaction(async (state) => {
          const current = state.users.get('student')!;
          const priorBalance = current.saldo;
          await Promise.resolve();
          current.saldo = priorBalance + 1;
        }),
      ),
    );
    expect(
      await repository.read((state) => state.users.get('student')?.saldo),
    ).toBe(1050);
  });

  it('consulta solamente datos confirmados durante una transaccion pendiente', async () => {
    let signalStarted!: () => void;
    let signalContinue!: () => void;
    const started = new Promise<void>((resolve) => {
      signalStarted = resolve;
    });
    const continueWork = new Promise<void>((resolve) => {
      signalContinue = resolve;
    });
    const transaction = repository.transaction(async (state) => {
      state.users.set('student', account());
      signalStarted();
      await continueWork;
    });
    await started;
    expect(await repository.read((state) => state.users.size)).toBe(0);
    signalContinue();
    await transaction;
    expect(await repository.read((state) => state.users.size)).toBe(1);
  });

  it('impide que el resultado o una referencia escapada al borrador modifique el commit', async () => {
    let escapedDraft: ExchangeState | undefined;
    const response = await repository.transaction((state) => {
      escapedDraft = state;
      state.users.set('student', account());
      return state.users.get('student')!;
    });
    response.saldo = -999;
    escapedDraft!.users.clear();
    expect(
      await repository.read((state) => state.users.get('student')),
    ).toEqual(account());
  });

  it('impide que la consulta y las referencias del lector modifiquen los datos', async () => {
    await repository.transaction((state) => {
      state.users.set('student', account());
    });
    let escapedSnapshot: ExchangeState | undefined;
    const response = await repository.read((state) => {
      escapedSnapshot = state;
      state.users.get('student')!.saldo = -100;
      return state.users.get('student')!;
    });
    response.saldo = -999;
    escapedSnapshot!.users.clear();
    expect(
      await repository.read((state) => state.users.get('student')),
    ).toEqual(account());
  });

  it('descarta los cambios si el resultado no puede clonarse', async () => {
    await expect(
      repository.transaction((state) => {
        state.users.set('student', account());
        return () => 'resultado no serializable';
      }),
    ).rejects.toMatchObject({ name: 'DataCloneError' });
    expect(await repository.read((state) => state.users.size)).toBe(0);
    await expect(repository.transaction(() => 'recuperado')).resolves.toBe(
      'recuperado',
    );
  });

  it('descarta los cambios si el estado final no puede clonarse', async () => {
    await expect(
      repository.transaction((state) => {
        state.users.set('student', account());
        state.idempotency.set('invalid', {
          fingerprint: 'operation',
          result: () => 'dato no serializable',
        });
        return 'ok';
      }),
    ).rejects.toMatchObject({ name: 'DataCloneError' });
    expect(await repository.read((state) => state.users.size)).toBe(0);
  });

  it('serializa disponibilidad y creditos bajo la misma transaccion y rollback', async () => {
    await expect(
      repository.transaction((state) => {
        state.availability.set('availability', {
          id_disponibilidad: 'availability',
          id_usuario: 'student',
          fecha_inicio: new Date('2030-01-01T10:00:00Z'),
          fecha_fin: new Date('2030-01-01T11:00:00Z'),
          estado: AvailabilityStatus.DISPONIBLE,
        });
        state.users.set('student', account());
        throw new Error('fallo comun');
      }),
    ).rejects.toThrow('fallo comun');
    const state = await repository.read((snapshot) => snapshot);
    expect(state.availability.size).toBe(0);
    expect(state.users.size).toBe(0);
  });
});
