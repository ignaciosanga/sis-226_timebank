import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { CreateCategoryDto } from '../../categories/dto/create-category.dto';

export class CreateSkillDto extends CreateCategoryDto {
  @ApiProperty({ format: 'uuid', description: 'Se adapta a id_categoria' })
  @IsUUID()
  categoryId!: string;
}
