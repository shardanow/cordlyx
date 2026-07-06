import { Controller, Get, Patch, Post, Delete, Body, Query, UseGuards, UseInterceptors, UploadedFile, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard, CurrentUser, type AuthenticatedUser } from '../../common/index.js';
import { UsersService } from './users.service.js';
import { StorageService } from '../../storage/storage.service.js';
import { updateUserSchema } from '@cordlyx/shared';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly storageService: StorageService,
  ) {}

  @Get('me')
  async getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getProfile(user.id);
  }

  @Get('search')
  async search(@Query('q') q: string) {
    return this.usersService.search(q ?? '');
  }

  @Patch('me')
  async updateProfile(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const data = updateUserSchema.parse(body);
    return this.usersService.updateProfile(user.id, data);
  }

  @Post('me/avatar')
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
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(@CurrentUser() user: AuthenticatedUser) {
    await this.usersService.deleteAccount(user.id);
  }
}
