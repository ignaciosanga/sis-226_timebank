import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Environment } from '../../config/environment';
import { UsersService } from '../users/users.service';
import { toPublicUser } from '../users/user.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService<Environment, true>,
    private readonly users: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get('JWT_SECRET', { infer: true }),
      algorithms: ['HS256'],
      issuer: config.get('JWT_ISSUER', { infer: true }),
      audience: config.get('JWT_AUDIENCE', { infer: true }),
      ignoreExpiration: false,
    });
  }

  async validate(payload: unknown) {
    if (
      !payload ||
      typeof payload !== 'object' ||
      !('sub' in payload) ||
      typeof payload.sub !== 'string' ||
      !payload.sub
    ) {
      throw new UnauthorizedException('Autenticacion invalida');
    }
    // Identidad del JWT verificado; estado y roles actuales siempre desde persistencia.
    return toPublicUser(await this.users.requireActive(payload.sub));
  }
}
