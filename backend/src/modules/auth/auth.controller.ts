import { Controller, Post, Patch, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard, CurrentUser, type AuthenticatedUser } from '../../common/index.js';
import { ApiZodBody, ApiErrorResponses } from '../../common/index.js';
import { AuthService } from './auth.service.js';
import { registerSchema, loginSchema, refreshSchema, changePasswordSchema } from '@cordlyx/shared';
import { AuthTokensDto } from './auth.responses.js';

// Auth endpoints are throttled per IP (brute-force protection). The limit is
// overridable for load testing / e2e (CI sets LOGIN_RATE_LIMIT); prod default 10.
// Auth uses its own 'auth' throttler bucket (see AppModule): the storage block
// flag is per-key, so sharing the 'default' bucket would let data-traffic
// bursts lock users out of login for the whole block duration.
export const authThrottleLimit = Number.parseInt(process.env.LOGIN_RATE_LIMIT ?? '10', 10) || 10;

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Create account', security: [] })
  @ApiZodBody(registerSchema, 'Username, email, password and display name.')
  @ApiResponse({ status: 201, description: 'Account created, tokens issued.', type: AuthTokensDto })
  @ApiErrorResponses(400, 409, 429)
  @SkipThrottle({ default: true })
  @Throttle({ auth: { ttl: 60000, limit: authThrottleLimit } })
  async register(@Body() body: unknown) {
    const data = registerSchema.parse(body);
    return this.authService.register(data.username, data.email, data.password, data.name);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with username or email', security: [] })
  @ApiZodBody(loginSchema, 'Login (username or email) + password.')
  @ApiResponse({ status: 200, description: 'Tokens issued.', type: AuthTokensDto })
  @ApiErrorResponses(400, 401, 429)
  @SkipThrottle({ default: true })
  @Throttle({ auth: { ttl: 60000, limit: authThrottleLimit } })
  async login(@Body() body: unknown) {
    const data = loginSchema.parse(body);
    return this.authService.login(data.login, data.password);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token', security: [] })
  @ApiZodBody(refreshSchema, 'Current refresh token; a new pair is issued (rotation).')
  @ApiResponse({ status: 200, description: 'New token pair.', type: AuthTokensDto })
  @ApiErrorResponses(400, 401)
  @SkipThrottle()
  async refresh(@Body() body: unknown) {
    const data = refreshSchema.parse(body);
    return this.authService.refresh(data.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a refresh token and log out' })
  @ApiResponse({ status: 200, description: 'Logged out (also succeeds with missing/garbage token).' })
  @ApiErrorResponses(401)
  @UseGuards(JwtAuthGuard)
  async logout(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const data = refreshSchema.partial().parse(body);
    return this.authService.logout(user.id, data.refreshToken ?? null);
  }

  @Patch('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Change current password' })
  @ApiZodBody(changePasswordSchema)
  @ApiResponse({ status: 200, description: 'Password changed.' })
  @ApiErrorResponses(400, 401)
  async changePassword(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const data = changePasswordSchema.parse(body);
    await this.authService.changePassword(user.id, data.currentPassword, data.newPassword);
    return { message: 'Password changed' };
  }
}
