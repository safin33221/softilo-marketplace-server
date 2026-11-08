import { z } from 'zod';
import { OrderStatus } from '@prisma/client';

export const quickCheckoutItemSchema = z.object({
  productId: z.string().uuid('ভ্যালিড প্রোডাক্ট আইডি দিন (Valid product UUID required)'),
  quantity: z.number().int().positive('পরিমাণ ১ বা তার বেশি হতে হবে (Quantity must be at least 1)'),
});

export const quickCheckoutSchema = z.object({
  tenantId: z.string().min(1, 'টেন্যান্ট আইডি অথবা স্লাগ দিন (Tenant ID or slug required)'),
  customerName: z.string().min(2, 'কাস্টমারের নাম নূন্যতম ২ অক্ষর হতে হবে (Customer name required)'),
  customerPhone: z.string().min(1, 'মোবাইল নাম্বার দিন (Customer phone required)'),
  district: z.string().min(2, 'জেলার নাম দিন (District required)'),
  thana: z.string().min(2, 'থানা/উপজেলার নাম দিন (Thana required)'),
  fullAddress: z.string().min(5, 'সম্পূর্ণ ঠিকানা দিন (Full address required)'),
  deliveryCharge: z.number().nonnegative('ডেলিভারি চার্জ ০ বা তার বেশি হতে হবে').default(60),
  items: z.array(quickCheckoutItemSchema).min(1, 'কমপক্ষে ১টি প্রোডাক্ট যোগ করুন (At least 1 item required)'),
});

export type QuickCheckoutDto = z.infer<typeof quickCheckoutSchema>;

export const updateOrderStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
  courierProvider: z.string().optional(),
  trackingCode: z.string().optional(),
});

export type UpdateOrderStatusDto = z.infer<typeof updateOrderStatusSchema>;

export const listOrdersQuerySchema = z.object({
  status: z.nativeEnum(OrderStatus).optional(),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20)),
});

export type ListOrdersQueryDto = z.infer<typeof listOrdersQuerySchema>;

