import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { OrdersService } from './orders.service.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { Role } from '@prisma/client';
import {
  quickCheckoutSchema,
  updateOrderStatusSchema,
  listOrdersQuerySchema,
  type QuickCheckoutDto,
  type UpdateOrderStatusDto,
  type ListOrdersQueryDto,
} from './orders.dto.js';

@Controller('api/v1/orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * POST /api/v1/orders/quick-checkout
   * 1-Click Guest & Customer Checkout with auto-calculated platform fee & commission settlement.
   */
  @Post('quick-checkout')
  @UsePipes(new ZodValidationPipe(quickCheckoutSchema))
  async quickCheckout(@Body() dto: QuickCheckoutDto) {
    return this.ordersService.quickCheckout(dto);
  }

  /**
   * GET /api/v1/orders
   * Lists orders filtered strictly by tenantId (for sellers) or customerId (for customers).
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ZodValidationPipe(listOrdersQuerySchema))
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListOrdersQueryDto,
  ) {
    return this.ordersService.findAll(user, query);
  }

  /**
   * GET /api/v1/orders/:id
   * Retrieves single order details with ownership verification.
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ordersService.findOne(id, user);
  }

  /**
   * PATCH /api/v1/orders/:id/status
   * Authenticated seller updates order status (CONFIRMED, IN_COURIER, DELIVERED, CANCELLED, RETURNED).
   * Setting status to DELIVERED triggers automatic wallet ledger settlement.
   */
  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER_OWNER, Role.SUPER_ADMIN)
  @UsePipes(new ZodValidationPipe(updateOrderStatusSchema))
  async updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(
      id,
      user.tenantId || '',
      dto,
      user.role,
    );
  }
}

