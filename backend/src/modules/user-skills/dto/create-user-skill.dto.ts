import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { SkillLevel } from '../user-skill.types';

export class CreateUserSkillDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Se adapta a id_habilidad; el usuario procede del JWT',
  })
  @IsUUID()
  skillId!: string;
  @ApiProperty({ enum: SkillLevel })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? (Object.values(SkillLevel).find(
          (level) =>
            level.toLocaleLowerCase('es') === value.toLocaleLowerCase('es'),
        ) ?? value)
      : value,
  )
  @IsEnum(SkillLevel)
  nivel!: SkillLevel;
}
