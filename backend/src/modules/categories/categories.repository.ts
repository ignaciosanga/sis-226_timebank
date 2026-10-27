import { Category } from './category.types';

export const CATEGORIES_REPOSITORY = Symbol('CATEGORIES_REPOSITORY');

export interface CategoriesRepository {
  findAll(): Promise<Category[]>;
  findById(id: string): Promise<Category | null>;
  /** Unicidad de nombre normalizado, incluyendo inactivos; escritura atomica. */
  create(nombre: string): Promise<Category>;
}
