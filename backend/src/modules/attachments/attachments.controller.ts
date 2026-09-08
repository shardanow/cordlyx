import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UploadedFile,
  UseGuards,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ApiKeyOrJwtAuthGuard, ProjectMembershipGuard, ProjectRoleGuard, MinimumRole, CurrentUser, type AuthenticatedUser } from '../../common/index.js';
import { assertItemInProject } from '../../common/assert-item.js';
import { AttachmentsService } from './attachments.service.js';

@ApiTags('attachments')
@Controller('projects/:projectSlug/items/:itemId/attachments')
@UseGuards(ApiKeyOrJwtAuthGuard, ProjectMembershipGuard)
export class AttachmentsController {
  constructor(
    private readonly attachmentsService: AttachmentsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Get()
  async list(@Req() req: Request, @Param('itemId') itemId: string) {
    await assertItemInProject(req.projectId as string, itemId);
    return this.attachmentsService.getByItem(itemId);
  }

  @Post()
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('member')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @Param('itemId') itemId: string,
    @Req() req: Request,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    await assertItemInProject(req.projectId as string, itemId);
    const attachment = await this.attachmentsService.upload(itemId, user.id, file);
    this.eventEmitter.emit('attachment.created', {
      projectId: req.projectId,
      itemId,
      actorId: user.id,
      filename: attachment?.originalFilename ?? null,
    });
    return attachment;
  }

  @Delete(':id')
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('member')
  async delete(
    @Param('itemId') itemId: string,
    @Param('id') id: string,
    @Req() req: Request,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await assertItemInProject(req.projectId as string, itemId);
    const result = await this.attachmentsService.delete(id, itemId);
    this.eventEmitter.emit('attachment.deleted', {
      projectId: req.projectId,
      itemId,
      actorId: user.id,
    });
    return result;
  }
}
