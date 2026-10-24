import { ConflictException, Inject, Injectable } from '@nestjs/common';
import {
  EXCHANGE_REPOSITORY,
  ExchangeRepository,
} from '../exchanges/exchange.repository';
import { MemoryExchangeRepository } from '../exchanges/memory-exchange.repository';
import { UserSkillsRepository } from './user-skills.repository';
import { UserSkill } from './user-skill.types';

@Injectable()
export class MemoryUserSkillsRepository implements UserSkillsRepository {
  constructor(
    @Inject(EXCHANGE_REPOSITORY)
    private readonly persistence: ExchangeRepository = new MemoryExchangeRepository(),
  ) {}

  async findByUser(userId: string): Promise<UserSkill[]> {
    return this.persistence.read((state) =>
      [...state.userSkills.values()].filter(
        (record) => record.id_usuario === userId,
      ),
    );
  }
  async create(record: UserSkill): Promise<UserSkill> {
    const input = structuredClone(record);
    return this.persistence.transaction((state) => {
      const key = `${input.id_usuario}:${input.id_habilidad}`;
      if (state.userSkills.has(key))
        throw new ConflictException(
          'La habilidad ya esta registrada en tu perfil',
        );
      state.userSkills.set(key, input);
      return input;
    });
  }
  async remove(userId: string, skillId: string): Promise<boolean> {
    return this.persistence.transaction((state) =>
      state.userSkills.delete(`${userId}:${skillId}`),
    );
  }
}
