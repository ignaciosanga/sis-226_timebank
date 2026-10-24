import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { Role } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CategoriesService } from './categories.service';
import { CategoriesPage, Category } from './category.types';
import { CreateCategoryDto } from './dto/create-category.dto';

@ApiTags('Categorías')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}
  @Get()
  @ApiOkResponse({ type: CategoriesPage })
  @ApiOperation({
    summary: 'Categorías activas; respuesta { data, meta } con paginación',
  })
  list(@Query() query: ListQueryDto) {
    return this.categories.list(query);
  }
  @Get(':id')
  @ApiOkResponse({ type: Category })
  @ApiNotFoundResponse({ description: 'Categoría inexistente o inactiva' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.categories.requireActive(id);
  }
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: Category })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiConflictResponse({ description: 'Nombre duplicado' })
  create(@Body() input: CreateCategoryDto) {
    return this.categories.create(input);
  }
}
