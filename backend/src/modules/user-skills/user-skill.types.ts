import { ApiProperty } from '@nestjs/swagger';
import { Skill } from '../skills/skill.types';

// Valores del modelo optimizado.
export enum SkillLevel {
  BASICO = 'Basico',
  INTERMEDIO = 'Intermedio',
  AVANZADO = 'Avanzado',
  EXPERTO = 'Experto',
}

export class UserSkill {
  @ApiProperty({ format: 'uuid' })
  id_usuario!: string;
  @ApiProperty({ format: 'uuid' })
  id_habilidad!: string;
  @ApiProperty({ enum: SkillLevel })
  nivel!: SkillLevel;
}

export class PublishedUserSkill extends UserSkill {
  @ApiProperty({ type: Skill })
  habilidad!: Skill;
}
