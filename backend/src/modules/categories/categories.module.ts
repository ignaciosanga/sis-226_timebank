import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CategoriesController } from './categories.controller';
import { CATEGORIES_REPOSITORY } from './categories.repository';
import { CategoriesService } from './categories.service';
import { MemoryCategoriesRepository } from './memory-categories.repository';
import { ConfigService } from '@nestjs/config';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { PrismaCategoriesRepository } from '../../infrastructure/prisma/prisma-catalogs.repositories';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [CategoriesController],
  providers: [
    CategoriesService,
    {
      provide: CATEGORIES_REPOSITORY,
      inject: [ConfigService, PrismaService],
      useFactory: (config: ConfigService, prisma: PrismaService) =>
        config.get('PERSISTENCE_MODE') === 'prisma'
          ? new PrismaCategoriesRepository(prisma)
          : new MemoryCategoriesRepository(),
    },
  ],
  exports: [CategoriesService],
})
export class CategoriesModule {}
