import { Controller, Post, Body, HttpCode, HttpStatus, UsePipes } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import {
  sendOtpSchema,
  verifyOtpSchema,
  type SendOtpDto,
  type VerifyOtpDto,
} from './auth.dto.js';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/v1/auth/send-otp
   * Validates BD mobile number and dispatches 4-digit OTP.
   */
  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(sendOtpSchema))
  async sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto);
  }

  /**
   * POST /api/v1/auth/verify-otp
   * Verifies OTP, provisions or loads user profile, and returns signed JWT token.
   */
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(verifyOtpSchema))
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }
}

