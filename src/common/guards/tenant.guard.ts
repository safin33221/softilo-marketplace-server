import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { type AuthenticatedUser } from '../decorators/current-user.decorator.js';

/**
 * Strict Tenant Isolation Guard.
 * Enforces that SELLER_OWNER operations operate strictly within the tenantId.
 * Self-healing: If JWT token was issued prior to onboarding or before tenant linking,
 * dynamically resolves tenantId from database and synchronizes session state.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    if (!user) {
      throw new ForbiddenException('Authentication required for tenant operation');
    }

    // SUPER_ADMIN can operate across tenants
    if (user.role === Role.SUPER_ADMIN) {
      return true;
    }

    let tenantId = user.tenantId;

    // Self-healing: If JWT token does not carry tenantId, resolve live from DB!
    if (!tenantId) {
      const dbUser = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: { tenantId: true, role: true },
      });

      if (dbUser?.tenantId) {
        tenantId = dbUser.tenantId;
        user.tenantId = tenantId;
      } else if (user.phone) {
        // Check if tenant exists under this user's phone number
        const dbTenant = await this.prisma.tenant.findUnique({
          where: { phone: user.phone },
          select: { id: true },
        });

        if (dbTenant) {
          tenantId = dbTenant.id;
          user.tenantId = tenantId;
          // Synchronize user record in database
          await this.prisma.user.update({
            where: { id: user.id },
            data: { role: Role.SELLER_OWNER, tenantId: dbTenant.id },
          }).catch(() => null);
        }
      }
    }

    if (!tenantId) {
      throw new ForbiddenException(
        'Seller does not have an active tenant. Please onboard your shop first.',
      );
    }

    // Explicitly lock tenantId in request to prevent tenant tampering
    request.tenantId = tenantId;
    return true;
  }
}
