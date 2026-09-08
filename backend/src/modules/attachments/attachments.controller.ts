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
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ApiKeyOrJwtAuthGuard, ProjectMembershipGuard, ProjectRoleGuard, MinimumRole, CurrentUser, type AuthenticatedUser } from '../../common/index.js';
import { ApiProjectSlugParam, ApiUuidParam, ApiErrorResponses } from '../../common/index.js';
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
  @ApiOperation({ summary: 'List attachments of an item' })
  @ApiProjectSlugParam()
  @ApiUuidParam('itemId', 'Item id.')
  @ApiResponse({ status: 200, description: 'Attachment list.' })
  @ApiErrorResponses(401, 403, 404, 429)
  async list(@Req() req: Request, @Param('itemId') itemId: string) {
    await assertItemInProject(req.projectId as string, itemId);
    return this.attachmentsService.getByItem(itemId);
  }

  @Post()
  @ApiOperation({ summary: 'Upload a file attachment (MIME + magic-byte validated, 10 MB max)' })
  @ApiProjectSlugParam()
  @ApiUuidParam('itemId', 'Item id.')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 201, description: 'The created attachment.' })
  @ApiErrorResponses(400, 401, 403, 404, 429)
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
  @ApiOperation({ summary: 'Delete an attachment (shows a placeholder on the item)' })
  @ApiProjectSlugParam()
  @ApiUuidParam('itemId', 'Item id.')
  @ApiUuidParam('id', 'Attachment id.')
  @ApiResponse({ status: 200, description: 'Deletion result.' })
  @ApiErrorResponses(401, 403, 404, 429)
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
