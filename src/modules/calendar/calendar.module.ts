import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ExchangesModule } from '../exchanges/exchanges.module';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';

@Module({
  imports: [AuthModule, ExchangesModule],
  controllers: [CalendarController],
  providers: [CalendarService],
})
export class CalendarModule {}
