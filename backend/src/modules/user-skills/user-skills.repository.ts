import { UserSkill } from './user-skill.types';

export const USER_SKILLS_REPOSITORY = Symbol('USER_SKILLS_REPOSITORY');
export interface UserSkillsRepository {
  findByUser(userId: string): Promise<UserSkill[]>;
  /** Unicidad atomica de la clave compuesta id_usuario + id_habilidad. */
  create(record: UserSkill): Promise<UserSkill>;
  remove(userId: string, skillId: string): Promise<boolean>;
}
