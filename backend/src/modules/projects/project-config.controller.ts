import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, UseInterceptors, UploadedFile, Req, Res, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ApiKeyOrJwtAuthGuard, ProjectMembershipGuard, ProjectRoleGuard, MinimumRole } from '../../common/index.js';
import {
  ApiZodBody,
  ApiProjectSlugParam,
  ApiUuidParam,
  ApiDryRunQuery,
  ApiErrorResponses,
  ApiListResponse,
} from '../../common/index.js';
import { ProjectConfigService } from './project-config.service.js';
import { ProjectConfigTransferService } from './project-config-transfer.service.js';
import { TRANSFER_MAX_BYTES, parseFlag } from '../../common/transfer.util.js';
import { createItemTypeSchema, createItemStatusSchema, createItemPrioritySchema } from '@cordlyx/shared';

@ApiTags('project-config')
@Controller('projects/:projectSlug')
@UseGuards(ApiKeyOrJwtAuthGuard, ProjectMembershipGuard)
export class ProjectConfigController {
  constructor(
    private readonly configService: ProjectConfigService,
    private readonly transferService: ProjectConfigTransferService,
  ) {}

  // --- Types ---

  @Get('types')
  @ApiOperation({ summary: 'List item types' })
  @ApiProjectSlugParam()
  @ApiListResponse('Item types, e.g. Task / Bug / Feature.')
  @ApiErrorResponses(401, 403, 429)
  async getTypes(@Req() req: Request) {
    return this.configService.getTypes(req.projectId as string);
  }

  @Post('types')
  @ApiOperation({ summary: 'Create an item type (admin only)' })
  @ApiProjectSlugParam()
  @ApiZodBody(createItemTypeSchema)
  @ApiResponse({ status: 201, description: 'The created type.' })
  @ApiErrorResponses(400, 401, 403, 429)
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('admin')
  async createType(@Req() req: Request, @Body() body: unknown) {
    const data = createItemTypeSchema.parse(body);
    return this.configService.createType(req.projectId as string, data);
  }

  @Patch('types/:id')
  @ApiOperation({ summary: 'Update an item type (admin only, partial)' })
  @ApiProjectSlugParam()
  @ApiUuidParam('id', 'Type id.')
  @ApiZodBody(createItemTypeSchema.partial())
  @ApiResponse({ status: 200, description: 'The updated type.' })
  @ApiErrorResponses(400, 401, 403, 404, 429)
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('admin')
  async updateType(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    const data = createItemTypeSchema.partial().parse(body);
    return this.configService.updateType(req.projectId as string, id, data);
  }

  @Delete('types/:id')
  @ApiOperation({ summary: 'Delete an item type (admin only)' })
  @ApiProjectSlugParam()
  @ApiUuidParam('id', 'Type id.')
  @ApiResponse({ status: 200, description: '{ success: true }.' })
  @ApiErrorResponses(401, 403, 404, 429)
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('admin')
  async deleteType(@Req() req: Request, @Param('id') id: string) {
    await this.configService.deleteType(req.projectId as string, id);
    return { success: true };
  }

  // --- Statuses ---

  @Get('statuses')
  @ApiOperation({ summary: 'List item statuses' })
  @ApiProjectSlugParam()
  @ApiListResponse('Item statuses, e.g. To Do / In Progress / Done.')
  @ApiErrorResponses(401, 403, 429)
  async getStatuses(@Req() req: Request) {
    return this.configService.getStatuses(req.projectId as string);
  }

  @Post('statuses')
  @ApiOperation({ summary: 'Create an item status (admin only)' })
  @ApiProjectSlugParam()
  @ApiZodBody(createItemStatusSchema)
  @ApiResponse({ status: 201, description: 'The created status.' })
  @ApiErrorResponses(400, 401, 403, 429)
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('admin')
  async createStatus(@Req() req: Request, @Body() body: unknown) {
    const data = createItemStatusSchema.parse(body);
    return this.configService.createStatus(req.projectId as string, data);
  }

