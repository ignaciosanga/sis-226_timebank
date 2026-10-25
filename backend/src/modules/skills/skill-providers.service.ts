import { Inject, Injectable } from '@nestjs/common';
import { paginate } from '../../common/dto/list-query.dto';
import { UserStatus } from '../../common/enums/record-status.enum';
import { DatabaseRole } from '../../common/enums/role.enum';
import { nameKey } from '../../common/utils/catalog-name';
import {
  EXCHANGE_REPOSITORY,
  ExchangeRepository,
} from '../exchanges/exchange.repository';
import { SkillLevel } from '../user-skills/user-skill.types';
import { ProvidersQueryDto, SkillProvider } from './dto/skill-providers.dto';
import { SkillsService } from './skills.service';

@Injectable()
export class SkillProvidersService {
  constructor(
    private readonly skills: SkillsService,
    @Inject(EXCHANGE_REPOSITORY)
    private readonly repository: ExchangeRepository,
  ) {}

  async list(skillId: string, query: ProvidersQueryDto) {
    const skill = await this.skills.requireActive(skillId);
    return this.repository.read((state) => {
      const records: SkillProvider[] = [];
      for (const offer of state.userSkills.values()) {
        if (
          offer.id_habilidad !== skillId ||
          !Object.values(SkillLevel).includes(offer.nivel) ||
          (query.nivel && offer.nivel !== query.nivel)
        )
          continue;
        const user = state.users.get(offer.id_usuario);
        if (
          !user ||
          user.estado !== UserStatus.ACTIVO ||
          user.rol !== DatabaseRole.ESTUDIANTE
        )
          continue;
        const nombre = (user.nombre + ' ' + user.apellido).trim();
        if (query.search && !nameKey(nombre).includes(nameKey(query.search)))
          continue;
        records.push({
          id_usuario: user.id_usuario,
          nombre,
          id_habilidad: skill.id_habilidad,
          habilidad: skill.nombre,
          nivel: offer.nivel,
        });
      }
      records.sort(
        (a, b) =>
          a.nombre.localeCompare(b.nombre) ||
          a.id_usuario.localeCompare(b.id_usuario),
      );
      return paginate(records, query);
    });
  }
}
