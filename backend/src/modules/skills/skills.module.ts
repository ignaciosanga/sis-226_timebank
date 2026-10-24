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

@Module({
  imports: [AuthModule, CategoriesModule, PrismaModule],
  controllers: [SkillsController],
  providers: [
    SkillsService,
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