  @Patch('statuses/:id')
  @ApiOperation({ summary: 'Update an item status (admin only, partial)' })
  @ApiProjectSlugParam()
  @ApiUuidParam('id', 'Status id.')
  @ApiZodBody(createItemStatusSchema.partial())
  @ApiResponse({ status: 200, description: 'The updated status.' })
  @ApiErrorResponses(400, 401, 403, 404, 429)
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('admin')
  async updateStatus(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    const data = createItemStatusSchema.partial().parse(body);
    return this.configService.updateStatus(req.projectId as string, id, data);
  }

  @Delete('statuses/:id')
  @ApiOperation({ summary: 'Delete an item status (admin only)' })
  @ApiProjectSlugParam()
  @ApiUuidParam('id', 'Status id.')
  @ApiResponse({ status: 200, description: '{ success: true }.' })
  @ApiErrorResponses(401, 403, 404, 429)
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('admin')
  async deleteStatus(@Req() req: Request, @Param('id') id: string) {
    await this.configService.deleteStatus(req.projectId as string, id);
    return { success: true };
  }

  // --- Priorities ---

  @Get('priorities')
  @ApiOperation({ summary: 'List item priorities' })
  @ApiProjectSlugParam()
  @ApiListResponse('Item priorities, e.g. Critical / Medium / Low.')
  @ApiErrorResponses(401, 403, 429)
  async getPriorities(@Req() req: Request) {
    return this.configService.getPriorities(req.projectId as string);
  }

  @Post('priorities')
  @ApiOperation({ summary: 'Create an item priority (admin only)' })
  @ApiProjectSlugParam()
  @ApiZodBody(createItemPrioritySchema)
  @ApiResponse({ status: 201, description: 'The created priority.' })
  @ApiErrorResponses(400, 401, 403, 429)
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('admin')
  async createPriority(@Req() req: Request, @Body() body: unknown) {
    const data = createItemPrioritySchema.parse(body);
    return this.configService.createPriority(req.projectId as string, data);
  }

  @Patch('priorities/:id')
  @ApiOperation({ summary: 'Update an item priority (admin only, partial)' })
  @ApiProjectSlugParam()
  @ApiUuidParam('id', 'Priority id.')
  @ApiZodBody(createItemPrioritySchema.partial())
  @ApiResponse({ status: 200, description: 'The updated priority.' })
  @ApiErrorResponses(400, 401, 403, 404, 429)
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('admin')
  async updatePriority(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    const data = createItemPrioritySchema.partial().parse(body);
    return this.configService.updatePriority(req.projectId as string, id, data);
  }

  @Delete('priorities/:id')
  @ApiOperation({ summary: 'Delete an item priority (admin only)' })
  @ApiProjectSlugParam()
  @ApiUuidParam('id', 'Priority id.')
  @ApiResponse({ status: 200, description: '{ success: true }.' })
  @ApiErrorResponses(401, 403, 404, 429)
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('admin')
  async deletePriority(@Req() req: Request, @Param('id') id: string) {
    await this.configService.deletePriority(req.projectId as string, id);
    return { success: true };
  }

  // --- Config transfer (types + statuses + priorities + tags as one JSON template) ---

  @Get('config/export')
  @ApiOperation({ summary: 'Export project config (types, statuses, priorities, tags) as a JSON template' })
  @ApiProjectSlugParam()
  @ApiResponse({ status: 200, description: 'File download with Content-Disposition: attachment' })
  @ApiErrorResponses(401, 403, 429)
  async exportConfig(
    @Param('projectSlug') slug: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const body = await this.transferService.exportConfig(req.projectId as string);
    res.set({
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slug}-config.json"`,
    });
    return JSON.stringify(body, null, 2);
  }

  @Post('config/import')
  @ApiOperation({ summary: 'Import a config JSON template (upsert by name, never deletes)' })
  @ApiProjectSlugParam()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } }, required: ['file'] },
  })
  @ApiDryRunQuery()
  @ApiResponse({ status: 201, description: 'Per-entry results: created | updated | unchanged | failed' })
  @ApiErrorResponses(400, 401, 403, 429)
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('admin')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: TRANSFER_MAX_BYTES } }))
  async importConfig(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('dryRun') dryRunQuery?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded (multipart field "file": .json, max 10 MB)');
    }
    return this.transferService.importFile(
      req.projectId as string,
      { originalname: file.originalname, buffer: file.buffer },
      { dryRun: parseFlag(dryRunQuery, false) },
    );
  }
}
