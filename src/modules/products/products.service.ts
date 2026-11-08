import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { generateSlug } from '../../common/utils/slug.js';
import {
  type CreateProductDto,
  type UpdateProductDto,
  type ListProductsQueryDto,
} from './products.dto.js';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new product strictly within the authenticated seller's tenantId.
   * Auto-generates a unique product slug for the tenant.
   */
  async create(tenantId: string, dto: CreateProductDto) {
    const baseSlug = generateSlug(dto.title) || 'product';
    let productSlug = baseSlug;

    // Check if slug exists in this tenant, append random suffix if needed
    const existing = await this.prisma.product.findUnique({
      where: {
        tenantId_slug: {
          tenantId,
          slug: productSlug,
        },
      },
    });

    if (existing) {
      const suffix = Math.random().toString(36).substring(2, 6);
      productSlug = `${baseSlug}-${suffix}`;
    }

    const product = await this.prisma.product.create({
      data: {
        tenantId,
        title: dto.title,
        slug: productSlug,
        description: dto.description,
        price: dto.price,
        discountPrice: dto.discountPrice ?? null,
        stock: dto.stock,
        images: dto.images,
        isCurated: false,
        aiTags: [],
      },
    });

    this.logger.log(`[Product Created] ID: ${product.id}, Tenant: ${tenantId}, Title: ${dto.title}`);
    return product;
  }

  /**
   * Retrieves products supporting multi-tenant filtering, search query, and pagination.
   */
  async findAll(query: ListProductsQueryDto, authenticatedTenantId?: string) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(50, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    // Resolve tenantId from query, authenticated session, or slug
    let targetTenantId = authenticatedTenantId || query.tenantId;

    if (!targetTenantId && query.tenantSlug) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { slug: query.tenantSlug },
        select: { id: true },
      });
      if (tenant) {
        targetTenantId = tenant.id;
      }
    }

    const whereClause: any = {
      ...(targetTenantId ? { tenantId: targetTenantId } : {}),
      ...(query.isCurated !== undefined ? { isCurated: query.isCurated } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where: whereClause,
        include: {
          tenant: {
            select: { id: true, name: true, slug: true, logoUrl: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.product.count({ where: whereClause }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Fetches single product details by ID or slug.
   */
  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            trustScore: true,
            commissionRate: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('প্রোডাক্টটি পাওয়া যায়নি (Product not found)');
    }

    return product;
  }

  /**
   * Updates an existing product with strict tenant ownership verification.
   */
  async update(id: string, tenantId: string, dto: UpdateProductDto) {
    const existing = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('প্রোডাক্টটি পাওয়া যায়নি (Product not found)');
    }

    // Tenant Isolation check: Seller can only edit their own products
    if (existing.tenantId !== tenantId) {
      throw new ForbiddenException('অন্য টেন্যান্টের প্রোডাক্ট পরিবর্তন করার অনুমতি নেই');
    }

    let slug = existing.slug;
    if (dto.title && dto.title !== existing.title) {
      slug = generateSlug(dto.title);
    }

    return await this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.title ? { title: dto.title, slug } : {}),
        ...(dto.description ? { description: dto.description } : {}),
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(dto.discountPrice !== undefined ? { discountPrice: dto.discountPrice } : {}),
        ...(dto.stock !== undefined ? { stock: dto.stock } : {}),
        ...(dto.images ? { images: dto.images } : {}),
        ...(dto.isCurated !== undefined ? { isCurated: dto.isCurated } : {}),
      },
    });
  }

  /**
   * Deletes a product with strict tenant ownership verification.
   */
  async delete(id: string, tenantId: string) {
    const existing = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('প্রোডাক্টটি পাওয়া যায়নি (Product not found)');
    }

    if (existing.tenantId !== tenantId) {
      throw new ForbiddenException('অন্য টেন্যান্টের প্রোডাক্ট মুছে ফেলার অনুমতি নেই');
    }

    await this.prisma.product.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'প্রোডাক্ট সফলভাবে মুছে ফেলা হয়েছে (Product deleted successfully)',
    };
  }
}

