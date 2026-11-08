import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrdersService } from './orders.service.js';
import { OrderStatus, Role } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('OrdersService', () => {
  let ordersService: OrdersService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      tenant: {
        findFirst: vi.fn(),
      },
      product: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      order: {
        create: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
      },
      tenantWallet: {
        upsert: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => {
        return cb(mockPrisma);
      }),
    };

    ordersService = new OrdersService(mockPrisma);
  });

  it('should process 1-click quick-checkout with correct platform fee & netSellerAmount', async () => {
    mockPrisma.tenant.findFirst.mockResolvedValue({
      id: 'tenant-1',
      name: 'Rahim Fashion',
      commissionRate: 5.0, // 5% fee
      isActive: true,
    });

    mockPrisma.product.findMany.mockResolvedValue([
      {
        id: 'prod-1',
        tenantId: 'tenant-1',
        title: 'Premium Shirt',
        price: 1000,
        discountPrice: null,
        stock: 5,
      },
    ]);

    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: 'cust-1',
      phone: '01712345678',
      role: Role.CUSTOMER,
    });

    mockPrisma.order.create.mockImplementation((args: any) => ({
      id: 'ord-1',
      orderNumber: args.data.orderNumber,
      totalAmount: args.data.totalAmount,
      platformFee: args.data.platformFee,
      netSellerAmount: args.data.netSellerAmount,
      status: OrderStatus.PENDING,
    }));

    const res = await ordersService.quickCheckout({
      tenantId: 'tenant-1',
      customerName: 'Karim',
      customerPhone: '01712345678',
      district: 'Dhaka',
      thana: 'Dhanmondi',
      fullAddress: 'Road 27, House 5',
      deliveryCharge: 60,
      items: [{ productId: 'prod-1', quantity: 2 }],
    });

    expect(res.success).toBe(true);
    // Subtotal = 1000 * 2 = 2000
    // Platform fee (5%) = 100
    // Total amount = 2000 + 60 = 2060
    // Net seller amount = 2060 - 100 = 1960
    expect(Number(res.order.platformFee)).toBe(100);
    expect(Number(res.order.totalAmount)).toBe(2060);
    expect(Number(res.order.netSellerAmount)).toBe(1960);
    expect(mockPrisma.product.update).toHaveBeenCalledWith({
      where: { id: 'prod-1' },
      data: { stock: { decrement: 2 } },
    });
    expect(mockPrisma.tenantWallet.upsert).toHaveBeenCalled();
  });

  it('should execute atomic markOrderDelivered and transfer pendingBalance to availableBalance', async () => {
    mockPrisma.order.findFirst.mockResolvedValue({
      id: 'ord-1',
      orderNumber: 'ORD-10024',
      tenantId: 'tenant-1',
      customerId: 'cust-1',
      subtotal: 2000,
      netSellerAmount: 1960,
      status: OrderStatus.CONFIRMED,
    });

    mockPrisma.order.update.mockResolvedValue({
      id: 'ord-1',
      status: OrderStatus.DELIVERED,
    });

    const res = await ordersService.markOrderDelivered('ord-1', 'tenant-1');

    expect(res.status).toBe(OrderStatus.DELIVERED);
    // Verified user loyalty points addition (2000 / 100 = 20 points)
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'cust-1' },
      data: {
        totalDelivered: { increment: 1 },
        loyaltyPoints: { increment: 20 },
      },
    });
    // Verified tenant wallet credit
    expect(mockPrisma.tenantWallet.update).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      data: {
        pendingBalance: { decrement: 1960 },
        availableBalance: { increment: 1960 },
        totalEarned: { increment: 1960 },
      },
    });
  });

  it('should reject markOrderDelivered if order is already DELIVERED', async () => {
    mockPrisma.order.findFirst.mockResolvedValue({
      id: 'ord-1',
      status: OrderStatus.DELIVERED,
    });

    await expect(
      ordersService.markOrderDelivered('ord-1', 'tenant-1'),
    ).rejects.toThrow(BadRequestException);
  });
});

