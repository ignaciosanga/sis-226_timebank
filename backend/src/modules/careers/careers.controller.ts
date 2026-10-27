import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiProperty,
} from '@nestjs/swagger';
import { RecordStatus } from '../../common/enums/record-status.enum';
import {
  CAREERS_REPOSITORY,
  CareersRepository,
  Career,
} from './careers.repository';
import {
  ListQueryDto,
  PaginationMeta,
  paginate,
} from '../../common/dto/list-query.dto';
import { nameKey } from '../../common/utils/catalog-name';

class CareersPage {
  @ApiProperty({ type: Career, isArray: true })
  data!: Career[];
  @ApiProperty({ type: PaginationMeta })
  meta!: PaginationMeta;
}

@ApiTags('Carreras')
@Controller('careers')
export class CareersController {
  constructor(
    @Inject(CAREERS_REPOSITORY) private readonly repository: CareersRepository,
  ) {}
  @Get()
  @ApiOkResponse({ type: CareersPage })
  @ApiOperation({
    summary: 'Carreras activas; usar su UUID al registrar un estudiante',
  })
  async list(@Query() query: ListQueryDto) {
    return paginate(
      (await this.repository.findAll()).filter(
        (row) =>
          row.estado === RecordStatus.ACTIVO &&
          (!query.search ||
            nameKey(row.nombre).includes(nameKey(query.search))),
      ),
      query,
    );
  }
  @Get(':id')
  @ApiOkResponse({ type: Career })
  @ApiNotFoundResponse({ description: 'Carrera inexistente o inactiva' })
  async get(@Param('id', ParseUUIDPipe) id: string) {
    const row = await this.repository.findById(id);
    if (!row || row.estado !== RecordStatus.ACTIVO)
      throw new NotFoundException('Carrera activa no encontrada');
    return row;
  }
}
