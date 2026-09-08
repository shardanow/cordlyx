import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, UseInterceptors, UploadedFile, Req, Res, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { ApiKeyOrJwtAuthGuard, CurrentUser, type AuthenticatedUser, ProjectMembershipGuard, ProjectRoleGuard, MinimumRole } from '../../common/index.js';
import {
  ApiZodBody,
  ApiZodQuery,
  ApiProjectSlugParam,
  ApiDedupeQuery,
  ApiDryRunQuery,
  ApiErrorResponses,
  ApiListResponse,
} from '../../common/index.js';
import { ProjectsService } from './projects.service.js';
import { InvitesService } from './invites.service.js';
import { ProjectSnapshotService } from './project-snapshot.service.js';
import { EtagInterceptor } from '../../common/interceptors/etag.interceptor.js';
import { ItemsService } from '../items/items.service.js';
import { z } from 'zod';
import { TRANSFER_MAX_BYTES, parseFlag } from '../../common/transfer.util.js';
import { createProjectSchema, updateProjectSchema } from '@cordlyx/shared';
import type { Request, Response } from 'express';

// Hoisted so the same shape validates at runtime and documents the query.
const syncQuerySchema = z.object({
  since: z.string().datetime().describe('ISO timestamp: return items touched after this.'),
  limit: z.coerce.number().int().min(1).max(1000).optional().default(200).describe('Max items (default 200).'),
});

@ApiTags('projects')
@Controller()
@UseGuards(ApiKeyOrJwtAuthGuard)
export class ProjectsController {  constructor(
    private readonly projectsService: ProjectsService,
    private readonly invitesService: InvitesService,
    private readonly snapshotService: ProjectSnapshotService,
    private readonly itemsService: ItemsService,
  ) {}

  @Post('projects')
  @ApiOperation({ summary: 'Create a project (you become its admin)' })
  @ApiZodBody(createProjectSchema)
  @ApiResponse({ status: 201, description: 'The created project.' })
  @ApiErrorResponses(400, 401, 409, 429)
  async create(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const data = createProjectSchema.parse(body);
    return this.projectsService.create(data, user.id);
  }

  @Get('projects')
  @ApiOperation({ summary: 'List my projects (member of, not archived)' })
  @ApiListResponse('Projects the current user belongs to.')
  @ApiErrorResponses(401, 429)
  async list(@CurrentUser() user: AuthenticatedUser) {
    return this.projectsService.listForUser(user.id);
  }

  @Get('projects/:projectSlug')
  @ApiOperation({ summary: 'Get one project by slug' })
  @ApiProjectSlugParam()
  @ApiResponse({ status: 200, description: 'The project.' })
  @ApiErrorResponses(401, 403, 404, 429)
  @UseGuards(ProjectMembershipGuard)
  async getBySlug(@Param('projectSlug') slug: string) {
    const project = await this.projectsService.getBySlug(slug);
    if (!project) throw new (await import('@nestjs/common')).NotFoundException('Project not found');
    return project;
  }

  @Patch('projects/:projectSlug')
  @ApiOperation({ summary: 'Update project settings (admin only)' })
  @ApiProjectSlugParam()
  @ApiZodBody(updateProjectSchema)
  @ApiResponse({ status: 200, description: 'The updated project.' })
  @ApiErrorResponses(400, 401, 403, 404, 409, 429)
  @UseGuards(ProjectMembershipGuard, ProjectRoleGuard)
  @MinimumRole('admin')
  async update(@Param('projectSlug') slug: string, @Req() req: Request, @Body() body: unknown) {
    const data = updateProjectSchema.parse(body);
    return this.projectsService.update(slug, { ...data, projectId: req.projectId as string });
  }

