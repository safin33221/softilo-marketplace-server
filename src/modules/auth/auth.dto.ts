import { z } from 'zod';
import { Role } from '@prisma/client';

export const AuthPurposeEnum = z.enum(['SELLER_LOGIN', 'ONBOARD', 'CUSTOMER_LOGIN']);
export type AuthPurpose = z.infer<typeof AuthPurposeEnum>;

export const sendOtpSchema = z.object({
  phone: z.string().min(1, 'মোবাইল নাম্বার আবশ্যক (Phone is required)'),
  purpose: AuthPurposeEnum.optional().default('ONBOARD'),
});

export type SendOtpDto = z.infer<typeof sendOtpSchema>;

export const verifyOtpSchema = z.object({
  phone: z.string().min(1, 'মোবাইল নাম্বার আবশ্যক (Phone is required)'),
  otp: z.string().min(4, '৪ ডিজিটের ওটিপি দিন (4-digit OTP required)').max(6),
  name: z.string().optional(),
  role: z.nativeEnum(Role).optional(),
  purpose: AuthPurposeEnum.optional().default('ONBOARD'),
});

export type VerifyOtpDto = z.infer<typeof verifyOtpSchema>;

