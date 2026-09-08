import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, UseInterceptors, UploadedFile, Req, Res, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ApiKeyOrJwtAuthGuard, ProjectMembershipGuard, ProjectRoleGuard, MinimumRole } from '../../common/index.js';
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
  async getTypes(@Req() req: Request) {
    return this.configService.getTypes(req.projectId as string);
  }

  @Post('types')
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('admin')
  async createType(@Req() req: Request, @Body() body: unknown) {
    const data = createItemTypeSchema.parse(body);
    return this.configService.createType(req.projectId as string, data);
  }

  @Patch('types/:id')
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('admin')
  async updateType(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    const data = createItemTypeSchema.partial().parse(body);
    return this.configService.updateType(req.projectId as string, id, data);
  }

  @Delete('types/:id')
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('admin')
  async deleteType(@Req() req: Request, @Param('id') id: string) {
    await this.configService.deleteType(req.projectId as string, id);
    return { success: true };
  }

  // --- Statuses ---

  @Get('statuses')
  async getStatuses(@Req() req: Request) {
    return this.configService.getStatuses(req.projectId as string);
  }

  @Post('statuses')
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('admin')
  async createStatus(@Req() req: Request, @Body() body: unknown) {
    const data = createItemStatusSchema.parse(body);
    return this.configService.createStatus(req.projectId as string, data);
  }

  @Patch('statuses/:id')
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('admin')
  async updateStatus(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    const data = createItemStatusSchema.partial().parse(body);
    return this.configService.updateStatus(req.projectId as string, id, data);
  }

  @Delete('statuses/:id')
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('admin')
  async deleteStatus(@Req() req: Request, @Param('id') id: string) {
    await this.configService.deleteStatus(req.projectId as string, id);
    return { success: true };
  }

  // --- Priorities ---

  @Get('priorities')
  async getPriorities(@Req() req: Request) {
    return this.configService.getPriorities(req.projectId as string);
  }

  @Post('priorities')
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('admin')
  async createPriority(@Req() req: Request, @Body() body: unknown) {
    const data = createItemPrioritySchema.parse(body);
    return this.configService.createPriority(req.projectId as string, data);
  }

  @Patch('priorities/:id')
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('admin')
  async updatePriority(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    const data = createItemPrioritySchema.partial().parse(body);
    return this.configService.updatePriority(req.projectId as string, id, data);
  }

  @Delete('priorities/:id')
  @UseGuards(ProjectRoleGuard)
  @MinimumRole('admin')
  async deletePriority(@Req() req: Request, @Param('id') id: string) {
    await this.configService.deletePriority(req.projectId as string, id);
    return { success: true };
  }

  // --- Config transfer (types + statuses + priorities + tags as one JSON template) ---

  @Get('config/export')
  @ApiOperation({ summary: 'Export project config (types, statuses, priorities, tags) as a JSON template' })
  @ApiResponse({ status: 200, description: 'File download with Content-Disposition: attachment' })
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
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } }, required: ['file'] },
  })
  @ApiResponse({ status: 201, description: 'Per-entry results: created | updated | unchanged | failed' })
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
