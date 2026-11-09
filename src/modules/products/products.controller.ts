import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UsePipes,
  Req,
} from '@nestjs/common';
import { ProductsService } from './products.service.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import {
  createProductSchema,
  updateProductSchema,
  listProductsQuerySchema,
  type CreateProductDto,
  type UpdateProductDto,
  type ListProductsQueryDto,
} from './products.dto.js';

@Controller('api/v1/products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  /**
   * POST /api/v1/products
   * Authenticated seller creates a product strictly isolated within their tenant.
   */
  @Post()
  @UseGuards(JwtAuthGuard, TenantGuard)
  async create(
    @Req() req: { tenantId: string },
    @Body(new ZodValidationPipe(createProductSchema)) dto: CreateProductDto,
  ) {
    return this.productsService.create(req.tenantId, dto);
  }

  /**
   * GET /api/v1/products
   * Public storefront & central marketplace listing with filtering and pagination.
   */
  @Get()
  @UsePipes(new ZodValidationPipe(listProductsQuerySchema))
  async findAll(@Query() query: ListProductsQueryDto) {
    return this.productsService.findAll(query);
  }

  /**
   * GET /api/v1/products/:id
   * Public endpoint to view a single product.
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  /**
   * PATCH /api/v1/products/:id
   * Authenticated seller updates pricing, discount, stock, or images of their own product.
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @UsePipes(new ZodValidationPipe(updateProductSchema))
  async update(
    @Param('id') id: string,
    @Req() req: { tenantId: string },
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(id, req.tenantId, dto);
  }

  /**
   * DELETE /api/v1/products/:id
   * Authenticated seller removes a product from their storefront.
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async delete(
    @Param('id') id: string,
    @Req() req: { tenantId: string },
  ) {
    return this.productsService.delete(id, req.tenantId);
  }
}

