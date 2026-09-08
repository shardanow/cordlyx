import { Controller, Get, Patch, Post, Delete, Body, Query, UseGuards, UseInterceptors, UploadedFile, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiConsumes, ApiBody, ApiQuery } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiKeyOrJwtAuthGuard, CurrentUser, type AuthenticatedUser } from '../../common/index.js';
import { ApiZodBody, ApiErrorResponses } from '../../common/index.js';
import { UsersService } from './users.service.js';
import { StorageService } from '../../storage/storage.service.js';
import { updateUserSchema } from '@cordlyx/shared';

@ApiTags('Users')
@Controller('users')
@UseGuards(ApiKeyOrJwtAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly storageService: StorageService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'The current user.' })
  @ApiErrorResponses(401, 429)
  async getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getProfile(user.id);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search users by name or email (member picker)' })
  @ApiQuery({ name: 'q', required: true, description: 'Search text.', example: 'alice' })
  @ApiResponse({ status: 200, description: 'Matching users.' })
  @ApiErrorResponses(400, 401, 429)
  async search(@Query('q') q: string) {
    return this.usersService.search(q ?? '');
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update your profile (name, avatar)' })
  @ApiZodBody(updateUserSchema)
  @ApiResponse({ status: 200, description: 'The updated user.' })
  @ApiErrorResponses(400, 401, 429)
  async updateProfile(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const data = updateUserSchema.parse(body);
    return this.usersService.updateProfile(user.id, data);
  }

  @Post('me/avatar')
  @ApiOperation({ summary: 'Upload your avatar (JPEG/PNG/GIF/WebP, 5 MB max)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { avatar: { type: 'string', format: 'binary' } },
      required: ['avatar'],
    },
  })
  @ApiResponse({ status: 201, description: 'The user with the new avatar URL.' })
  @ApiErrorResponses(400, 401, 429)
  @UseInterceptors(FileInterceptor('avatar'))
  async uploadAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException('Only JPEG, PNG, GIF, and WebP images are allowed');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('File too large (max 5 MB)');
    }
    const result = await this.storageService.upload(file.buffer, {
      filename: file.originalname,
      mimeType: file.mimetype,
    });
    return this.usersService.updateAvatar(user.id, result.url);
  }

  @Delete('me')
  @ApiOperation({ summary: 'Delete your account (irreversible)' })
  @ApiResponse({ status: 204, description: 'Account deleted.' })
  @ApiErrorResponses(401, 429)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(@CurrentUser() user: AuthenticatedUser) {
    await this.usersService.deleteAccount(user.id);
  }
}
