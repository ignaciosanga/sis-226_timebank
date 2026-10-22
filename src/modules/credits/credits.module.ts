import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ExchangesModule } from '../exchanges/exchanges.module';
import { CreditsController } from './credits.controller';

@Module({
  imports: [AuthModule, ExchangesModule],
  controllers: [CreditsController],
})
export class CreditsModule {}