  @Delete('projects/:projectSlug')
  @ApiOperation({ summary: 'Archive a project (admin only)' })
  @ApiProjectSlugParam()
  @ApiResponse({ status: 200, description: 'The archived project.' })
  @ApiErrorResponses(401, 403, 404, 429)
  @UseGuards(ProjectMembershipGuard, ProjectRoleGuard)
  @MinimumRole('admin')
  async remove(@Param('projectSlug') slug: string) {
    return this.projectsService.softDelete(slug);
  }

  // --- Invites ---

  @Post('projects/:projectSlug/invites')
  @ApiOperation({ summary: 'Create a one-time invite link (admin only, 7-day expiry)' })
  @ApiProjectSlugParam()
  @ApiResponse({ status: 201, description: '{ token } — share as /invite/<token>.' })
  @ApiErrorResponses(401, 403, 404, 429)
  @UseGuards(ProjectMembershipGuard, ProjectRoleGuard)
  @MinimumRole('admin')
  async createInvite(@Param('projectSlug') slug: string, @Req() req: Request, @CurrentUser() user: AuthenticatedUser) {
    return this.invitesService.create(req.projectId as string, user.id);
  }

  @Get('invites/:token')
  @ApiOperation({ summary: 'Preview an invite (project name, inviter)' })
  @ApiParam({ name: 'token', description: 'Invite token from the link.' })
  @ApiResponse({ status: 200, description: 'Invite info.' })
  @ApiErrorResponses(400, 401, 404, 429)
  @UseGuards(ApiKeyOrJwtAuthGuard)
  async getInvite(@Param('token') token: string) {
    return this.invitesService.getInfo(token);
  }

  @Post('invites/:token/accept')
  @ApiOperation({ summary: 'Accept an invite (join the project as member)' })
  @ApiParam({ name: 'token', description: 'Invite token from the link.' })
  @ApiResponse({ status: 200, description: 'Membership created.' })
  @ApiErrorResponses(400, 401, 404, 409, 429)
  @HttpCode(HttpStatus.OK)
  @UseGuards(ApiKeyOrJwtAuthGuard)
  async acceptInvite(@Param('token') token: string, @CurrentUser() user: AuthenticatedUser) {
    return this.invitesService.accept(token, user.id);
  }

  // --- Project snapshots (full export / import) ---

  @Get('projects/:projectSlug/sync')
  @ApiOperation({ summary: 'Incremental sync: items touched after ?since=ISO (deleted included as stubs)' })
  @ApiProjectSlugParam()
  @ApiZodQuery(syncQuerySchema)
  @ApiResponse({ status: 200, description: 'Changed items + meta { serverTime, hasMore, fullSyncRequired }' })
  @ApiErrorResponses(400, 401, 403, 404, 429)
  @UseGuards(ProjectMembershipGuard)
  async sync(@Req() req: Request, @Query() query: unknown) {
    const parsed = syncQuerySchema.parse(query);
    return this.itemsService.syncSince(req.projectId as string, new Date(parsed.since), parsed.limit);
  }

  @Get('projects/:projectSlug/snapshot/export')
  @UseInterceptors(EtagInterceptor)
  @ApiOperation({ summary: 'Export the whole project (config, plans, items, relations, roadmaps) as JSON' })
  @ApiProjectSlugParam()
  @ApiResponse({ status: 200, description: 'File download with Content-Disposition: attachment' })
  @ApiErrorResponses(401, 403, 404, 429)
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
  @ApiProjectSlugParam()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } }, required: ['file'] },
  })
  @ApiDedupeQuery()
  @ApiDryRunQuery()
  @ApiResponse({ status: 201, description: 'Per-section import results' })
  @ApiErrorResponses(400, 401, 403, 404, 429)
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
  @ApiQuery({ name: 'slug', required: false, description: 'Slug for the new project.' })
  @ApiQuery({ name: 'name', required: false, description: 'Display name for the new project.' })
  @ApiDedupeQuery()
  @ApiDryRunQuery()
  @ApiResponse({ status: 201, description: 'Created project plus per-section import results' })
  @ApiErrorResponses(400, 401, 409, 429)
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
