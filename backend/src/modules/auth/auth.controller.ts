import { Controller, Post, Patch, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard, CurrentUser, type AuthenticatedUser } from '../../common/index.js';
import { AuthService } from './auth.service.js';
import { registerSchema, loginSchema, refreshSchema, changePasswordSchema } from '@cordlyx/shared';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async register(@Body() body: unknown) {
    const data = registerSchema.parse(body);
    return this.authService.register(data.username, data.email, data.password, data.name);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async login(@Body() body: unknown) {
    const data = loginSchema.parse(body);
    return this.authService.login(data.login, data.password);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @SkipThrottle()
  async refresh(@Body() body: unknown) {
    const data = refreshSchema.parse(body);
    return this.authService.refresh(data.refreshToken);
  }

  @Patch('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const data = changePasswordSchema.parse(body);
    await this.authService.changePassword(user.id, data.currentPassword, data.newPassword);
    return { message: 'Password changed' };
  }
}
