import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ExchangePersistenceModule } from '../exchanges/exchange-persistence.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [AuthModule, ExchangePersistenceModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
