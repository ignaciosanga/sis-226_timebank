import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Environment } from '../../config/environment';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { PasswordService } from './password.service';
import { REGISTRATION_POLICY } from './registration-policy';
import { AuthController } from './auth.controller';
import { UsersController } from '../users/users.controller';
import { AdminUsersController } from '../users/admin-users.controller';

@Module({
  imports: [
    UsersModule,
    PassportModule.register({ defaultStrategy: 'jwt', session: false }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Environment, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        signOptions: {
          algorithm: 'HS256',
          expiresIn: config.get('JWT_EXPIRES_IN_SECONDS', { infer: true }),
          issuer: config.get('JWT_ISSUER', { infer: true }),
          audience: config.get('JWT_AUDIENCE', { infer: true }),
        },
        verifyOptions: {
          algorithms: ['HS256'],
          issuer: config.get('JWT_ISSUER', { infer: true }),
          audience: config.get('JWT_AUDIENCE', { infer: true }),
        },
      }),
    }),
  ],
  controllers: [AuthController, UsersController, AdminUsersController],
  providers: [
    AuthService,
    PasswordService,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    {
      provide: REGISTRATION_POLICY,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Environment, true>) => ({
        initialCredits: String(
          config.get('REGISTRATION_INITIAL_CREDITS', { infer: true }),
        ),
        profileOnly: false,
      }),
    },
  ],
  exports: [
    AuthService,
    PasswordService,
    JwtAuthGuard,
    RolesGuard,
    JwtModule,
    UsersModule,
  ],
})
export class AuthModule {}
