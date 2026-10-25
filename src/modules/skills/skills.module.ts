import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CategoriesModule } from '../categories/categories.module';
import { MemorySkillsRepository } from './memory-skills.repository';
import { SkillsController } from './skills.controller';
import { SKILLS_REPOSITORY } from './skills.repository';
import { SkillsService } from './skills.service';
import { ConfigService } from '@nestjs/config';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { PrismaSkillsRepository } from '../../infrastructure/prisma/prisma-catalogs.repositories';
import { ExchangePersistenceModule } from '../exchanges/exchange-persistence.module';
import { SkillProvidersService } from './skill-providers.service';

@Module({
  imports: [
    AuthModule,
    CategoriesModule,
    PrismaModule,
    ExchangePersistenceModule,
  ],
  controllers: [SkillsController],
  providers: [
    SkillsService,
    SkillProvidersService,
    {
      provide: SKILLS_REPOSITORY,
      inject: [ConfigService, PrismaService],
      useFactory: (config: ConfigService, prisma: PrismaService) =>
        config.get('PERSISTENCE_MODE') === 'prisma'
          ? new PrismaSkillsRepository(prisma)
          : new MemorySkillsRepository(),
    },
  ],
  exports: [SkillsService],
})
export class SkillsModule {}
