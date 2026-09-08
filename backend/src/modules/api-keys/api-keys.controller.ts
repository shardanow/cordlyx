import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, CurrentUser, type AuthenticatedUser } from '../../common/index.js';
import { ApiZodBody, ApiUuidParam, ApiErrorResponses } from '../../common/index.js';
import { ApiKeyResponseDto } from '../../common/index.js';
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
  @ApiOperation({ summary: 'List my API keys (secret hashes never exposed)' })
  @ApiResponse({ status: 200, description: 'API keys with last-used date and budget (plain array).', type: ApiKeyResponseDto, isArray: true })
  @ApiErrorResponses(401, 429)
  async list(@CurrentUser() user: AuthenticatedUser) {
    return this.apiKeysService.list(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create an API key (secret returned once — store it)' })
  @ApiZodBody(createApiKeySchema, 'Name, optional project scope / expiry / budget (1–10000 req/min).')
  @ApiResponse({ status: 201, description: 'The key including the one-time secret.', type: ApiKeyResponseDto })
  @ApiErrorResponses(400, 401, 429)
  async create(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const data = createApiKeySchema.parse(body);
    return this.apiKeysService.create(user.id, data);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename a key or change its budget (1–10000 req/min)' })
  @ApiUuidParam('id', 'API key id.')
  @ApiZodBody(updateApiKeySchema)
  @ApiResponse({ status: 200, description: 'The updated key (secret never exposed).', type: ApiKeyResponseDto })
  @ApiErrorResponses(400, 401, 404, 429)
  async update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: unknown) {
    const data = updateApiKeySchema.parse(body);
    return this.apiKeysService.update(user.id, id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Revoke an API key immediately' })
  @ApiUuidParam('id', 'API key id.')
  @ApiResponse({ status: 200, description: '{ success: true }.' })
  @ApiErrorResponses(401, 404, 429)
  async revoke(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.apiKeysService.revoke(user.id, id);
  }
}
