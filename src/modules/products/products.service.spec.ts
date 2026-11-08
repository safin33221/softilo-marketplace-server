import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProductsService } from './products.service.js';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('ProductsService', () => {
  let productsService: ProductsService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      product: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };

    productsService = new ProductsService(mockPrisma);
  });

  it('should create product with tenantId and unique slug', async () => {
    mockPrisma.product.findUnique.mockResolvedValue(null);
    mockPrisma.product.create.mockResolvedValue({
      id: 'p-1',
      tenantId: 'tenant-1',
      title: 'Cotton Panjabi',
      slug: 'cotton-panjabi',
      price: 1500,
      stock: 10,
      images: ['https://example.com/img1.jpg'],
    });

    const res = await productsService.create('tenant-1', {
      title: 'Cotton Panjabi',
      description: 'Fine quality cotton panjabi',
      price: 1500,
      stock: 10,
      images: ['https://example.com/img1.jpg'],
    });

    expect(res.id).toBe('p-1');
    expect(res.tenantId).toBe('tenant-1');
    expect(mockPrisma.product.create).toHaveBeenCalled();
  });

  it('should prevent seller from editing products of another tenant', async () => {
    mockPrisma.product.findUnique.mockResolvedValue({
      id: 'p-1',
      tenantId: 'other-tenant',
      title: 'Silk Saree',
    });

    await expect(
      productsService.update('p-1', 'my-tenant', { price: 2000 }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should throw NotFoundException if product to delete does not exist', async () => {
    mockPrisma.product.findUnique.mockResolvedValue(null);

    await expect(
      productsService.delete('non-existent', 'my-tenant'),
    ).rejects.toThrow(NotFoundException);
  });
});

