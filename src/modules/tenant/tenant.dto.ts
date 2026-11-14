import { z } from 'zod';

export const onboardTenantSchema = z.object({
  name: z.string().min(2, 'দোকানের নাম নূন্যতম ২ অক্ষর হতে হবে (Shop name must be at least 2 chars)'),
  slug: z
    .string()
    .min(2, 'স্লাগ নূন্যতম ২ অক্ষর হতে হবে (Slug must be at least 2 chars)')
    .regex(/^[a-z0-9-]+$/, 'স্লাগে শুধু ইংরেজি ছোট অক্ষর, সংখ্যা ও হাইফেন থাকতে পারবে (Slug must be lowercase alphanumeric and hyphens)')
    .optional()
    .or(z.literal('')),
  customDomain: z.string().optional().or(z.literal('')),
  logoUrl: z.string().url('ভ্যালিড ইমেজ URL দিন (Valid logo URL required)').optional().or(z.literal('')),
  bannerUrl: z.string().url('ভ্যালিড ব্যানার URL দিন (Valid banner URL required)').optional().or(z.literal('')),
});

export type OnboardTenantDto = z.infer<typeof onboardTenantSchema>;

export const resolveTenantQuerySchema = z.object({
  slug: z.string().optional(),
  customDomain: z.string().optional(),
  id: z.string().optional(),
});

export type ResolveTenantQueryDto = z.infer<typeof resolveTenantQuerySchema>;


export const updateTenantSchema = z.object({
  name: z.string().min(2, 'দোকানের নাম ন্যূনতম ২ অক্ষর হতে হবে').optional(),
  customDomain: z.string().optional().or(z.literal('')),
  logoUrl: z.string().optional().or(z.literal('')),
  bannerUrl: z.string().optional().or(z.literal('')),
});

export type UpdateTenantDto = z.infer<typeof updateTenantSchema>;
