import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from './auth.service.js';
import { Role } from '@prisma/client';

describe('AuthService', () => {
  let authService: AuthService;
  let mockPrisma: any;
  let mockJwtService: any;

  beforeEach(() => {
    mockPrisma = {
      otpRecord: {
        create: vi.fn().mockResolvedValue({ id: '1' }),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };

    mockJwtService = {
      signAsync: vi.fn().mockResolvedValue('fake-jwt-token'),
    };

    authService = new AuthService(mockPrisma, mockJwtService);
  });

  it('should send OTP to normalized BD phone number', async () => {
    const res = await authService.sendOtp({ phone: '+8801712345678' });
    expect(res.success).toBe(true);
    expect(res.normalizedPhone).toBe('01712345678');
  });

  it('should verify dev static OTP and provision user if not existing', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: 'user-1',
      phone: '01712345678',
      name: 'Test Seller',
      role: Role.SELLER_OWNER,
      tenantId: null,
      loyaltyPoints: 0,
      totalDelivered: 0,
      totalReturned: 0,
    });

    const res = await authService.verifyOtp({
      phone: '01712345678',
      otp: '1234',
      name: 'Test Seller',
      role: Role.SELLER_OWNER,
    });

    expect(res.success).toBe(true);
    expect(res.accessToken).toBe('fake-jwt-token');
    expect(res.user.phone).toBe('01712345678');
    expect(mockPrisma.user.create).toHaveBeenCalled();
  });
});

