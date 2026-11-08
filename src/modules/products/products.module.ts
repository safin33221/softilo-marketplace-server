import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService, TenantGuard],
  exports: [ProductsService],
})
export class ProductsModule {}

