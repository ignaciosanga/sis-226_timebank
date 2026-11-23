import { ConflictException } from '@nestjs/common';
import { MemoryExchangeRepository } from '../exchanges/memory-exchange.repository';
import { storedUser } from '../exchanges/test-fixtures';
import { grantWelcomeBonus } from './account-activation';

describe('Bono único con saldos exactos', () => {
  it('preserva una fracción anterior y registra snapshots exactos al conceder el bono', async () => {
    const store = new MemoryExchangeRepository();
    await store.transaction((state) => {
      const user = storedUser('new-user', '1.2');
      state.users.set(user.id_usuario, user);
      grantWelcomeBonus(state, user, '8', new Date());
      expect(user.saldo).toBe('9.2');
      expect([...state.movements.values()]).toEqual([
        expect.objectContaining({
          cantidad: '8',
          saldo_anterior: '1.2',
          saldo_posterior: '9.2',
        }),
      ]);
    });
  });
  it('decide cero una vez y rechaza el desborde como conflicto sin cambios parciales', async () => {
    const store = new MemoryExchangeRepository();
    await store.transaction((state) => {
      const zero = storedUser('zero', '1.2');
      state.users.set(zero.id_usuario, zero);
      const now = new Date();
      grantWelcomeBonus(state, zero, '0', now);
      grantWelcomeBonus(state, zero, '8', now);
      expect(zero.saldo).toBe('1.2');
      expect(zero.bono_decidido_at).toBe(now);
      expect(state.movements.size).toBe(0);
      const full = storedUser('full', '2147483646.9');
      state.users.set(full.id_usuario, full);
      expect(() => grantWelcomeBonus(state, full, '1', now)).toThrow(
        ConflictException,
      );
      expect(full.bono_decidido_at).toBeUndefined();
      expect(full.saldo).toBe('2147483646.9');
      expect(state.movements.size).toBe(0);
    });
  });
});
