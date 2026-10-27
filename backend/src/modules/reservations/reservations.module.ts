import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ExchangesModule } from '../exchanges/exchanges.module';
import { ReservationsController } from './reservations.controller';

@Module({
  imports: [AuthModule, ExchangesModule],
  controllers: [ReservationsController],
})
export class ReservationsModule {}
