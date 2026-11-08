import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, TenantGuard],
  exports: [OrdersService],
})
export class OrdersModule {}

