import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ExchangePersistenceModule } from '../exchanges/exchange-persistence.module';
import {
  AvailabilityController,
  PublishedAvailabilityController,
} from './availability.controller';
import { AVAILABILITY_REPOSITORY } from './availability.repository';
import { AvailabilityService } from './availability.service';
import { MemoryAvailabilityRepository } from './memory-availability.repository';

@Module({
  imports: [AuthModule, ExchangePersistenceModule],
  controllers: [AvailabilityController, PublishedAvailabilityController],
  providers: [
    AvailabilityService,
    {
      provide: AVAILABILITY_REPOSITORY,
      useClass: MemoryAvailabilityRepository,
    },
  ],
})
export class AvailabilityModule {}
