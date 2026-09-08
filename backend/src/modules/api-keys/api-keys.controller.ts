import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, CurrentUser, type AuthenticatedUser } from '../../common/index.js';
import { ApiKeysService } from './api-keys.service.js';
import { DEFAULT_API_KEY_RATE_LIMIT } from '../../database/schema/api-keys.js';
import { z } from 'zod';

const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  projectId: z.string().uuid().optional(),
  expiresAt: z.string().datetime().optional(),
  rateLimitPerMin: z.number().int().min(1).max(10000).optional().default(DEFAULT_API_KEY_RATE_LIMIT),
});

const updateApiKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  rateLimitPerMin: z.number().int().min(1).max(10000).optional(),
});

@ApiTags('api-keys')
@Controller('api-keys')
@UseGuards(JwtAuthGuard)
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    return this.apiKeysService.list(user.id);
  }

  @Post()
  async create(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const data = createApiKeySchema.parse(body);
    return this.apiKeysService.create(user.id, data);
  }

  @Patch(':id')
  async update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: unknown) {
    const data = updateApiKeySchema.parse(body);
    return this.apiKeysService.update(user.id, id, data);
  }

  @Delete(':id')
  async revoke(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.apiKeysService.revoke(user.id, id);
  }
}
