import { Module } from '@nestjs/common';
import { EXCHANGE_REPOSITORY } from './exchange.repository';
import { MemoryExchangeRepository } from './memory-exchange.repository';
import { ConfigService } from '@nestjs/config';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { PrismaExchangeRepository } from '../../infrastructure/prisma/prisma-exchange.repository';

@Module({
  imports: [PrismaModule],
  providers: [
    {
      provide: EXCHANGE_REPOSITORY,
      inject: [ConfigService, PrismaService],
      useFactory: (config: ConfigService, prisma: PrismaService) =>
        config.get('PERSISTENCE_MODE') === 'prisma'
          ? new PrismaExchangeRepository(prisma)
          : new MemoryExchangeRepository(),
    },
  ],
  exports: [EXCHANGE_REPOSITORY],
})
export class ExchangePersistenceModule {}
