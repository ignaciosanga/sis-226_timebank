import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SkillsService } from '../skills/skills.service';
import { UsersService } from '../users/users.service';
import { CreateUserSkillDto } from './dto/create-user-skill.dto';
import { PublishedUserSkill } from './user-skill.types';
import {
  USER_SKILLS_REPOSITORY,
  UserSkillsRepository,
} from './user-skills.repository';

@Injectable()
export class UserSkillsService {
  constructor(
    @Inject(USER_SKILLS_REPOSITORY)
    private readonly repository: UserSkillsRepository,
    private readonly skills: SkillsService,
    private readonly users: UsersService,
  ) {}
  async list(userId: string): Promise<PublishedUserSkill[]> {
    await this.users.requirePublishedStudent(userId);
    const published: PublishedUserSkill[] = [];
    for (const record of await this.repository.findByUser(userId)) {
      try {
        published.push({
          ...record,
          habilidad: await this.skills.requireActive(record.id_habilidad),
        });
      } catch (error) {
        // Un catalogo desactivado deja de publicarse; no se ocultan otros fallos.
        if (!(error instanceof NotFoundException)) throw error;
      }
    }
    return published;
  }
  async add(authenticatedId: string, input: CreateUserSkillDto) {
    await this.users.requirePublishedStudent(authenticatedId);
    await this.skills.requireActive(input.skillId);
    return this.repository.create({
      id_usuario: authenticatedId,
      id_habilidad: input.skillId,
      nivel: input.nivel,
    });
  }
  async remove(authenticatedId: string, skillId: string): Promise<void> {
    await this.users.requirePublishedStudent(authenticatedId);
    if (!(await this.repository.remove(authenticatedId, skillId)))
      throw new NotFoundException('Habilidad no registrada en tu perfil');
  }
}
