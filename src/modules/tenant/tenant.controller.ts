import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Query,
  Param,
  UseGuards,
  UsePipes,
  Req,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { TenantService } from './tenant.service.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import {
  onboardTenantSchema,
  resolveTenantQuerySchema,
  type OnboardTenantDto,
  type ResolveTenantQueryDto,
} from './tenant.dto.js';

@Controller('api/v1/tenant')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  /**
   * POST /api/v1/tenant/onboard
   * Seller initiates shop onboarding. Creates Tenant + TenantWallet and binds SELLER_OWNER role.
   */
  @Post('onboard')
  @UseGuards(JwtAuthGuard)
  async onboard(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(onboardTenantSchema)) dto: OnboardTenantDto,
  ) {
    return this.tenantService.onboard(user, dto);
  }

  /**
   * GET /api/v1/tenant/resolve
   * Public storefront resolver. Finds tenant metadata by subdomain slug or custom domain.
   */
  @Get('resolve')
  @UsePipes(new ZodValidationPipe(resolveTenantQuerySchema))
  async resolve(@Query() query: ResolveTenantQueryDto) {
    return this.tenantService.resolve(query);
  }

  /**
   * GET /api/v1/tenant/me
   * Seller profile and tenant overview.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async getMe(@Req() req: { tenantId: string }) {
    return this.tenantService.getMe(req.tenantId);
  }

  /**
   * GET /api/v1/tenant/wallet
   * Real-time ledger balance check (pending balance, available balance, total earned).
   */
  @Get('wallet')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async getWallet(@Req() req: { tenantId: string }) {
    return this.tenantService.getWallet(req.tenantId);
  }

  /**
   * PATCH /api/v1/tenant/:id/verify
   * Super Admin gatekeeper to verify and activate seller store.
   */
  @Patch(':id/verify')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  async verifyTenant(
    @Param('id') tenantId: string,
    @Body('isVerified') isVerified: boolean = true,
  ) {
    return this.tenantService.verifyTenant(tenantId, isVerified);
  }
}

