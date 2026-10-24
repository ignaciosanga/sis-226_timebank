import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnvironment, Environment } from './config/environment';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { SensitiveFieldsInterceptor } from './common/interceptors/sensitive-fields.interceptor';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { SkillsModule } from './modules/skills/skills.module';
import { UserSkillsModule } from './modules/user-skills/user-skills.module';
import { AvailabilityModule } from './modules/availability/availability.module';
import { ExchangesModule } from './modules/exchanges/exchanges.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { CreditsModule } from './modules/credits/credits.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: process.env.NODE_ENV === 'test',
      validate: validateEnvironment,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Environment, true>) => [
        {
          ttl: config.get('RATE_LIMIT_TTL_MS', { infer: true }),
          limit: config.get('RATE_LIMIT_MAX', { infer: true }),
        },
      ],
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    CategoriesModule,
    SkillsModule,
    UserSkillsModule,
    AvailabilityModule,
    ExchangesModule,
    ReservationsModule,
    CreditsModule,
    AnalyticsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: SensitiveFieldsInterceptor },
  ],
})
export class AppModule {}
