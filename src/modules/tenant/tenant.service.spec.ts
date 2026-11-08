import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TenantService } from './tenant.service.js';
import { Role } from '@prisma/client';
import { ConflictException } from '@nestjs/common';

describe('TenantService', () => {
  let tenantService: TenantService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      tenant: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      tenantWallet: {
        create: vi.fn(),
        findUnique: vi.fn(),
      },
      user: {
        update: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => {
        return cb(mockPrisma);
      }),
    };

    tenantService = new TenantService(mockPrisma);
  });

  it('should onboard a new seller with Tenant, TenantWallet, and SELLER_OWNER role', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue(null);

    const createdTenant = {
      id: 'tenant-1',
      name: 'Rahim Fashion',
      slug: 'rahim-fashion',
      phone: '01712345678',
      commissionRate: 5.0,
      isVerified: false,
    };
    mockPrisma.tenant.create.mockResolvedValue(createdTenant);

    const createdWallet = {
      id: 'wallet-1',
      tenantId: 'tenant-1',
      pendingBalance: 0.0,
      availableBalance: 0.0,
      totalEarned: 0.0,
    };
    mockPrisma.tenantWallet.create.mockResolvedValue(createdWallet);

    mockPrisma.user.update.mockResolvedValue({
      id: 'user-1',
      phone: '01712345678',
      role: Role.SELLER_OWNER,
      tenantId: 'tenant-1',
    });

    const user = {
      id: 'user-1',
      phone: '01712345678',
      role: Role.CUSTOMER,
      tenantId: null,
    };

    const res = await tenantService.onboard(user, {
      name: 'Rahim Fashion',
      slug: 'rahim-fashion',
    });

    expect(res.success).toBe(true);
    expect(res.tenant.slug).toBe('rahim-fashion');
    expect(res.wallet.pendingBalance).toBe(0.0);
    expect(res.user.role).toBe(Role.SELLER_OWNER);
  });

  it('should throw ConflictException if slug is already taken', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue({ id: 'existing' });

    const user = {
      id: 'user-1',
      phone: '01712345678',
      role: Role.CUSTOMER,
      tenantId: null,
    };

    await expect(
      tenantService.onboard(user, {
        name: 'Rahim Fashion',
        slug: 'rahim-fashion',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should resolve tenant storefront by slug', async () => {
    mockPrisma.tenant.findFirst.mockResolvedValue({
      id: 'tenant-1',
      name: 'Rahim Fashion',
      slug: 'rahim-fashion',
      isActive: true,
    });

    const res = await tenantService.resolve({ slug: 'rahim-fashion' });
    expect(res.name).toBe('Rahim Fashion');
  });
});

