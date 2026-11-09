import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { normalizeBdPhone } from '../../common/utils/phone.js';
import { type SendOtpDto, type VerifyOtpDto } from './auth.dto.js';

interface InMemoryOtp {
  otp: string;
  expiresAt: Date;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  // Fast in-memory cache for OTP lookup (with 5 min expiry)
  private readonly otpCache = new Map<string, InMemoryOtp>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Generates and dispatches a 4-digit OTP to a valid Bangladeshi phone number.
   * Enforces role boundary checks:
   * - SELLER_LOGIN: Phone must belong to an existing registered seller.
   * - ONBOARD: Phone must NOT belong to an already onboarded store.
   */
  async sendOtp(dto: SendOtpDto) {
    const normalizedPhone = normalizeBdPhone(dto.phone);

    // 1. SELLER_LOGIN check: Phone MUST belong to an existing active seller!
    if (dto.purpose === 'SELLER_LOGIN') {
      const tenant = await this.prisma.tenant.findUnique({
        where: { phone: normalizedPhone },
      });

      const user = await this.prisma.user.findUnique({
        where: { phone: normalizedPhone },
      });

      const hasSellerAccess =
        (tenant && tenant.isActive) ||
        (user && (user.role === Role.SELLER_OWNER || user.role === Role.SUPER_ADMIN) && user.tenantId);

      if (!hasSellerAccess) {
        throw new NotFoundException(
          'এই নাম্বারে কোনো নিবন্ধিত সেলার অ্যাকাউন্ট পাওয়া যায়নি। অনুগ্রহ করে প্রথমে দোকান অনবোর্ডিং করুন। (No registered seller account found for this phone. Please onboard your shop first.)',
        );
      }
    }

    // 2. ONBOARD check: Phone MUST NOT already be registered to an existing tenant!
    if (dto.purpose === 'ONBOARD') {
      const existingTenant = await this.prisma.tenant.findUnique({
        where: { phone: normalizedPhone },
      });

      if (existingTenant) {
        throw new ConflictException(
          'এই নাম্বারে ইতিমধ্যে একটি দোকান নিবন্ধিত রয়েছে। অনুগ্রহ করে সরাসরি লগইন করুন। (A shop already exists for this phone number. Please login.)',
        );
      }
    }

    // Development or configured static OTP
    const isDev = process.env.NODE_ENV !== 'production';
    const devStaticOtp = process.env.DEV_STATIC_OTP ?? '1234';
    const otp = isDev ? devStaticOtp : Math.floor(1000 + Math.random() * 9000).toString();

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiration

    // 1. Store in memory for instant verification
    this.otpCache.set(normalizedPhone, { otp, expiresAt });

    // 2. Persist in database asynchronously if DB is reachable
    try {
      await this.prisma.otpRecord.create({
        data: {
          phone: normalizedPhone,
          otp,
          expiresAt,
        },
      });
    } catch (dbError) {
      this.logger.warn(`Could not persist OTP to database: ${(dbError as Error).message}`);
    }

    this.logger.log(`[OTP Sent] Phone: ${normalizedPhone}, Purpose: ${dto.purpose || 'ONBOARD'}, OTP: ${isDev ? otp : '****'}`);

    return {
      success: true,
      message: `৪-ডিজিট ওটিপি কোড পাঠানো হয়েছে (${normalizedPhone})`,
      normalizedPhone,
      ...(isDev ? { devOtp: otp } : {}),
    };
  }

  /**
   * Verifies the 4-digit OTP, authenticates or provisions the User, and issues a JWT token.
   */
  async verifyOtp(dto: VerifyOtpDto) {
    const normalizedPhone = normalizeBdPhone(dto.phone);
    const isDev = process.env.NODE_ENV !== 'production';
    const devStaticOtp = process.env.DEV_STATIC_OTP ?? '1234';

    // 1. Verify OTP against in-memory cache or dev default
    let isValid = false;
    const cached = this.otpCache.get(normalizedPhone);

    if (isDev && dto.otp === devStaticOtp) {
      isValid = true;
    } else if (cached && cached.otp === dto.otp && cached.expiresAt > new Date()) {
      isValid = true;
      this.otpCache.delete(normalizedPhone); // Consume OTP once verified
    } else {
      // Fallback: check database for valid unverified OTP
      try {
        const record = await this.prisma.otpRecord.findFirst({
          where: {
            phone: normalizedPhone,
            otp: dto.otp,
            verified: false,
            expiresAt: { gt: new Date() },
          },
          orderBy: { createdAt: 'desc' },
        });

        if (record) {
          isValid = true;
          await this.prisma.otpRecord.update({
            where: { id: record.id },
            data: { verified: true },
          });
        }
      } catch (err) {
        this.logger.warn(`Database error checking OTP: ${(err as Error).message}`);
      }
    }

    if (!isValid) {
      throw new BadRequestException('ভুল ওটিপি অথবা ওটিপির মেয়াদ শেষ হয়েছে (Invalid or expired OTP)');
    }

    // 2. Handle User Lookup, Role Enforcement, and Provisioning
    let user = await this.prisma.user.findUnique({
      where: { phone: normalizedPhone },
    });

    const tenant = await this.prisma.tenant.findUnique({
      where: { phone: normalizedPhone },
    });

    // For SELLER_LOGIN: Reject unauthorized users, buyers, or non-sellers
    if (dto.purpose === 'SELLER_LOGIN') {
      const hasSellerAccess =
        (tenant && tenant.isActive) ||
        (user && (user.role === Role.SELLER_OWNER || user.role === Role.SUPER_ADMIN) && user.tenantId);

      if (!hasSellerAccess) {
        throw new ForbiddenException(
          'শুধুমাত্র নিবন্ধিত সেলার এই পোর্টালে লগইন করতে পারবেন। সাধারণ ক্রেতাদের জন্য এই পোর্টাল নয়। (Only registered sellers can login to this portal.)',
        );
      }

      // If user had tenant phone match but tenantId was missing, link it
      if (!user && tenant) {
        user = await this.prisma.user.create({
          data: {
            phone: normalizedPhone,
            role: Role.SELLER_OWNER,
            tenantId: tenant.id,
            name: dto.name || tenant.name,
          },
        });
      } else if (user && tenant && (!user.tenantId || user.role !== Role.SELLER_OWNER)) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            role: Role.SELLER_OWNER,
            tenantId: tenant.id,
          },
        });
      }
    } else {
      // ONBOARD or CUSTOMER:
      if (!user) {
        const initialRole = dto.role ?? Role.CUSTOMER;
        user = await this.prisma.user.create({
          data: {
            phone: normalizedPhone,
            name: dto.name ?? null,
            role: initialRole,
            tenantId: tenant?.id ?? null,
          },
        });
      } else if (dto.name && !user.name) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { name: dto.name },
        });
      }
    }

    if (!user) {
      throw new BadRequestException('ইউজার একাউন্ট লোড করা সম্ভব হয়নি');
    }

    // 3. Issue signed JWT session token
    const tokenPayload = {
      sub: user.id,
      phone: user.phone,
      role: user.role,
      tenantId: user.tenantId,
    };

    const accessToken = await this.jwtService.signAsync(tokenPayload);

    return {
      success: true,
      message: 'ওটিপি সফলভাবে যাচাই করা হয়েছে (OTP verified successfully)',
      accessToken,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        loyaltyPoints: user.loyaltyPoints,
        totalDelivered: user.totalDelivered,
        totalReturned: user.totalReturned,
      },
    };
  }
}

