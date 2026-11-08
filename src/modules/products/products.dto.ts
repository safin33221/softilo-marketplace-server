import { z } from 'zod';

export const createProductSchema = z.object({
  title: z.string().min(2, 'প্রোডাক্টের নাম নূন্যতম ২ অক্ষর হতে হবে (Product title required)'),
  description: z.string().min(5, 'প্রোডাক্টের বিবরণ দিন (Product description required)'),
  price: z.number().positive('মূল্য ০ এর বেশি হতে হবে (Price must be positive)'),
  discountPrice: z.number().positive('ডিসকাউন্ট মূল্য ০ এর বেশি হতে হবে').optional(),
  stock: z.number().int().nonnegative('স্টক ০ বা তার বেশি হতে হবে (Stock must be non-negative)'),
  images: z
    .array(z.string().url('ভ্যালিড ইমেজ URL দিন (Valid image URL required)'))
    .min(1, 'কমপক্ষে ১টি ছবি দিতে হবে (At least 1 image required)')
    .max(4, 'সর্বোচ্চ ৪টি ছবি দেওয়া যাবে (Maximum 4 images allowed in v1.0)'),
});

export type CreateProductDto = z.infer<typeof createProductSchema>;

export const updateProductSchema = z.object({
  title: z.string().min(2).optional(),
  description: z.string().min(5).optional(),
  price: z.number().positive().optional(),
  discountPrice: z.number().positive().nullable().optional(),
  stock: z.number().int().nonnegative().optional(),
  images: z
    .array(z.string().url())
    .min(1)
    .max(4)
    .optional(),
  isCurated: z.boolean().optional(),
});

export type UpdateProductDto = z.infer<typeof updateProductSchema>;

export const listProductsQuerySchema = z.object({
  tenantId: z.string().optional(),
  tenantSlug: z.string().optional(),
  search: z.string().optional(),
  isCurated: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20)),
});

export type ListProductsQueryDto = z.infer<typeof listProductsQuerySchema>;

