import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../domain/enums/user-role.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { ForbiddenActionException } from '../filters/app.exception';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!roles?.length) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!roles.includes(user?.role)) throw new ForbiddenActionException();

    return true;
  }
}
