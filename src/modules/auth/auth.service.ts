import { Injectable, BadRequestException, Logger } from '@nestjs/common';
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
   * In development/testing, static OTP '1234' is permitted for zero-friction workflows.
   */
  async sendOtp(dto: SendOtpDto) {
    const normalizedPhone = normalizeBdPhone(dto.phone);

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

    this.logger.log(`[OTP Sent] Phone: ${normalizedPhone}, OTP: ${isDev ? otp : '****'}`);

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

    // 2. Find or Provision User based on normalized phone number
    let user = await this.prisma.user.findUnique({
      where: { phone: normalizedPhone },
    });

    if (!user) {
      const initialRole = dto.role ?? Role.CUSTOMER;
      user = await this.prisma.user.create({
        data: {
          phone: normalizedPhone,
          name: dto.name ?? null,
          role: initialRole,
        },
      });
    } else if (dto.name && !user.name) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { name: dto.name },
      });
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

