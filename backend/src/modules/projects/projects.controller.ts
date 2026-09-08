import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, UseInterceptors, UploadedFile, Req, Res, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { ApiKeyOrJwtAuthGuard, CurrentUser, type AuthenticatedUser, ProjectMembershipGuard, ProjectRoleGuard, MinimumRole } from '../../common/index.js';
import { ProjectsService } from './projects.service.js';
import { InvitesService } from './invites.service.js';
import { ProjectSnapshotService } from './project-snapshot.service.js';
import { EtagInterceptor } from '../../common/interceptors/etag.interceptor.js';
import { ItemsService } from '../items/items.service.js';
import { z } from 'zod';
import { TRANSFER_MAX_BYTES, parseFlag } from '../../common/transfer.util.js';
import { createProjectSchema, updateProjectSchema } from '@cordlyx/shared';
import type { Request, Response } from 'express';

@ApiTags('projects')
@Controller()
@UseGuards(ApiKeyOrJwtAuthGuard)
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly invitesService: InvitesService,
    private readonly snapshotService: ProjectSnapshotService,
    private readonly itemsService: ItemsService,
  ) {}

  @Post('projects')
  async create(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const data = createProjectSchema.parse(body);
    return this.projectsService.create(data, user.id);
  }

  @Get('projects')
  async list(@CurrentUser() user: AuthenticatedUser) {
    return this.projectsService.listForUser(user.id);
  }

  @Get('projects/:projectSlug')
  @UseGuards(ProjectMembershipGuard)
  async getBySlug(@Param('projectSlug') slug: string) {
    const project = await this.projectsService.getBySlug(slug);
    if (!project) throw new (await import('@nestjs/common')).NotFoundException('Project not found');
    return project;
  }

  @Patch('projects/:projectSlug')
  @UseGuards(ProjectMembershipGuard, ProjectRoleGuard)
  @MinimumRole('admin')
  async update(@Param('projectSlug') slug: string, @Req() req: Request, @Body() body: unknown) {
    const data = updateProjectSchema.parse(body);
    return this.projectsService.update(slug, { ...data, projectId: req.projectId as string });
  }

  @Delete('projects/:projectSlug')
  @UseGuards(ProjectMembershipGuard, ProjectRoleGuard)
  @MinimumRole('admin')
  async remove(@Param('projectSlug') slug: string) {
    return this.projectsService.softDelete(slug);
  }

  // --- Invites ---

  @Post('projects/:projectSlug/invites')
  @UseGuards(ProjectMembershipGuard, ProjectRoleGuard)
  @MinimumRole('admin')
  async createInvite(@Param('projectSlug') slug: string, @Req() req: Request, @CurrentUser() user: AuthenticatedUser) {
    return this.invitesService.create(req.projectId as string, user.id);
  }

  @Get('invites/:token')
  @UseGuards(ApiKeyOrJwtAuthGuard)
  async getInvite(@Param('token') token: string) {
    return this.invitesService.getInfo(token);
  }

  @Post('invites/:token/accept')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ApiKeyOrJwtAuthGuard)
  async acceptInvite(@Param('token') token: string, @CurrentUser() user: AuthenticatedUser) {
    return this.invitesService.accept(token, user.id);
  }

  // --- Project snapshots (full export / import) ---

  @Get('projects/:projectSlug/sync')
  @ApiOperation({ summary: 'Incremental sync: items touched after ?since=ISO (deleted included as stubs)' })
  @ApiResponse({ status: 200, description: 'Changed items + meta { serverTime, hasMore, fullSyncRequired }' })
  @UseGuards(ProjectMembershipGuard)
  async sync(@Req() req: Request, @Query() query: unknown) {
    const parsed = z
      .object({
        since: z.string().datetime(),
        limit: z.coerce.number().int().min(1).max(1000).optional().default(200),
      })
      .parse(query);
    return this.itemsService.syncSince(req.projectId as string, new Date(parsed.since), parsed.limit);
  }

  @Get('projects/:projectSlug/snapshot/export')
  @UseInterceptors(EtagInterceptor)
  @ApiOperation({ summary: 'Export the whole project (config, plans, items, relations, roadmaps) as JSON' })  @ApiResponse({ status: 200, description: 'File download with Content-Disposition: attachment' })
  @UseGuards(ProjectMembershipGuard)
  async exportSnapshot(
    @Param('projectSlug') slug: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const body = await this.snapshotService.exportSnapshot(req.projectId as string);
    res.set({
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slug}-snapshot.json"`,
    });
    return JSON.stringify(body, null, 2);
  }

  @Post('projects/:projectSlug/snapshot/import')
  @ApiOperation({ summary: 'Import a snapshot into this project (merge by name/title, supports dryRun)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } }, required: ['file'] },
  })
  @ApiResponse({ status: 201, description: 'Per-section import results' })
  @UseGuards(ProjectMembershipGuard, ProjectRoleGuard)
  @MinimumRole('admin')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: TRANSFER_MAX_BYTES } }))
  async importSnapshot(
    @Req() req: Request,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('dedupe') dedupeQuery?: string,
    @Query('dryRun') dryRunQuery?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded (multipart field "file": snapshot .json, max 10 MB)');
    }
    return this.snapshotService.importFile(
      req.projectId as string,
      { originalname: file.originalname, buffer: file.buffer },
      { dedupe: parseFlag(dedupeQuery, true), dryRun: parseFlag(dryRunQuery, false), reporterId: user.id },
    );
  }

  @Post('projects/snapshot/import-new')
  @ApiOperation({ summary: 'Create a new project from a snapshot file (?slug=&name=, supports dryRun validation)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } }, required: ['file'] },
  })
  @ApiResponse({ status: 201, description: 'Created project plus per-section import results' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: TRANSFER_MAX_BYTES } }))
  async importSnapshotNew(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('slug') slugQuery?: string,
    @Query('name') nameQuery?: string,
    @Query('dedupe') dedupeQuery?: string,
    @Query('dryRun') dryRunQuery?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded (multipart field "file": snapshot .json, max 10 MB)');
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(file.buffer.toString('utf-8'));
    } catch {
      throw new BadRequestException('Invalid snapshot JSON file (snapshots are JSON only)');
    }
    return this.snapshotService.importNewProject(user.id, parsed, {
      slug: slugQuery,
      name: nameQuery,
      dedupe: parseFlag(dedupeQuery, true),
      dryRun: parseFlag(dryRunQuery, false),
    });
  }
}
