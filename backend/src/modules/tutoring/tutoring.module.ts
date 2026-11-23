import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ExchangePersistenceModule } from '../exchanges/exchange-persistence.module';
import { SkillsModule } from '../skills/skills.module';
import { TutoringBannerController } from './banners/banner.controller';
import { TutoringBannerService } from './banners/banner.service';
import { TutoringController } from './tutoring.controller';
import { TutoringService } from './tutoring.service';

@Module({
  imports: [AuthModule, ExchangePersistenceModule, SkillsModule],
  controllers: [TutoringController, TutoringBannerController],
  providers: [TutoringService, TutoringBannerService],
  exports: [TutoringService, TutoringBannerService],
})
export class TutoringModule {}
