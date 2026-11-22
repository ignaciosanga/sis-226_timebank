import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ExchangePersistenceModule } from '../exchanges/exchange-persistence.module';
import {
  AcademicAnalyticsController,
  AcademicController,
} from './academic.controller';
import { AcademicRepository } from './academic.repository';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { MatchingController, MatchingService } from './matching.controller';

@Module({
  imports: [PrismaModule, AuthModule, ExchangePersistenceModule],
  controllers: [
    AcademicController,
    AcademicAnalyticsController,
    ReviewsController,
    MatchingController,
  ],
  providers: [AcademicRepository, ReviewsService, MatchingService],
})
export class AcademicModule {}
