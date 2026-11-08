import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Prisma, OrderStatus, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { normalizeBdPhone } from '../../common/utils/phone.js';
import { type AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import {
  type QuickCheckoutDto,
  type UpdateOrderStatusDto,
  type ListOrdersQueryDto,
} from './orders.dto.js';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 1-Click Guest & Customer Checkout API (POST /api/v1/orders/quick-checkout)
   * 
   * Workflow:
   * 1. Normalizes 11-digit BD phone number.
   * 2. Auto-provisions CUSTOMER account if user does not exist.
   * 3. Validates product stock and tenant boundary.
   * 4. Calculates subtotal, platform commission fee (e.g. 5%), and net seller amount.
   * 5. Atomically creates Order, OrderItems, decrements stock, and credits seller's pendingBalance.
   */
  async quickCheckout(dto: QuickCheckoutDto) {
    const normalizedPhone = normalizeBdPhone(dto.customerPhone);

    // 1. Resolve Tenant by ID or Slug
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [{ id: dto.tenantId }, { slug: dto.tenantId }],
      },
    });

    if (!tenant || !tenant.isActive) {
      throw new NotFoundException('টেন্যান্ট শপ পাওয়া যায়নি বা নিষ্ক্রিয় রয়েছে (Tenant shop not found or inactive)');
    }

    const tenantId = tenant.id;

    // 2. Fetch and validate all products
    const productIds = dto.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        tenantId, // Strict Tenant Isolation: products must belong to this tenant
      },
    });

    if (products.length !== productIds.length) {
      throw new BadRequestException('এক বা একাধিক প্রোডাক্ট পাওয়া যায়নি বা এই শপের অন্তর্ভুক্ত নয়');
    }

    // Check stock availability and prepare order items
    let subtotal = 0;
    const preparedItems: {
      productId: string;
      productName: string;
      quantity: number;
      unitPrice: Prisma.Decimal;
    }[] = [];

    for (const item of dto.items) {
      const product = products.find((p) => p.id === item.productId)!;
      if (product.stock < item.quantity) {
        throw new BadRequestException(
          `দুঃখিত, '${product.title}' পর্যাপ্ত স্টকে নেই। বর্তমান স্টক: ${product.stock}`,
        );
      }

      // Use discountPrice if provided and active, otherwise standard price
      const effectivePrice = product.discountPrice
        ? Number(product.discountPrice)
        : Number(product.price);

      subtotal += effectivePrice * item.quantity;

      preparedItems.push({
        productId: product.id,
        productName: product.title,
        quantity: item.quantity,
        unitPrice: new Prisma.Decimal(effectivePrice),
      });
    }

    // 3. Financial Breakdown Calculations (Zero-Hidden-Fee Transparency)
    const deliveryCharge = Number(dto.deliveryCharge ?? 60);
    const discountAmount = 0.0;
    const totalAmount = subtotal + deliveryCharge - discountAmount;

    // Commission deducted from subtotal according to tenant.commissionRate (e.g. 5%)
    const commissionRate = Number(tenant.commissionRate ?? 5.0);
    const platformFee = Number(((subtotal * commissionRate) / 100).toFixed(2));
    const netSellerAmount = Number((totalAmount - platformFee).toFixed(2));

    // Unique human-readable Order Number: ORD-XXXXXX
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `ORD-${Date.now().toString().slice(-6)}${randomSuffix}`;

    // 4. Atomic Transaction: User Provisioning + Stock Decrement + Order Creation + Wallet Update
    return await this.prisma.$transaction(async (tx) => {
      // Find or auto-create Customer User
      let customer = await tx.user.findUnique({
        where: { phone: normalizedPhone },
      });

      if (!customer) {
        customer = await tx.user.create({
          data: {
            phone: normalizedPhone,
            name: dto.customerName,
            role: Role.CUSTOMER,
          },
        });
      }

      // Decrement product stock
      for (const item of dto.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      // Create Order record
      const order = await tx.order.create({
        data: {
          orderNumber,
          tenantId,
          customerId: customer.id,
          customerName: dto.customerName,
          customerPhone: normalizedPhone,
          district: dto.district,
          thana: dto.thana,
          fullAddress: dto.fullAddress,
          subtotal: new Prisma.Decimal(subtotal),
          deliveryCharge: new Prisma.Decimal(deliveryCharge),
          discountAmount: new Prisma.Decimal(discountAmount),
          totalAmount: new Prisma.Decimal(totalAmount),
          platformFee: new Prisma.Decimal(platformFee),
          netSellerAmount: new Prisma.Decimal(netSellerAmount),
          status: OrderStatus.PENDING,
          items: {
            create: preparedItems,
          },
        },
        include: {
          items: true,
        },
      });

      // Ensure tenant wallet exists and credit pending balance
      await tx.tenantWallet.upsert({
        where: { tenantId },
        create: {
          tenantId,
          pendingBalance: new Prisma.Decimal(netSellerAmount),
          availableBalance: new Prisma.Decimal(0),
          totalEarned: new Prisma.Decimal(0),
        },
        update: {
          pendingBalance: { increment: new Prisma.Decimal(netSellerAmount) },
        },
      });

      this.logger.log(
        `[Order Placed] #${order.orderNumber}, Tenant: ${tenantId}, Net Seller: ৳${netSellerAmount}, Platform Fee: ৳${platformFee}`,
      );

      return {
        success: true,
        message: 'অর্ডার সফলভাবে সম্পন্ন হয়েছে (Order placed successfully)',
        order,
      };
    });
  }

  /**
   * Automatic Commission & Wallet Settlement Logic (v1.0 Core)
   * Executed atomically when order status transitions to DELIVERED.
   */
  async markOrderDelivered(orderId: string, tenantId: string) {
    return await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, tenantId },
      });

      if (!order) {
        throw new NotFoundException('অর্ডারটি পাওয়া যায়নি (Order not found)');
      }

      if (order.status === OrderStatus.DELIVERED) {
        throw new BadRequestException('অর্ডারটি ইতিমধ্যে ডেলিভারি হয়েছে (Order already marked delivered)');
      }

      // 1. Update order status to DELIVERED
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.DELIVERED },
      });

      // 2. Increment customer delivery success count & loyalty points (1 point per 100 BDT)
      const earnedPoints = Math.floor(Number(order.subtotal) / 100);
      await tx.user.update({
        where: { id: order.customerId },
        data: {
          totalDelivered: { increment: 1 },
          loyaltyPoints: { increment: earnedPoints },
        },
      });

      // 3. Settle seller wallet: transfer netSellerAmount from pending to available & totalEarned
      await tx.tenantWallet.update({
        where: { tenantId },
        data: {
          pendingBalance: { decrement: order.netSellerAmount },
          availableBalance: { increment: order.netSellerAmount },
          totalEarned: { increment: order.netSellerAmount },
        },
      });

      this.logger.log(
        `[Order Delivered & Settled] Order: ${order.orderNumber}, Credited ৳${order.netSellerAmount.toString()} to Tenant: ${tenantId}`,
      );

      return updatedOrder;
    });
  }

  /**
   * Updates order status and courier tracking info.
   * Handles stock return on CANCELLED / RETURNED and invokes markOrderDelivered on DELIVERED.
   */
  async updateStatus(
    orderId: string,
    tenantId: string,
    dto: UpdateOrderStatusDto,
    userRole: Role,
  ) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        ...(userRole === Role.SUPER_ADMIN ? {} : { tenantId }),
      },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('অর্ডারটি পাওয়া যায়নি (Order not found)');
    }

    const currentStatus = order.status;
    const targetStatus = dto.status;

    if (currentStatus === targetStatus) {
      // Just update courier tracking if provided
      return await this.prisma.order.update({
        where: { id: orderId },
        data: {
          courierProvider: dto.courierProvider ?? order.courierProvider,
          trackingCode: dto.trackingCode ?? order.trackingCode,
        },
      });
    }

    // Cannot modify status once already DELIVERED
    if (currentStatus === OrderStatus.DELIVERED) {
      throw new BadRequestException('ডেলিভারি সম্পন্ন হওয়া অর্ডারের স্ট্যাটাস পরিবর্তন করা যাবে না');
    }

    // Transition to DELIVERED: execute atomic settlement
    if (targetStatus === OrderStatus.DELIVERED) {
      if (dto.courierProvider || dto.trackingCode) {
        await this.prisma.order.update({
          where: { id: orderId },
          data: {
            courierProvider: dto.courierProvider ?? order.courierProvider,
            trackingCode: dto.trackingCode ?? order.trackingCode,
          },
        });
      }
      return await this.markOrderDelivered(orderId, order.tenantId);
    }

    // Transition to CANCELLED or RETURNED: Restock products and revert pending balance
    if (targetStatus === OrderStatus.CANCELLED || targetStatus === OrderStatus.RETURNED) {
      return await this.prisma.$transaction(async (tx) => {
        // 1. Restock items
        for (const item of order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }

        // 2. Decrement pending balance in seller wallet
        await tx.tenantWallet.update({
          where: { tenantId: order.tenantId },
          data: {
            pendingBalance: { decrement: order.netSellerAmount },
          },
        });

        // 3. If RETURNED, increment customer totalReturned count
        if (targetStatus === OrderStatus.RETURNED) {
          await tx.user.update({
            where: { id: order.customerId },
            data: { totalReturned: { increment: 1 } },
          });
        }

        // 4. Update order status
        return await tx.order.update({
          where: { id: orderId },
          data: {
            status: targetStatus,
            courierProvider: dto.courierProvider ?? order.courierProvider,
            trackingCode: dto.trackingCode ?? order.trackingCode,
          },
        });
      });
    }

    // Standard status update (CONFIRMED, IN_COURIER)
    return await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: targetStatus,
        courierProvider: dto.courierProvider ?? order.courierProvider,
        trackingCode: dto.trackingCode ?? order.trackingCode,
      },
    });
  }

  /**
   * Lists orders with role-based and multi-tenant isolation.
   */
  async findAll(user: AuthenticatedUser, query: ListOrdersQueryDto) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(50, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const whereClause: Prisma.OrderWhereInput = query.status ? { status: query.status } : {};

    // Strict Role-Based Isolation:
    if (user.role === Role.SELLER_OWNER) {
      if (!user.tenantId) {
        throw new ForbiddenException('Seller tenant not linked');
      }
      whereClause.tenantId = user.tenantId; // Seller only sees their tenant's orders
    } else if (user.role === Role.CUSTOMER) {
      whereClause.customerId = user.id; // Customer only sees their own orders
    }

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where: whereClause,
        include: {
          items: true,
          tenant: {
            select: { id: true, name: true, slug: true, phone: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where: whereClause }),
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
   * Fetches single order with tenant isolation verification.
   */
  async findOne(orderId: string, user: AuthenticatedUser) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        tenant: {
          select: { id: true, name: true, slug: true, phone: true },
        },
        customer: {
          select: { id: true, name: true, phone: true, loyaltyPoints: true },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('অর্ডারটি পাওয়া যায়নি (Order not found)');
    }

    // Role-based security check
    if (user.role === Role.SELLER_OWNER && order.tenantId !== user.tenantId) {
      throw new ForbiddenException('অন্য টেন্যান্টের অর্ডার দেখার অনুমতি নেই');
    }

    if (user.role === Role.CUSTOMER && order.customerId !== user.id) {
      throw new ForbiddenException('এই অর্ডারটি দেখার অনুমতি নেই');
    }

    return order;
  }
}
