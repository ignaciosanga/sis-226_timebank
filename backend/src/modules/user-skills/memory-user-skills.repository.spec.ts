import { ConflictException } from '@nestjs/common';
import { MemoryExchangeRepository } from '../exchanges/memory-exchange.repository';
import { MemoryUserSkillsRepository } from './memory-user-skills.repository';
import { SkillLevel } from './user-skill.types';

describe('MemoryUserSkillsRepository y almacenamiento compartido', () => {
  const offer = {
    id_usuario: 'ofertante',
    id_habilidad: 'habilidad',
    nivel: SkillLevel.INTERMEDIO,
  };

  it('comparte ofertas y eliminaciones con las transacciones de reservas', async () => {
    const persistence = new MemoryExchangeRepository();
    const repository = new MemoryUserSkillsRepository(persistence);
    await repository.create(offer);
    expect(
      await persistence.read((state) =>
        state.userSkills.get('ofertante:habilidad'),
      ),
    ).toEqual(offer);
    await repository.remove(offer.id_usuario, offer.id_habilidad);
    expect(await persistence.read((state) => state.userSkills.size)).toBe(0);
  });

  it('rechaza una de dos publicaciones duplicadas concurrentes', async () => {
    const repository = new MemoryUserSkillsRepository();
    const results = await Promise.allSettled([
      repository.create(offer),
      repository.create(offer),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected');
    expect(rejected?.status === 'rejected' && rejected.reason).toBeInstanceOf(
      ConflictException,
    );
    expect(await repository.findByUser(offer.id_usuario)).toEqual([offer]);
  });

  it('serializa la despublicacion con una comprobacion de oferta en curso', async () => {
    const persistence = new MemoryExchangeRepository();
    const repository = new MemoryUserSkillsRepository(persistence);
    await repository.create(offer);
    let proceed!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>((resolve) => {
      proceed = resolve;
    });
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const accepting = persistence.transaction(async (state) => {
      entered();
      await gate;
      return state.userSkills.has('ofertante:habilidad');
    });
    await started;
    const unpublishing = repository.remove(
      offer.id_usuario,
      offer.id_habilidad,
    );
    proceed();
    await expect(accepting).resolves.toBe(true);
    await expect(unpublishing).resolves.toBe(true);
    expect(await repository.findByUser(offer.id_usuario)).toEqual([]);
  });

  it('captura la oferta recibida antes de esperar una transaccion concurrente', async () => {
    const persistence = new MemoryExchangeRepository();
    const repository = new MemoryUserSkillsRepository(persistence);
    const input = { ...offer };
    const creating = repository.create(input);
    input.id_usuario = 'otro';
    const created = await creating;
    created.nivel = SkillLevel.BASICO;
    expect(await repository.findByUser(offer.id_usuario)).toEqual([offer]);
    expect(await repository.findByUser('otro')).toEqual([]);
  });
});
