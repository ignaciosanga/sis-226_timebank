import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  Roles as RolesDecorator,
  ROLES_KEY,
} from '../decorators/roles.decorator';
import { Role } from '../enums/role.enum';
import { PublicUser } from '../../modules/users/user.types';

// Aplicar JwtAuthGuard antes de este guard en cada controlador protegido.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<
      Parameters<typeof RolesDecorator>
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!required?.length) return true;
    const user = context
      .switchToHttp()
      .getRequest<{ user?: PublicUser }>().user;
    return !!user?.roles.some((role: Role) => required.includes(role));
  }
}
