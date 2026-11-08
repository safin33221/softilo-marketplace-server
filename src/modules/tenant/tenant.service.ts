import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { generateSlug } from '../../common/utils/slug.js';
import { type AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { type OnboardTenantDto, type ResolveTenantQueryDto } from './tenant.dto.js';

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Onboards a seller shop with zero upfront fees.
   * Creates Tenant record, generates TenantWallet with 0.00 balance,
   * and links user to SELLER_OWNER role with tenantId in an atomic transaction.
   */
  async onboard(user: AuthenticatedUser, dto: OnboardTenantDto) {
    if (user.tenantId) {
      const existingShop = await this.prisma.tenant.findUnique({
        where: { id: user.tenantId },
      });
      if (existingShop) {
        throw new ConflictException(
          'আপনার একাউন্টে ইতিমধ্যে একটি শপ নিবন্ধিত রয়েছে (Seller already has an onboarded shop)',
        );
      }
    }

    // 1. Generate and validate unique slug
    const targetSlug = generateSlug(dto.slug || dto.name);
    if (!targetSlug || targetSlug.length < 2) {
      throw new BadRequestException('একটি অর্থপূর্ণ শপ স্লাগ প্রদান করুন (Provide a valid shop slug)');
    }

    const slugTaken = await this.prisma.tenant.findUnique({
      where: { slug: targetSlug },
    });
    if (slugTaken) {
      throw new ConflictException(
        `'${targetSlug}' স্লাগটি ইতিমধ্যে ব্যবহৃত। অন্য একটি স্লাগ বাছাই করুন (Slug is already taken)`,
      );
    }

    // 2. Check phone uniqueness on tenant table
    const phoneTaken = await this.prisma.tenant.findUnique({
      where: { phone: user.phone },
    });
    if (phoneTaken) {
      throw new ConflictException(
        'এই ফোন নাম্বারে ইতিমধ্যে একটি শপ খোলা হয়েছে (A shop already exists for this phone number)',
      );
    }

    // 3. Atomically create Tenant, zero-balance TenantWallet, and update User
    return await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: dto.name,
          slug: targetSlug,
          customDomain: dto.customDomain || null,
          phone: user.phone,
          logoUrl: dto.logoUrl || null,
          bannerUrl: dto.bannerUrl || null,
          commissionRate: 5.0, // Default 5% platform fee
          trustScore: 100.0,
          isVerified: false, // Curated approval gatekeeper
          isActive: true,
        },
      });

      const wallet = await tx.tenantWallet.create({
        data: {
          tenantId: tenant.id,
          pendingBalance: 0.0,
          availableBalance: 0.0,
          totalEarned: 0.0,
        },
      });

      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: {
          role: Role.SELLER_OWNER,
          tenantId: tenant.id,
        },
      });

      return {
        success: true,
        message: 'সেলার অনবোর্ডিং সফল হয়েছে (Seller onboarded successfully)',
        tenant,
        wallet,
        user: {
          id: updatedUser.id,
          phone: updatedUser.phone,
          role: updatedUser.role,
          tenantId: updatedUser.tenantId,
        },
      };
    });
  }

  /**
   * Resolves a tenant by slug, custom domain, or ID for multi-tenant storefront rendering.
   */
  async resolve(query: ResolveTenantQueryDto) {
    if (!query.slug && !query.customDomain && !query.id) {
      throw new BadRequestException('slug, customDomain, বা id প্যারামিটার দিন (Must provide slug, customDomain, or id)');
    }

    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [
          query.slug ? { slug: query.slug } : {},
          query.customDomain ? { customDomain: query.customDomain } : {},
          query.id ? { id: query.id } : {},
        ],
      },
      select: {
        id: true,
        name: true,
        slug: true,
        customDomain: true,
        logoUrl: true,
        bannerUrl: true,
        trustScore: true,
        isVerified: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!tenant || !tenant.isActive) {
      throw new NotFoundException(
        'শপটি খুঁজে পাওয়া যায়নি অথবা স্থগিত রয়েছে (Storefront not found or suspended)',
      );
    }

    return tenant;
  }

  /**
   * Returns current seller's tenant details with wallet summary.
   */
  async getMe(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        wallet: true,
        _count: {
          select: { products: true, orders: true },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('টেন্যান্ট খুঁজে পাওয়া যায়নি (Tenant not found)');
    }

    return tenant;
  }

  /**
   * Fetches real-time tenant wallet balances.
   */
  async getWallet(tenantId: string) {
    let wallet = await this.prisma.tenantWallet.findUnique({
      where: { tenantId },
    });

    // Auto-initialize wallet if missing
    if (!wallet) {
      wallet = await this.prisma.tenantWallet.create({
        data: {
          tenantId,
          pendingBalance: 0.0,
          availableBalance: 0.0,
          totalEarned: 0.0,
        },
      });
    }

    return wallet;
  }

  /**
   * Super Admin approval gatekeeper to verify seller shop.
   */
  async verifyTenant(tenantId: string, isVerified: boolean) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('টেন্যান্ট শপ পাওয়া যায়নি');
    }

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { isVerified },
    });

    return {
      success: true,
      message: isVerified ? 'শপ ভেরিফিকেশন সফল হয়েছে' : 'শপ ভেরিফিকেশন বাতিল করা হয়েছে',
      tenant: updated,
    };
  }
}

