import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { type AuthenticatedUser } from '../decorators/current-user.decorator.js';

interface JwtPayload {
  sub: string;
  phone: string;
  role: AuthenticatedUser['role'];
  tenantId?: string | null;
}

/**
 * JWT Authentication Guard.
 * Inspects the HTTP Authorization header for Bearer token, validates it,
 * and attaches the decoded AuthenticatedUser to request.user.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authentication token required (Bearer token missing)');
    }

    const token = authHeader.split(' ')[1];

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);

      request.user = {
        id: payload.sub,
        phone: payload.phone,
        role: payload.role,
        tenantId: payload.tenantId ?? null,
      } satisfies AuthenticatedUser;

      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired authentication token');
    }
  }
}

