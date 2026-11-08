import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { type AuthenticatedUser } from '../decorators/current-user.decorator.js';

/**
 * Strict Tenant Isolation Guard.
 * Enforces that SELLER_OWNER operations operate strictly within the tenantId
 * decoded from their verified JWT session. Never trusts tenantId from req.body or query.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    if (!user) {
      throw new ForbiddenException('Authentication required for tenant operation');
    }

    // SUPER_ADMIN can operate across tenants
    if (user.role === Role.SUPER_ADMIN) {
      return true;
    }

    // For sellers, ensure a tenant is bound to their account
    if (user.role === Role.SELLER_OWNER) {
      if (!user.tenantId) {
        throw new ForbiddenException(
          'Seller does not have an active tenant. Please onboard your shop first.',
        );
      }

      // Explicitly lock tenantId in request to prevent tenant tampering
      request.tenantId = user.tenantId;
      return true;
    }

    return true;
  }
}

