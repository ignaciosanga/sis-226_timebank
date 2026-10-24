import { Skill } from './skill.types';

export const SKILLS_REPOSITORY = Symbol('SKILLS_REPOSITORY');
export interface SkillsRepository {
  findAll(): Promise<Skill[]>;
  findById(id: string): Promise<Skill | null>;
  /** Unicidad global de nombre normalizado, tambien entre categorias e inactivos. */
  create(nombre: string, categoryId: string): Promise<Skill>;
}
