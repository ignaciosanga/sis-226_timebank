import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { PrismaCareersRepository } from '../../infrastructure/prisma/prisma-catalogs.repositories';
import { CareersController } from './careers.controller';
import { CAREERS_REPOSITORY } from './careers.repository';
import { MemoryCareersRepository } from './memory-careers.repository';

@Module({
  imports: [PrismaModule],
  controllers: [CareersController],
  providers: [
    {
      provide: CAREERS_REPOSITORY,
      inject: [ConfigService, PrismaService],
      useFactory: (config: ConfigService, prisma: PrismaService) =>
        config.get('PERSISTENCE_MODE') === 'prisma'
          ? new PrismaCareersRepository(prisma)
          : new MemoryCareersRepository(),
    },
  ],
  exports: [CAREERS_REPOSITORY],
})
export class CareersModule {}
